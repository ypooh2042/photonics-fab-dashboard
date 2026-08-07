import QueueTable from "@/components/QueueTable";

export default function QueuePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">노광 큐</h1>
      <QueueTable />
    </div>
  );
}
