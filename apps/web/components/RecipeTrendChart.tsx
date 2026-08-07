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
} from "recharts";
import type { RecipeEntryRow } from "@/lib/data";

function EtchTrendChart({ entries }: { entries: RecipeEntryRow[] }) {
  const data = entries
    .map((e) => {
      const depth = e.params.etch_depth_nm;
      const time = e.params.etch_time_s;
      const selectivity = e.params.selectivity;
      const etchRate =
        typeof depth === "number" && typeof time === "number" && time > 0 ? depth / time : undefined;
      return {
        date: e.entryDate,
        etchRate: etchRate,
        selectivity: typeof selectivity === "number" ? selectivity : undefined,
      };
    })
    .filter((d) => d.etchRate !== undefined || d.selectivity !== undefined);

  if (data.length === 0) {
    return <p className="text-sm opacity-60">etch rate/selectivity를 계산할 데이터(etch_depth_nm, etch_time_s, selectivity)가 부족합니다.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="rate" tick={{ fontSize: 11 }} label={{ value: "etch rate (nm/s)", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <YAxis yAxisId="selectivity" orientation="right" tick={{ fontSize: 11 }} label={{ value: "selectivity", angle: 90, position: "insideRight", fontSize: 11 }} />
        <Tooltip />
        <Legend />
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

function GenericTrendChart({ entries }: { entries: RecipeEntryRow[] }) {
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

  if (numericKeys.length === 0) return null;

  const data = entries
    .filter((e) => typeof e.params[activeKey] === "number")
    .map((e) => ({ date: e.entryDate, value: e.params[activeKey] as number }));

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
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" name={activeKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export default function RecipeTrendChart({
  entries,
  categorySlug,
}: {
  entries: RecipeEntryRow[];
  categorySlug: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h3 className="font-medium text-sm mb-2">기간별 트렌드</h3>
      {categorySlug === "etching" && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          resist_thickness_nm 가 명시되어 있어야 resist strip 전/후 단차로 selectivity를 계산합니다.
        </p>
      )}
      {categorySlug === "etching" ? (
        <EtchTrendChart entries={entries} />
      ) : (
        <GenericTrendChart entries={entries} />
      )}
    </div>
  );
}
