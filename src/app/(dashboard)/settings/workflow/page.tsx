import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { WorkflowSettings } from "@/components/settings/workflow-settings";

export default async function WorkflowSettingsPage() {
  const user = await getCurrentUser();
  const workflows = await prisma.workflow.findMany({ where: { organizationId: user.organizationId }, include: { steps: { orderBy: { order: "asc" }, include: { template: true } } } });
  const templates = await prisma.template.findMany({ where: { organizationId: user.organizationId, isActive: true } });
  return <WorkflowSettings workflows={workflows as any} templates={templates} />;
}
