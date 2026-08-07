import { notFound } from "next/navigation";
import { getEquipmentUser } from "@/lib/equipment-users";
import ChipLayoutEditor from "@/components/ChipLayoutEditor";

export default async function ChipLayoutPage({ params }: { params: Promise<{ equipmentUserId: string }> }) {
  const { equipmentUserId } = await params;
  const equipmentUser = getEquipmentUser(Number(equipmentUserId));
  if (!equipmentUser) notFound();

  return (
    <ChipLayoutEditor
      equipmentUserId={equipmentUser.id}
      equipmentUserName={equipmentUser.name}
      equipmentUserAlias={equipmentUser.alias}
      defaultLoadingCostMinutes={equipmentUser.loadingCostMinutes}
    />
  );
}
