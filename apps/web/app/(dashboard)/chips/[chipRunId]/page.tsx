import { notFound } from "next/navigation";
import Link from "next/link";
import { getChipRunDetail } from "@/lib/data";
import PipelineTimeline from "@/components/PipelineTimeline";

export default async function ChipRunPage({
  params,
}: {
  params: Promise<{ chipRunId: string }>;
}) {
  const { chipRunId } = await params;
  const chipRun = getChipRunDetail(Number(chipRunId));
  if (!chipRun) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          ← 전체 목록
        </Link>
        <Link href={`/admin/chips/${chipRun.id}/edit`} className="text-sm opacity-60 hover:opacity-100">
          관리자 수정
        </Link>
      </div>
      <p className="text-xs opacity-60 mt-2">{chipRun.projectName}</p>
      <h1 className="text-xl font-semibold">{chipRun.label}</h1>
      {chipRun.aliases.length > 0 && (
        <p className="text-xs opacity-50 mt-1">다른 이름: {chipRun.aliases.join(", ")}</p>
      )}
      <p className="text-xs opacity-50 mt-1">
        시작: {chipRun.firstSeenDate} · 최근 업데이트: {chipRun.lastUpdatedDate}
      </p>
      {chipRun.needsReview && (
        <p className="mt-2 text-sm text-amber-500">
          ⚠ 자동 추출 신뢰도가 낮아 검수가 필요합니다{" "}
          {chipRun.llmConfidence != null && `(confidence ${chipRun.llmConfidence.toFixed(2)})`}
        </p>
      )}

      <div className="mt-6">
        <PipelineTimeline stages={chipRun.stages} />
      </div>
    </div>
  );
}
