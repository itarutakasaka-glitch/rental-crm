import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(100),
  email: z.string().email("メールアドレスの形式が正しくありません").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  preferredContact: z.enum(["電話", "メール", "LINE", "どちらでも"]).optional(),
  memo: z.string().max(2000).optional(),
});

export const statusSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "カラーコードの形式が正しくありません"),
  description: z.string().max(200).optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(["EMAIL", "LINE", "SMS"]),
  subject: z.string().max(200).optional(),
  body: z.string().min(1, "本文は必須です").max(5000),
});

export const workflowStepSchema = z.object({
  name: z.string().min(1).max(100),
  daysAfter: z.number().int().min(0).max(365),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  channel: z.enum(["EMAIL", "LINE", "SMS"]),
  templateId: z.string().min(1),
});

export const messageSchema = z.object({
  body: z.string().min(1, "メッセージは必須です").max(5000),
  channel: z.enum(["EMAIL", "LINE", "SMS", "CALL", "NOTE", "VISIT"]),
  subject: z.string().max(200).optional(),
});
