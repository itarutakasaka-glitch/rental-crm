// implementation-spec-v1.md §4 F-6 / F-7: 添付ファイルの受け入れ判定。
//
// 顧客とやりとりするファイルなので、ここを緩めると「実行ファイルを受け取って社内で開く」
// 「巨大ファイルで送信が丸ごと失敗する」が起きる。判定は DB にも Blob にも触らない
// 純粋な関数にして、テストで固定する。

/** 1ファイルの上限。メールの実務でこれを超えるものはリンク共有にしてもらう */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
/** 1通あたりの合計上限。Resend 側の上限に余裕を持たせた値 */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB
/** 1通に付けられる件数 */
export const MAX_FILES_PER_MESSAGE = 10;

/**
 * 受け入れる Content-Type。**許可リスト方式**（拒否リストは抜けが出る）。
 * 実務で使うもの＝画像・PDF・オフィス文書・テキスト・zip に限る。
 */
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip",
];

/** 拡張子で明確に危ないものは、Content-Type が何であっても弾く */
const BLOCKED_EXTENSIONS = [
  "exe", "com", "bat", "cmd", "scr", "pif", "msi", "msp", "cpl", "jar",
  "js", "mjs", "vbs", "vbe", "wsf", "wsh", "ps1", "psm1", "sh", "app",
  "dll", "sys", "hta", "reg", "lnk", "iso", "img",
];

export type UploadCandidate = { filename: string; contentType: string; size: number };
export type ValidationResult = { kind: "ok"; filename: string } | { kind: "ng"; reason: string };

/**
 * 保存に使う安全なファイル名にする。
 * パス区切り・制御文字・先頭のドットを落とし、長すぎる名前を切り詰める。
 * 表示名としてそのまま使うので、日本語はそのまま残す。
 */
export function sanitizeFilename(raw: string): string {
  let name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "") // 制御文字
    .replace(/[\\/]/g, "_") // パス区切り
    .replace(/\.\.+/g, ".") // 連続ドット（.. によるパス遡り）
    .replace(/_{2,}/g, "_") // 区切りを潰した跡の連続アンダースコア
    .replace(/^[._\s]+/, "") // 先頭の区切り・ドット・空白（../ を落とした残り）
    .trim();
  if (!name) name = "file";
  if (name.length > 120) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : "";
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** 1ファイルが受け入れ可能か */
export function validateUpload(file: UploadCandidate): ValidationResult {
  const filename = sanitizeFilename(file.filename);

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { kind: "ng", reason: "ファイルが空です" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { kind: "ng", reason: `1ファイル ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB までです` };
  }

  const ext = extensionOf(filename);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { kind: "ng", reason: `この形式（.${ext}）は添付できません` };
  }

  // "text/plain; charset=utf-8" のようにパラメータが付くことがある
  const type = String(file.contentType || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(type)) {
    return { kind: "ng", reason: `この種類のファイル（${type || "不明"}）は添付できません` };
  }

  return { kind: "ok", filename };
}

export type BatchResult = { kind: "ok" } | { kind: "ng"; reason: string };

/** 1通にまとめて付けられるか（件数と合計サイズ） */
export function validateBatch(sizes: number[]): BatchResult {
  if (sizes.length > MAX_FILES_PER_MESSAGE) {
    return { kind: "ng", reason: `1通に添付できるのは ${MAX_FILES_PER_MESSAGE} 件までです` };
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total > MAX_TOTAL_BYTES) {
    return { kind: "ng", reason: `添付の合計が ${Math.floor(MAX_TOTAL_BYTES / 1024 / 1024)}MB を超えています` };
  }
  return { kind: "ok" };
}

/** 画面表示用のサイズ文字列 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Blob 上の保存先。会社ごとに分け、推測できない乱数を挟む。
 * （URL 自体は外に出さない設計だが、万一漏れても他のファイルを辿れないようにする）
 */
export function blobPathname(organizationId: string, random: string, filename: string): string {
  return `attachments/${organizationId}/${random}/${sanitizeFilename(filename)}`;
}
