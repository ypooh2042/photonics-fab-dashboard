import { listChipRuns } from "@/lib/data";
import ChipRunCard from "@/components/ChipRunCard";
import ProjectFilterSelect from "@/components/ProjectFilterSelect";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const allChipRuns = listChipRuns();
  const projects = Array.from(new Map(allChipRuns.map((cr) => [cr.projectSlug, cr.projectName])).entries()).map(
    ([slug, name]) => ({ slug, name }),
  );
  const chipRuns = project ? allChipRuns.filter((cr) => cr.projectSlug === project) : allChipRuns;
  const activeRuns = chipRuns.filter((cr) => cr.status !== "complete");
  const completeRuns = chipRuns.filter((cr) => cr.status === "complete");

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold">칩 진행 상황</h1>
        <ProjectFilterSelect projects={projects} selected={project ?? ""} />
      </div>
      {allChipRuns.length === 0 ? (
        <p className="opacity-60">아직 추적 중인 칩 런이 없습니다.</p>
      ) : chipRuns.length === 0 ? (
        <p className="opacity-60">이 프로젝트에는 칩 런이 없습니다.</p>
      ) : (
        <>
          {activeRuns.length === 0 ? (
            <p className="opacity-60">진행 중인 칩 런이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRuns.map((cr) => (
                <ChipRunCard key={cr.id} chipRun={cr} />
              ))}
            </div>
          )}

          {completeRuns.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium opacity-70 mb-3">완료된 칩 런 목록</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completeRuns.map((cr) => (
                  <ChipRunCard key={cr.id} chipRun={cr} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
