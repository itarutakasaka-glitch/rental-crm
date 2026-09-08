// implementation-spec-v1.md §4 F-3: 会社ごとに「NEW（新規）」のステータスが必ず1つ以上あること。
//
// 新しい反響が入ったとき、顧客は必ず何かのステータスに置かれる。横断集計や受信トレイの
// 「未対応」は systemCategory="NEW" を見ているので、会社から NEW が消えると
// その会社の新規反響が集計にも一覧にも正しく出なくなる。消せる操作を塞ぐ。

export type StatusLike = { id: string; systemCategory: string | null; isDefault?: boolean };

/** 会社が NEW を1つも持たない状態か */
export function hasNoNewStatus(statuses: StatusLike[]): boolean {
  return !statuses.some((s) => s.systemCategory === "NEW");
}

/** その1件を消したら NEW が無くなるか */
export function deleteWouldRemoveLastNew(statuses: StatusLike[], deletingId: string): boolean {
  const rest = statuses.filter((s) => s.id !== deletingId);
  const target = statuses.find((s) => s.id === deletingId);
  if (!target || target.systemCategory !== "NEW") return false;
  return hasNoNewStatus(rest);
}

/** そのカテゴリ変更で NEW が無くなるか（undefined = 変更しない） */
export function categoryChangeWouldRemoveLastNew(
  statuses: StatusLike[],
  id: string,
  nextCategory: string | null | undefined
): boolean {
  if (nextCategory === undefined) return false;
  const target = statuses.find((s) => s.id === id);
  if (!target || target.systemCategory !== "NEW") return false;
  if (nextCategory === "NEW") return false;
  const after = statuses.map((s) => (s.id === id ? { ...s, systemCategory: nextCategory } : s));
  return hasNoNewStatus(after);
}

export const NO_NEW_STATUS_MESSAGE =
  "「新規」のステータスが1つも無くなるため、この操作はできません。先に別のステータスを新規カテゴリに設定してください。";
