import { notFound } from "next/navigation";
import { getJob } from "@/lib/chip-layout";
import ChipLayoutPreviewViewer from "@/components/ChipLayoutPreviewViewer";

export default async function ChipLayoutPreviewPage({
  params,
}: {
  params: Promise<{ equipmentUserId: string; jobId: string }>;
}) {
  const { equipmentUserId, jobId } = await params;
  const job = getJob(Number(jobId));
  if (!job) notFound();

  return (
    <ChipLayoutPreviewViewer
      equipmentUserId={Number(equipmentUserId)}
      jobId={job.id}
      jobName={job.name}
      cassetteType={job.cassetteType}
    />
  );
}
