import { getCurrentUser, canAccessOrg } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { status: true, assignee: true, tags: true, properties: true, messages: { orderBy: { createdAt: "asc" }, include: { sender: true } } },
  });
  // staff(社内オペレーター)は担当組織の顧客も開ける(/inbox横断表示からの遷移)
  if (!customer || !canAccessOrg(user, customer.organizationId)) notFound();
  // ステータス・定型文は「顧客の所属組織」のものを使う(staffが他社顧客を開いた場合に自社のではなく)
  const statuses = await prisma.status.findMany({ where: { organizationId: customer.organizationId }, orderBy: { order: "asc" } });
  const templates = await prisma.template.findMany({ where: { organizationId: customer.organizationId, isActive: true }, include: { category: true } });
  return <CustomerDetail customer={customer as any} statuses={statuses} templates={templates as any} currentUser={user} />;
}
