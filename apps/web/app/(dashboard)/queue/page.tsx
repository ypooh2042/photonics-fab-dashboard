import QueueTable from "@/components/QueueTable";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function QueuePage() {
  const lang = await getServerLang();
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">{translate("navQueue", lang)}</h1>
      <QueueTable />
    </div>
  );
}
