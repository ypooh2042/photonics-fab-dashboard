"""GDS layer-area analysis and SVG rendering.

Uses klayout.db directly (the same GDS-parsing engine gdsfactory itself is
built on) rather than gdsfactory's own higher-level API, since all we need
here is per-layer polygon area/geometry — a stable, low-level operation.
The SVG is built by hand from klayout Region/Polygon data rather than
pulling in a second GDS library (e.g. gdstk) just for rendering.
"""

import base64
import math
import tempfile
from pathlib import Path

import klayout.db as kdb

_LAYER_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
    "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
]

# Visual-only simplification tolerance for the preview SVG (does not affect
# area/bbox, which are computed from the unsimplified region). 50nm is well
# below anything visible once zoomed to a 1000um e-beam field, but cuts
# vertex count (and SVG file size) drastically for curvy layouts.
_SVG_SMOOTH_TOLERANCE_UM = 0.05


def analyze_layers(file_path: str) -> list[dict]:
    """Per-layer area only (kept for backwards-compat / cheap callers)."""
    return analyze_layers_and_svg(file_path)["layers"]


def _layer_region(layout: "kdb.Layout", layer_index: int) -> "kdb.Region":
    """Region for a layer, recursively through cell hierarchy, unioned across
    *all* top cells. `Layout.top_cell()` throws if a GDS has more than one
    top cell (common for files that bundle several independent designs, or
    that carry an unreferenced leftover cell) — every layer/geometry lookup
    goes through this helper instead so such files still work, by treating
    all top-level content as belonging to one combined layout.
    """
    region = kdb.Region()
    for top in layout.top_cells():
        region += kdb.Region(top.begin_shapes_rec(layer_index))
    return region


def _polygon_path_d(polygon: "kdb.Polygon", dbu: float) -> str:
    def pt(p) -> str:
        x = p.x * dbu
        y = -(p.y * dbu)  # flip Y: GDS is Y-up, SVG is Y-down
        return f"{x:.2f},{y:.2f}"

    hull_pts = list(polygon.each_point_hull())
    if not hull_pts:
        return ""
    parts = ["M " + " L ".join(pt(p) for p in hull_pts) + " Z"]
    for h in range(polygon.holes()):
        hole_pts = list(polygon.each_point_hole(h))
        if hole_pts:
            parts.append("M " + " L ".join(pt(p) for p in hole_pts) + " Z")
    return " ".join(parts)


def analyze_layers_and_svg(file_path: str) -> dict:
    """Returns per-layer area+bbox (in um, real GDS orientation), an SVG
    string with one <g data-layer="L:D"> group per layer (all layers
    present; the frontend toggles visibility per the user's layer
    selection), and the overall bbox across all layers.
    """
    layout = kdb.Layout()
    layout.read(file_path)
    return _analyze_layout(layout)


def _analyze_layout(layout: "kdb.Layout") -> dict:
    """Same as `analyze_layers_and_svg`, but operating on an already-loaded
    (possibly in-memory-built, never touching disk) `kdb.Layout` — used to
    render the converted output of `convert_negative_to_positive` with the
    exact same per-layer SVG/bbox logic as a freshly-uploaded file.
    """
    dbu = layout.dbu

    layer_results = []
    svg_groups = []
    overall_box: list[float] | None = None

    for idx, layer_index in enumerate(layout.layer_indexes()):
        info = layout.get_info(layer_index)
        region = _layer_region(layout, layer_index)
        area_um2 = region.area() * (dbu**2)
        if area_um2 <= 0:
            continue

        box = region.bbox()
        xmin, ymin = box.left * dbu, box.bottom * dbu
        xmax, ymax = box.right * dbu, box.top * dbu

        if overall_box is None:
            overall_box = [xmin, ymin, xmax, ymax]
        else:
            overall_box[0] = min(overall_box[0], xmin)
            overall_box[1] = min(overall_box[1], ymin)
            overall_box[2] = max(overall_box[2], xmax)
            overall_box[3] = max(overall_box[3], ymax)

        color = _LAYER_COLORS[idx % len(_LAYER_COLORS)]
        tolerance_dbu = _SVG_SMOOTH_TOLERANCE_UM / dbu
        simplified = region.merged().smoothed(tolerance_dbu, True)
        path_ds = [d for d in (_polygon_path_d(p, dbu) for p in simplified.each()) if d]

        layer_key = f"{info.layer}:{info.datatype}"
        if path_ds:
            path_el = (
                f'<path d="{" ".join(path_ds)}" fill="{color}" fill-opacity="0.55" '
                f'stroke="{color}" stroke-width="0" fill-rule="evenodd" />'
            )
            svg_groups.append(f'<g data-layer="{layer_key}" class="gds-layer">{path_el}</g>')

        layer_results.append(
            {
                "layer": info.layer,
                "datatype": info.datatype,
                "area_um2": area_um2,
                "bbox": {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax},
            }
        )

    layer_results.sort(key=lambda r: (r["layer"], r["datatype"]))

    if overall_box is None:
        overall_box = [0.0, 0.0, 0.0, 0.0]
    xmin, ymin, xmax, ymax = overall_box

    svg_ymin = -ymax
    width = max(xmax - xmin, 1e-6)
    height = max(ymax - ymin, 1e-6)
    pad = max(width, height) * 0.02
    view_box = f"{xmin - pad:.4f} {svg_ymin - pad:.4f} {width + 2 * pad:.4f} {height + 2 * pad:.4f}"

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">' + "".join(svg_groups) + "</svg>"

    return {
        "layers": layer_results,
        "svg": svg,
        "overall_bbox": {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax},
    }


# Must match FIELD_SIZE_UM in apps/web/components/LayoutGridPreview.tsx — this
# is the same 1000um e-beam field grid used there to compute the minimal
# bounding box, reused here purely for reporting/preview framing (which
# field(s) this pattern falls into), not for the exposure geometry itself.
_FIELD_SIZE_UM = 1000.0


def convert_negative_to_positive(file_path: str, layer_keys: list[str], isolation_gap_um: float) -> dict:
    """Converts the selected negative-resist waveguide-line layers into the
    equivalent positive-resist exposure pattern; every other layer in the
    file is carried through unchanged into the output, so the result is a
    normal multi-layer GDS again (just with the selected layers replaced).

    In negative resist, the drawn polygon (the waveguide line itself) is what
    stays after development, so exposing exactly the line works. In positive
    resist, exposed area is *removed*, so to keep the waveguide itself intact
    it must stay unexposed — but rather than exposing the entire surrounding
    field (which would blow up e-beam write time for no reason), only a thin
    isolation-gap-wide moat immediately around the waveguide is exposed. That
    moat opens an isolation trench that separates the waveguide from the
    surrounding material; everything beyond it is left untouched, same as
    the waveguide itself.

    The moat is `buffered - waveguide`, where `buffered = waveguide.sized(gap)`
    (isotropic outward buffer) — the ring between the original outline and
    the gap-offset outline, not the whole field. This is computed separately
    per selected layer (each keeps its own ring around its own geometry).
    """
    if not layer_keys:
        raise ValueError("적어도 하나의 레이어를 선택해야 합니다")
    if isolation_gap_um <= 0:
        raise ValueError("isolation_gap_um must be > 0")

    selected: set[tuple[int, int]] = set()
    for key in layer_keys:
        layer_num_s, _, datatype_s = key.partition(":")
        try:
            selected.add((int(layer_num_s), int(datatype_s)))
        except ValueError:
            raise ValueError(f"invalid layer key: {key!r}")

    layout = kdb.Layout()
    layout.read(file_path)
    dbu = layout.dbu
    gap_dbu = round(isolation_gap_um / dbu)

    found = {(layout.get_info(li).layer, layout.get_info(li).datatype) for li in layout.layer_indexes()}
    missing = selected - found
    if missing:
        raise ValueError(f"file has no layer(s): {sorted(missing)}")

    out_layout = kdb.Layout()
    out_layout.dbu = dbu
    out_top = out_layout.create_cell("TOP")

    for layer_index in layout.layer_indexes():
        info = layout.get_info(layer_index)
        region = _layer_region(layout, layer_index).merged()
        if region.is_empty():
            continue

        if (info.layer, info.datatype) in selected:
            buffered = region.sized(gap_dbu)
            out_region = (buffered - region).merged()
            if out_region.is_empty():
                raise ValueError(
                    f"isolation_gap_um이 너무 작아 layer {info.layer}:{info.datatype}에 노광할 영역이 없습니다"
                )
        else:
            out_region = region

        out_layer_index = out_layout.layer(info.layer, info.datatype)
        out_top.shapes(out_layer_index).insert(out_region)

    analyzed = _analyze_layout(out_layout)
    xmin, ymin, xmax, ymax = (
        analyzed["overall_bbox"]["xmin"],
        analyzed["overall_bbox"]["ymin"],
        analyzed["overall_bbox"]["xmax"],
        analyzed["overall_bbox"]["ymax"],
    )
    grid_bounds = {
        "leftUm": math.floor(xmin / _FIELD_SIZE_UM) * _FIELD_SIZE_UM,
        "bottomUm": math.floor(ymin / _FIELD_SIZE_UM) * _FIELD_SIZE_UM,
        "rightUm": math.ceil(xmax / _FIELD_SIZE_UM) * _FIELD_SIZE_UM,
        "topUm": math.ceil(ymax / _FIELD_SIZE_UM) * _FIELD_SIZE_UM,
    }

    with tempfile.NamedTemporaryFile(suffix=".gds", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        out_layout.write(tmp_path)
        gds_bytes = Path(tmp_path).read_bytes()
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "layers": analyzed["layers"],
        "svg": analyzed["svg"],
        "overall_bbox": analyzed["overall_bbox"],
        "grid_bounds": grid_bounds,
        "gds_base64": base64.b64encode(gds_bytes).decode("ascii"),
    }
