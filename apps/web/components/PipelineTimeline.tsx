import type { StageInstanceDetail } from "@/lib/data";
import PhotoLightbox from "./PhotoLightbox";
import { getServerLang } from "@/lib/i18n-server";
import { translate, type DictKey } from "@/lib/i18n";

const STAGE_LABEL_KEY: Record<string, DictKey> = {
  cleaning: "stageCleaning",
  resist_coating: "stageResistCoating",
  e_beam_lithography: "stageEbeam",
  development: "stageDevelopment",
  etching: "stageEtching",
  deposition: "stageDeposition",
  dicing: "stageDicing",
  delivery: "stageDelivery",
  other: "stageOther",
};

const STATUS_STYLE: Record<string, { dot: string; textKey: DictKey }> = {
  complete: { dot: "bg-green-500", textKey: "statusComplete" },
  in_progress: { dot: "bg-blue-500", textKey: "statusInProgress" },
  blocked: { dot: "bg-red-500", textKey: "statusBlocked" },
  skipped: { dot: "bg-gray-400", textKey: "statusSkipped" },
  pending: { dot: "bg-gray-300 dark:bg-gray-600", textKey: "statusPending" },
};

export default async function PipelineTimeline({ stages }: { stages: StageInstanceDetail[] }) {
  const lang = await getServerLang();
  const t = (key: DictKey) => translate(key, lang);
  return (
    <ol className="relative border-l border-black/10 dark:border-white/15 ml-2">
      {stages.map((stage) => {
        const style = STATUS_STYLE[stage.status] ?? STATUS_STYLE.pending;
        const stageLabelKey = STAGE_LABEL_KEY[stage.stageType];
        const stageLabel = stageLabelKey ? t(stageLabelKey) : stage.stageType;
        const roundSuffix =
          stage.stageType !== "other" && stage.seq > 1
            ? lang === "ko"
              ? ` (${stage.seq}차)`
              : ` (round ${stage.seq})`
            : "";
        return (
          <li key={stage.id} className="ml-5 pb-6">
            <span
              className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-black ${style.dot}`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">
                {stageLabel}
                {roundSuffix}
              </h3>
              <span className="text-xs opacity-70">{t(style.textKey)}</span>
              {stage.startedDate && (
                <span className="text-xs opacity-50">
                  {stage.startedDate}
                  {stage.completedDate && stage.completedDate !== stage.startedDate
                    ? ` ~ ${stage.completedDate}`
                    : ""}
                </span>
              )}
            </div>
            {stage.label && <p className="text-sm mt-1 opacity-80">{stage.label}</p>}
            {stage.blockedReason && (
              <p className="text-sm mt-1 text-red-500">
                {t("reasonLabel")}: {stage.blockedReason}
              </p>
            )}
            <PhotoLightbox photos={stage.photos} />
          </li>
        );
      })}
    </ol>
  );
}
