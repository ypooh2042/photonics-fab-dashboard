"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { RecipeEntryRow, RecipeEventRow } from "@/lib/data";
import { useLanguage } from "@/components/LanguageContext";

/**
 * The x-axis is a category axis keyed by row (see the `key` field below), not a
 * continuous time scale, so an event marker snaps to whichever logged entry's
 * date is closest rather than sitting at a mathematically exact date position.
 */
function nearestKey(data: { key: string; date: string }[], eventDate: string): string | undefined {
  if (data.length === 0) return undefined;
  const target = new Date(eventDate).getTime();
  let best = data[0];
  let bestDiff = Math.abs(new Date(best.date).getTime() - target);
  for (const d of data) {
    const diff = Math.abs(new Date(d.date).getTime() - target);
    if (diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best.key;
}

/** Renders a small ▣ marker at the reference line's top; clicking it toggles a popup with the event's date + note. */
function makeEventLabelRenderer(
  ev: RecipeEventRow,
  openEventId: number | null,
  setOpenEventId: (id: number | null) => void,
) {
  return function EventMarkerLabel(props: { viewBox?: { x: number; y: number } }) {
    const vb = props.viewBox;
    if (!vb) return <g />;
    const isOpen = openEventId === ev.id;
    return (
      <g
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          setOpenEventId(isOpen ? null : ev.id);
        }}
      >
        <text x={vb.x} y={vb.y - 4} textAnchor="middle" fontSize={12} fill="#dc2626">
          ▣
        </text>
        {isOpen && (
          <foreignObject x={vb.x - 90} y={Math.max(0, vb.y - 46)} width={180} height={42}>
            <div
              style={{
                background: "#dc2626",
                color: "#fff",
                fontSize: 10,
                borderRadius: 4,
                padding: "4px 6px",
                lineHeight: 1.3,
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{ev.eventDate}</div>
              <div>{ev.label}</div>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };
}

function EtchTrendChart({ entries, events }: { entries: RecipeEntryRow[]; events: RecipeEventRow[] }) {
  const [openEventId, setOpenEventId] = useState<number | null>(null);
  const { t } = useLanguage();
  const data = useMemo(
    () =>
      entries
        .map((e) => {
          const depth = e.params.etch_depth_nm;
          const time = e.params.etch_time_s;
          const selectivity = e.params.selectivity;
          const etchRate =
            typeof depth === "number" && typeof time === "number" && time > 0 ? depth / time : undefined;
          return {
            // recharts (v3) mismatches the highlighted hover point when multiple rows
            // share the same category value (same-day entries), so the axis key must
            // be unique per row; the date-only label is recovered via tickFormatter/labelFormatter.
            key: `${e.entryDate}#${e.id}`,
            date: e.entryDate,
            etchRate: etchRate,
            selectivity: typeof selectivity === "number" ? selectivity : undefined,
          };
        })
        .filter((d) => d.etchRate !== undefined || d.selectivity !== undefined),
    [entries],
  );

  if (data.length === 0) {
    return <p className="text-sm opacity-60">{t("insufficientEtchData")}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
        onClick={() => setOpenEventId(null)}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="key" tick={{ fontSize: 11 }} tickFormatter={(key: string) => key.split("#")[0]} />
        <YAxis yAxisId="rate" tick={{ fontSize: 11 }} label={{ value: "etch rate (nm/s)", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <YAxis yAxisId="selectivity" orientation="right" tick={{ fontSize: 11 }} label={{ value: "selectivity", angle: 90, position: "insideRight", fontSize: 11 }} />
        <Tooltip labelFormatter={(key: React.ReactNode) => String(key).split("#")[0]} />
        <Legend />
        {events.map((ev) => {
          const x = nearestKey(data, ev.eventDate);
          return x === undefined ? null : (
            <ReferenceLine
              key={ev.id}
              yAxisId="rate"
              x={x}
              stroke="#dc2626"
              strokeOpacity={0.5}
              strokeWidth={2}
              label={makeEventLabelRenderer(ev, openEventId, setOpenEventId)}
            />
          );
        })}
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="etchRate"
          name="Etch rate (nm/s)"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          yAxisId="selectivity"
          type="monotone"
          dataKey="selectivity"
          name="Selectivity"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function GenericTrendChart({ entries, events }: { entries: RecipeEntryRow[]; events: RecipeEventRow[] }) {
  const [openEventId, setOpenEventId] = useState<number | null>(null);
  const numericKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const [k, v] of Object.entries(e.params)) {
        if (typeof v === "number") counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [entries]);

  const [selectedKey, setSelectedKey] = useState(numericKeys[0]);
  const activeKey = selectedKey ?? numericKeys[0];

  const data = useMemo(
    () =>
      entries
        .filter((e) => typeof e.params[activeKey] === "number")
        .map((e) => ({ key: `${e.entryDate}#${e.id}`, date: e.entryDate, value: e.params[activeKey] as number })),
    [entries, activeKey],
  );

  if (numericKeys.length === 0) return null;

  return (
    <>
      <div className="flex items-center justify-end mb-2">
        <select
          value={activeKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="text-xs bg-transparent border border-black/15 dark:border-white/20 rounded-md px-2 py-1"
        >
          {numericKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }} onClick={() => setOpenEventId(null)}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="key" tick={{ fontSize: 11 }} tickFormatter={(key: string) => key.split("#")[0]} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(key: React.ReactNode) => String(key).split("#")[0]} />
          <Legend />
          {events.map((ev) => {
            const x = nearestKey(data, ev.eventDate);
            return x === undefined ? null : (
              <ReferenceLine
                key={ev.id}
                x={x}
                stroke="#dc2626"
                strokeOpacity={0.5}
                strokeWidth={2}
                label={makeEventLabelRenderer(ev, openEventId, setOpenEventId)}
              />
            );
          })}
          <Line type="monotone" dataKey="value" name={activeKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export default function RecipeTrendChart({
  entries,
  categorySlug,
  events,
}: {
  entries: RecipeEntryRow[];
  categorySlug: string;
  events: RecipeEventRow[];
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h3 className="font-medium text-sm mb-2">{t("trendHeading")}</h3>
      {categorySlug === "etching" && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t("etchHintText")}</p>
      )}
      {categorySlug === "etching" ? (
        <EtchTrendChart entries={entries} events={events} />
      ) : (
        <GenericTrendChart entries={entries} events={events} />
      )}
    </div>
  );
}
