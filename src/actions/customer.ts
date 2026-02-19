"use server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function createCustomer(data: {
  name: string;
  nameKana?: string;
  email?: string;
  phone?: string;
  sourcePortal?: string;
  inquiryContent?: string;
  memo?: string;
}) {
  try {
    const user = await getCurrentUser();
    const defaultStatus = await prisma.status.findFirst({
      where: { organizationId: user.organizationId, isDefault: true },
    });
    if (!defaultStatus) return { error: "デフォルトステータスが見つかりません" };

    await prisma.customer.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        nameKana: data.nameKana || null,
        email: data.email || null,
        phone: data.phone || null,
        sourcePortal: data.sourcePortal || null,
        inquiryContent: data.inquiryContent || null,
        memo: data.memo || null,
        statusId: defaultStatus.id,
        assigneeId: user.id,
        isNeedAction: true,
      },
    });
    return { success: true };
  } catch (e: unknown) {
    console.error(e);
    return { error: "顧客の登録に失敗しました" };
  }
}
