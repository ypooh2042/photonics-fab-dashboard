"use client";

const MM = 1000;
const PX_PER_MM = 12;

interface CanvasChip {
  id: number;
  name: string;
  centerXUm: number;
  widthUm: number;
  color: string;
}

interface CanvasPattern {
  key: string;
  label: string;
  centerXUm: number;
  centerYUm: number;
  sizeXUm: number;
  sizeYUm: number;
}

interface Props {
  widthUm: number;
  heightUm: number;
  chips: CanvasChip[];
  patterns: CanvasPattern[];
}

const OUTSIDE_MAX_MM = 3;
const MARGIN_MM = 3.5;

function formatMmLabel(x: number): string {
  if (x === 0) return "0mm";
  return x > 0 ? `+${x}mm` : `${x}mm`;
}

/**
 * One vertical tick at mm position x on a horizontal edge. `direction` is
 * -1 for the top edge (ticks poke upward, outside the rect) or +1 for the
 * bottom edge (ticks poke downward) — the inner (gray dashed, always
 * present) segment always points into the rect, the outer (solid, 5mm/X=0
 * multiples only) segment always points away from it. Major (5mm/X=0)
 * ticks also get a tiny coordinate label past the outer end.
 */
function xTick(x: number, edgeY: number, direction: 1 | -1) {
  const isZero = x === 0;
  const isMajor = x % 5 === 0;
  const innerLen = isZero ? 4 : isMajor ? 3 : 1.5;
  const outerLen = isMajor ? (isZero ? 3 : 2) : 0;
  return (
    <g key={`x${direction}${x}`}>
      <line
        x1={x}
        y1={edgeY}
        x2={x}
        y2={edgeY - direction * innerLen}
        stroke="#888"
        strokeWidth={isZero ? 0.15 : isMajor ? 0.1 : 0.06}
        strokeDasharray="0.4 0.35"
      />
      {outerLen > 0 && (
        <>
          <line
            x1={x}
            y1={edgeY}
            x2={x}
            y2={edgeY + direction * outerLen}
            stroke="currentColor"
            strokeWidth={isZero ? 0.3 : 0.18}
          />
          <text
            x={x}
            y={edgeY + direction * (outerLen + 0.9)}
            fontSize={0.8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            opacity={0.7}
          >
            {formatMmLabel(x)}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * Ruler convention: X ticks run along both the top and bottom edges, one
 * per mm — every tick gets a thin gray dashed segment reaching into the
 * rect, and only 5mm (and the boldest at X=0) multiples additionally get a
 * solid black segment poking out past the border. Y ticks sit along the
 * left edge, 1mm apart, staying fully inside (no outside extension, no
 * major/minor distinction, per spec). Ticks are drawn last so they always
 * stay visible on top of chip/pattern fills.
 */
export default function WindowCanvas({ widthUm, heightUm, chips, patterns }: Props) {
  const widthMm = widthUm / MM;
  const heightMm = heightUm / MM;
  const topEdgeMm = -heightMm / 2;
  const bottomEdgeMm = heightMm / 2;
  const leftEdgeMm = -widthMm / 2;

  const minX = leftEdgeMm - MARGIN_MM;
  const spanX = widthMm + MARGIN_MM * 2;
  const minY = topEdgeMm - OUTSIDE_MAX_MM - MARGIN_MM;
  const spanY = heightMm + OUTSIDE_MAX_MM * 2 + MARGIN_MM * 2;

  const halfW = Math.round(widthMm / 2);
  const xTicks = [];
  for (let x = -halfW; x <= halfW; x++) {
    xTicks.push(xTick(x, topEdgeMm, -1));
    xTicks.push(xTick(x, bottomEdgeMm, 1));
  }

  const halfH = Math.round(heightMm / 2);
  const yTicks = [];
  for (let y = -halfH; y <= halfH; y++) {
    const isZero = y === 0;
    yTicks.push(
      <line
        key={`y${y}`}
        x1={leftEdgeMm}
        y1={y}
        x2={leftEdgeMm + (isZero ? 3 : 1.5)}
        y2={y}
        stroke="#888"
        strokeWidth={isZero ? 0.12 : 0.06}
        strokeDasharray="0.4 0.35"
      />,
    );
  }

  return (
    <svg
      viewBox={`${minX} ${minY} ${spanX} ${spanY}`}
      width={spanX * PX_PER_MM}
      height={spanY * PX_PER_MM}
      className="text-black dark:text-white max-w-full h-auto"
    >
      <rect
        x={leftEdgeMm}
        y={topEdgeMm}
        width={widthMm}
        height={heightMm}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.15}
      />
      {chips.map((c) => {
        const wMm = c.widthUm / MM;
        const cx = c.centerXUm / MM;
        return (
          <g key={`chip-${c.id}`}>
            <rect x={cx - wMm / 2} y={topEdgeMm} width={wMm} height={heightMm} fill={c.color} />
            <text x={cx - wMm / 2 + 0.4} y={topEdgeMm + 1} fontSize={1} dominantBaseline="hanging">
              {c.name}
            </text>
          </g>
        );
      })}
      {patterns.map((p) => {
        const wMm = p.sizeXUm / MM;
        const hMm = p.sizeYUm / MM;
        const cx = p.centerXUm / MM;
        const cy = -(p.centerYUm / MM);
        return (
          <g key={p.key}>
            <rect
              x={cx - wMm / 2}
              y={cy - hMm / 2}
              width={wMm}
              height={hMm}
              fill="none"
              stroke="#dc2626"
              strokeWidth={0.12}
            />
            <text x={cx} y={cy} fontSize={1.4} textAnchor="middle" dominantBaseline="middle" fill="#dc2626">
              {p.label}
            </text>
          </g>
        );
      })}
      {xTicks}
      {yTicks}
    </svg>
  );
}
