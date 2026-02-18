import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { TemplateSettings } from "@/components/settings/template-settings";

export default async function TemplateSettingsPage() {
  const user = await getCurrentUser();
  const categories = await prisma.templateCategory.findMany({ where: { organizationId: user.organizationId }, include: { templates: true }, orderBy: { order: "asc" } });
  return <TemplateSettings categories={categories as any} organizationId={user.organizationId} />;
}
