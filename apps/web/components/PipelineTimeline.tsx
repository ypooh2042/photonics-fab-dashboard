import type { StageInstanceDetail } from "@/lib/data";
import PhotoLightbox from "./PhotoLightbox";

const STAGE_LABEL: Record<string, string> = {
  cleaning: "세정",
  resist_coating: "레지스트 코팅",
  e_beam_lithography: "E-beam 노광",
  development: "현상",
  etching: "식각",
  deposition: "증착",
  dicing: "다이싱",
  delivery: "전달",
  other: "기타",
};

const STATUS_STYLE: Record<string, { dot: string; text: string }> = {
  complete: { dot: "bg-green-500", text: "완료" },
  in_progress: { dot: "bg-blue-500", text: "진행 중" },
  blocked: { dot: "bg-red-500", text: "중단" },
  skipped: { dot: "bg-gray-400", text: "생략" },
  pending: { dot: "bg-gray-300 dark:bg-gray-600", text: "예정" },
};

export default function PipelineTimeline({ stages }: { stages: StageInstanceDetail[] }) {
  return (
    <ol className="relative border-l border-black/10 dark:border-white/15 ml-2">
      {stages.map((stage) => {
        const style = STATUS_STYLE[stage.status] ?? STATUS_STYLE.pending;
        return (
          <li key={stage.id} className="ml-5 pb-6">
            <span
              className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-black ${style.dot}`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">
                {STAGE_LABEL[stage.stageType] ?? stage.stageType}
                {stage.stageType !== "other" && stage.seq > 1 ? ` (${stage.seq}차)` : ""}
              </h3>
              <span className="text-xs opacity-70">{style.text}</span>
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
              <p className="text-sm mt-1 text-red-500">사유: {stage.blockedReason}</p>
            )}
            <PhotoLightbox photos={stage.photos} />
          </li>
        );
      })}
    </ol>
  );
}
