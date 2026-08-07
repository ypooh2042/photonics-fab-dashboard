import type { GridBounds } from "./geometry";

interface BBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface LayerArea {
  layer: number;
  datatype: number;
  area_um2: number;
  bbox: BBox;
}

export interface GdsAnalysis {
  layers: LayerArea[];
  svg: string;
  overall_bbox: BBox;
}

export async function analyzeGds(file: File): Promise<GdsAnalysis> {
  const base = process.env.GDS_ANALYZER_URL ?? "http://127.0.0.1:8003";
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(`${base}/analyze`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`GDS analyzer error (${res.status}): ${detail.detail ?? res.statusText}`);
  }
  return (await res.json()) as GdsAnalysis;
}

export interface ConvertPositiveResult {
  layers: LayerArea[];
  svg: string;
  overallBbox: BBox;
  gridBounds: GridBounds;
  gdsBase64: string;
}

export async function convertToPositive(
  fileBuffer: Buffer,
  filename: string,
  layerKeys: string[],
  isolationGapUm: number,
): Promise<ConvertPositiveResult> {
  const base = process.env.GDS_ANALYZER_URL ?? "http://127.0.0.1:8003";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(fileBuffer)]), filename);
  for (const key of layerKeys) form.append("layers", key);
  form.append("isolation_gap_um", String(isolationGapUm));

  const res = await fetch(`${base}/convert-positive`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`GDS analyzer error (${res.status}): ${detail.detail ?? res.statusText}`);
  }
  const data = (await res.json()) as {
    layers: LayerArea[];
    svg: string;
    overall_bbox: BBox;
    grid_bounds: GridBounds;
    gds_base64: string;
  };
  return {
    layers: data.layers,
    svg: data.svg,
    overallBbox: data.overall_bbox,
    gridBounds: data.grid_bounds,
    gdsBase64: data.gds_base64,
  };
}
