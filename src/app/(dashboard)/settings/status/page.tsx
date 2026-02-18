import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { StatusSettings } from "@/components/settings/status-settings";

export default async function StatusSettingsPage() {
  const user = await getCurrentUser();
  const statuses = await prisma.status.findMany({ where: { organizationId: user.organizationId }, orderBy: { order: "asc" } });
  return <StatusSettings statuses={statuses} organizationId={user.organizationId} />;
}
