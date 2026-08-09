import { notFound } from "next/navigation";
import Link from "next/link";
import { getChipRunDetail } from "@/lib/data";
import PipelineTimeline from "@/components/PipelineTimeline";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function ChipRunPage({
  params,
}: {
  params: Promise<{ chipRunId: string }>;
}) {
  const { chipRunId } = await params;
  const chipRun = getChipRunDetail(Number(chipRunId));
  if (!chipRun) notFound();
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          ← {t("chipRunBackToList")}
        </Link>
        <Link href={`/admin/chips/${chipRun.id}/edit`} className="text-sm opacity-60 hover:opacity-100">
          {t("adminEditLink")}
        </Link>
      </div>
      <p className="text-xs opacity-60 mt-2">{chipRun.projectName}</p>
      <h1 className="text-xl font-semibold">{chipRun.label}</h1>
      {chipRun.aliases.length > 0 && (
        <p className="text-xs opacity-50 mt-1">
          {t("aliasesLabel")}: {chipRun.aliases.join(", ")}
        </p>
      )}
      <p className="text-xs opacity-50 mt-1">
        {t("startedLabel")}: {chipRun.firstSeenDate} · {t("lastUpdated")}: {chipRun.lastUpdatedDate}
      </p>
      {chipRun.needsReview && (
        <p className="mt-2 text-sm text-amber-500">
          {t("needsReviewLowConfidence")}{" "}
          {chipRun.llmConfidence != null && `(confidence ${chipRun.llmConfidence.toFixed(2)})`}
        </p>
      )}

      <div className="mt-6">
        <PipelineTimeline stages={chipRun.stages} />
      </div>
    </div>
  );
}
