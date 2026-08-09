import { notFound } from "next/navigation";
import { getChipRunDetail } from "@/lib/data";
import ChipRunAdminEditor from "@/components/ChipRunAdminEditor";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function AdminChipRunEditPage({
  params,
}: {
  params: Promise<{ chipRunId: string }>;
}) {
  const { chipRunId } = await params;
  const chipRun = getChipRunDetail(Number(chipRunId));
  if (!chipRun) notFound();
  const lang = await getServerLang();

  return (
    <div className="max-w-2xl">
      <p className="text-xs opacity-60">{chipRun.projectName}</p>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-semibold">{chipRun.label}</h1>
        <span className="text-xs rounded-full border border-amber-500/40 text-amber-500 px-2 py-0.5">
          {translate("edit", lang)}
        </span>
      </div>
      <ChipRunAdminEditor chipRun={chipRun} />
    </div>
  );
}
