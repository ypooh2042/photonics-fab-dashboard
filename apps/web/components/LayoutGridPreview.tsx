"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, useTransformEffect } from "react-zoom-pan-pinch";
import type { GridBounds } from "@/lib/geometry";

export type { GridBounds };

const FIELD_SIZE_UM = 1000;

function computeGridBounds(bbox: { xmin: number; ymin: number; xmax: number; ymax: number }): GridBounds {
  return {
    leftUm: Math.floor(bbox.xmin / FIELD_SIZE_UM) * FIELD_SIZE_UM,
    bottomUm: Math.floor(bbox.ymin / FIELD_SIZE_UM) * FIELD_SIZE_UM,
    rightUm: Math.ceil(bbox.xmax / FIELD_SIZE_UM) * FIELD_SIZE_UM,
    topUm: Math.ceil(bbox.ymax / FIELD_SIZE_UM) * FIELD_SIZE_UM,
  };
}

export { computeGridBounds };

/** Rounds down to a "nice" 1/2/5 * 10^n value, so the scale bar always shows a clean number. */
function niceScaleValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = value / 10 ** exponent;
  const niceBase = base >= 5 ? 5 : base >= 2 ? 2 : 1;
  return niceBase * 10 ** exponent;
}

function formatScaleLabel(um: number): string {
  if (um >= 1000) return `${um / 1000} mm`;
  if (um < 1) return `${um * 1000} nm`;
  return `${um} µm`;
}

const SCALE_BAR_TARGET_PX = 90;

/**
 * Reads the live zoom scale from react-zoom-pan-pinch's context (must render
 * inside TransformWrapper) and the fixed on-screen size of the viewport
 * container (unaffected by zoom/pan, since only the content inside it
 * transforms) to derive real-world µm per screen pixel — accounting for the
 * SVG's default "meet" aspect-fit, where the limiting dimension sets the
 * actual scale for both axes.
 */
function ScaleBar({
  containerRef,
  viewBoxWidthUm,
  viewBoxHeightUm,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewBoxWidthUm: number;
  viewBoxHeightUm: number;
}) {
  const [scale, setScale] = useState(1);
  const [containerSizePx, setContainerSizePx] = useState<{ width: number; height: number } | null>(null);

  useTransformEffect(({ state }) => {
    setScale(state.scale);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSizePx({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  if (!containerSizePx || containerSizePx.width === 0 || containerSizePx.height === 0) return null;

  const umPerPxAtScale1 = Math.max(viewBoxWidthUm / containerSizePx.width, viewBoxHeightUm / containerSizePx.height);
  const umPerPx = umPerPxAtScale1 / scale;
  const niceUm = niceScaleValue(SCALE_BAR_TARGET_PX * umPerPx);
  const barPx = niceUm / umPerPx;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-0.5 pointer-events-none select-none">
      <div style={{ width: barPx, height: 4 }} className="relative">
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/70 dark:bg-white/80" />
        <div className="absolute left-0 top-0 bottom-0 w-px bg-black/70 dark:bg-white/80" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-black/70 dark:bg-white/80" />
      </div>
      <span
        data-testid="scale-bar-label"
        className="text-[10px] font-medium text-black/80 dark:text-white/80 bg-white/80 dark:bg-neutral-900/80 rounded px-1"
      >
        {formatScaleLabel(niceUm)}
      </span>
    </div>
  );
}

interface Props {
  svg: string;
  visibleLayerKeys: Set<string>;
  gridBounds: GridBounds | null;
  /** Set false to hide the e-beam field-grid explanation/overlay for previews that aren't GDS patterns (e.g. chip-layout mock placement). Defaults to true. */
  showFieldGrid?: boolean;
}

export default function LayoutGridPreview({ svg, visibleLayerKeys, gridBounds, showFieldGrid = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => {
    const m = svg.match(/^<svg[^>]*viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"[^>]*>([\s\S]*)<\/svg>$/);
    if (!m) return null;
    return {
      minX: parseFloat(m[1]),
      minY: parseFloat(m[2]),
      width: parseFloat(m[3]),
      height: parseFloat(m[4]),
      inner: m[5],
    };
  }, [svg]);

  // Layer visibility is driven by a <style> rule (declarative, recomputed every
  // render) rather than imperative DOM mutation — a previous version toggled
  // `g.style.display` in a useEffect keyed on [visibleLayerKeys, parsed], but
  // dangerouslySetInnerHTML re-applies innerHTML on unrelated parent re-renders
  // (e.g. typing in another field), wiping those manual style changes without
  // the effect re-running to restore them. CSS selectors keep applying
  // regardless of when/how the underlying DOM nodes get (re)created.
  const visibleSelector = [...visibleLayerKeys].map((k) => `g.gds-layer[data-layer="${k}"]`).join(", ");

  if (!parsed) return <p className="text-sm opacity-60">미리보기를 표시할 수 없습니다.</p>;

  const fontSize = Math.max(parsed.width, parsed.height) / 55;

  // SVG y is flipped (svg_y = -real_y); grid rect in svg space:
  const gridRect = gridBounds
    ? {
        x: gridBounds.leftUm,
        y: -gridBounds.topUm,
        width: gridBounds.rightUm - gridBounds.leftUm,
        height: gridBounds.topUm - gridBounds.bottomUm,
      }
    : null;

  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (showFieldGrid) {
    const startX = Math.floor(parsed.minX / FIELD_SIZE_UM) * FIELD_SIZE_UM;
    const endX = parsed.minX + parsed.width;
    for (let x = startX; x <= endX; x += FIELD_SIZE_UM) {
      gridLines.push({ x1: x, y1: parsed.minY, x2: x, y2: parsed.minY + parsed.height });
    }
    const startY = Math.floor(parsed.minY / FIELD_SIZE_UM) * FIELD_SIZE_UM;
    const endY = parsed.minY + parsed.height;
    for (let y = startY; y <= endY; y += FIELD_SIZE_UM) {
      gridLines.push({ x1: parsed.minX, y1: y, x2: parsed.minX + parsed.width, y2: y });
    }
  }

  return (
    <div>
      {showFieldGrid && (
        <p className="text-sm font-bold text-black dark:text-white mb-2">
          옅은 격자 한 칸이 e-beam이 한 번에 그릴 수 있는 노광 필드(1000×1000µm)입니다. 패턴이 격자 한 칸에 걸쳐 있으면 stitching
          error(미세 틀어짐, 최대 5~10nm)가 발생할 수 있습니다. 이를 참고하여 중요한 패턴은 한 격자 안에 들어오도록 레이아웃을
          수정하는 것이 좋습니다.
        </p>
      )}
      <div
        ref={containerRef}
        className="relative rounded-lg border border-black/10 dark:border-white/15 overflow-hidden bg-black/[.02] dark:bg-white/[.03]"
        style={{ height: 420 }}
      >
        <TransformWrapper initialScale={1} minScale={0.1} maxScale={50} centerOnInit>
          {({ resetTransform }) => (
            <>
              <button
                type="button"
                onClick={() => resetTransform()}
                className="absolute top-2 right-2 z-10 rounded-md border border-black/15 dark:border-white/20 bg-white/90 dark:bg-neutral-900/90 px-2 py-1 text-xs hover:bg-white dark:hover:bg-neutral-900"
              >
                처음 위치로
              </button>
              <ScaleBar containerRef={containerRef} viewBoxWidthUm={parsed.width} viewBoxHeightUm={parsed.height} />
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", height: "100%" }}
              >
                <svg
                  viewBox={`${parsed.minX} ${parsed.minY} ${parsed.width} ${parsed.height}`}
                  style={{ width: "100%", height: "100%" }}
                >
                  <style>{`g.gds-layer { display: none; } ${visibleSelector ? `${visibleSelector} { display: inline; }` : ""}`}</style>
                  <g dangerouslySetInnerHTML={{ __html: parsed.inner }} />
                  <g stroke="currentColor" strokeOpacity={0.15} className="text-black dark:text-white">
                    {gridLines.map((l, i) => (
                      <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={parsed.width / 4000} />
                    ))}
                  </g>
                  {gridRect && (
                    <>
                      <rect
                        x={gridRect.x}
                        y={gridRect.y}
                        width={gridRect.width}
                        height={gridRect.height}
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth={parsed.width / 400}
                        strokeDasharray={`${parsed.width / 100} ${parsed.width / 200}`}
                      />
                      <text x={gridRect.x} y={gridRect.y + gridRect.height + fontSize * 1.2} fontSize={fontSize} fill="#dc2626">
                        ({gridBounds!.leftUm.toFixed(0)}, {gridBounds!.bottomUm.toFixed(0)})
                      </text>
                      <text
                        x={gridRect.x + gridRect.width}
                        y={gridRect.y - fontSize * 0.5}
                        fontSize={fontSize}
                        fill="#dc2626"
                        textAnchor="end"
                      >
                        ({gridBounds!.rightUm.toFixed(0)}, {gridBounds!.topUm.toFixed(0)})
                      </text>
                    </>
                  )}
                </svg>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
      {gridBounds && (
        <p className="text-xs opacity-60 mt-1">
          Grid size: ({gridBounds.leftUm.toFixed(0)}, {gridBounds.bottomUm.toFixed(0)}) ~ ({gridBounds.rightUm.toFixed(0)},{" "}
          {gridBounds.topUm.toFixed(0)})
        </p>
      )}
    </div>
  );
}
