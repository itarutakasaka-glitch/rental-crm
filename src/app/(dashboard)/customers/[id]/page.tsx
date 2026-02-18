import { getCurrentUser } from "@/lib/auth";
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
  if (!customer || customer.organizationId !== user.organizationId) notFound();
  const statuses = await prisma.status.findMany({ where: { organizationId: user.organizationId }, orderBy: { order: "asc" } });
  const templates = await prisma.template.findMany({ where: { organizationId: user.organizationId, isActive: true }, include: { category: true } });
  return <CustomerDetail customer={customer as any} statuses={statuses} templates={templates as any} currentUser={user} />;
}
