import Link from "next/link";
import type { ChipRunSummary } from "@/lib/data";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  complete: "bg-green-500/15 text-green-600 dark:text-green-400",
  abandoned: "bg-gray-500/15 text-gray-500",
};

export default function ChipRunCard({ chipRun }: { chipRun: ChipRunSummary }) {
  const { total, complete, blocked } = chipRun.stageCounts;
  return (
    <Link
      href={`/chips/${chipRun.id}`}
      className="block rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-blue-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs opacity-60">{chipRun.projectName}</p>
          <h3 className="font-medium">{chipRun.label}</h3>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[chipRun.status] ?? STATUS_STYLE.active}`}
        >
          {chipRun.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs opacity-70">
        <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{ width: total ? `${(complete / total) * 100}%` : "0%" }}
          />
        </div>
        <span>
          {complete}/{total} 단계
        </span>
        {blocked > 0 && <span className="text-red-500">blocked {blocked}</span>}
      </div>
      <p className="mt-2 text-xs opacity-50">최근 업데이트: {chipRun.lastUpdatedDate}</p>
      {chipRun.needsReview && (
        <p className="mt-1 text-xs text-amber-500">⚠ 검수 필요 (낮은 신뢰도)</p>
      )}
    </Link>
  );
}
