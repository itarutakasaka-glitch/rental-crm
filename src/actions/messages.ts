"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function sendMessageAction(data: {
  customerId: string; senderId?: string; channel: string; subject?: string; body: string;
}) {
  const message = await prisma.message.create({
    data: {
      customerId: data.customerId, senderId: data.senderId,
      direction: "OUTBOUND", channel: data.channel as any,
      subject: data.subject, body: data.body, status: "SENT",
    },
  });
  await prisma.customer.update({
    where: { id: data.customerId },
    data: { lastContactAt: new Date(), lastActiveAt: new Date() },
  });
  revalidatePath(`/customers/${data.customerId}`);
  return message;
}
