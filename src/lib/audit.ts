import { prisma } from "@/lib/db/prisma";

// architecture-v2.md §10 S-4: 監査ログ。「誰が・いつ・どの顧客に・何をしたか」を残す。
// 個人情報保護法の安全管理措置とクライアント監査への備え。過去に遡って作れないので、
// 書き込みは「今日から必ず」行う。監査ログの失敗で本処理を止めない(catchして記録のみ)。
//
// action の命名: "<対象>.<操作>" 例: customer.view / customer.update / customer.record.create /
//   customer.preference.update / customer.merge / schedule.create|update|delete / line.link /
//   message.send|approve|reject / organization.update / template.create|update|delete /
//   workflow.create|update / workflow.run.start|stop / staff.create|update / status.create|update|delete
//
// organizationId(M-4): 会社ごとの監査抽出と保持期間の適用に使う。渡されなければ顧客から導出する。
const MAX_VALUE = 500;
const trunc = (v: unknown) => (v == null ? undefined : String(v).slice(0, MAX_VALUE));

export async function logAudit(data: {
  customerId?: string | null; userId?: string | null; organizationId?: string | null; action: string;
  field?: string; oldValue?: unknown; newValue?: unknown;
}) {
  try {
    let organizationId = data.organizationId || undefined;
    if (!organizationId && data.customerId) {
      const c = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { organizationId: true } });
      organizationId = c?.organizationId;
    }
    await prisma.auditLog.create({
      data: {
        organizationId,
        customerId: data.customerId || undefined,
        userId: data.userId || undefined,
        action: data.action,
        field: data.field,
        oldValue: trunc(data.oldValue),
        newValue: trunc(data.newValue),
      },
    });
  } catch (e) {
    console.error("[audit] failed to write", data.action, e);
  }
}

/** 更新前後のオブジェクトを比較し、変わった項目ごとに1行ずつ記録する。 */
export async function logFieldChanges(base: { customerId?: string | null; userId?: string | null; organizationId?: string | null; action: string },
  before: Record<string, unknown>, after: Record<string, unknown>) {
  for (const key of Object.keys(after)) {
    const b = before[key], a = after[key];
    if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;
    await logAudit({ ...base, field: key, oldValue: b, newValue: a });
  }
}
