import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// implementation-spec-v1.md §6: 会社ごとの外部連携（LINE アクセストークン、Twilio の
// Auth Token 等）を DB に平文で置かないための暗号化。AES-256-GCM。
// 鍵は環境変数 CHANNEL_SECRET_KEY。任意の文字列でよく、SHA-256 で 32 byte に均す
// （base64/hex の 32 byte をそのまま渡してもよい）。
//
// 保存形式: "v1.<iv(base64url)>.<authTag(base64url)>.<ciphertext(base64url)>"
// バージョンを先頭に持つので、後で方式を変えても既存データを読み分けられる。

const VERSION = "v1";

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("CHANNEL_SECRET_KEY が未設定です。会社ごとの連携設定は保存できません");
    this.name = "EncryptionNotConfiguredError";
  }
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.CHANNEL_SECRET_KEY;
}

function getKey(): Buffer {
  const raw = process.env.CHANNEL_SECRET_KEY;
  if (!raw) throw new EncryptionNotConfiguredError();
  // 長さや形式に関わらず 32 byte にする（鍵の作り方で事故らないように）
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); // GCM の推奨は 96bit
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // 鍵が変わった・値が壊れている。**平文として返さない**（誤って送信に使わせない）
    return null;
  }
}

/** 画面に返すためのマスク表示。値そのものは返さない。 */
export function maskSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const plain = decryptSecret(stored);
  if (!plain) return "（復号できません。再入力してください）";
  if (plain.length <= 8) return "********";
  return `${plain.slice(0, 4)}${"*".repeat(Math.min(plain.length - 8, 20))}${plain.slice(-4)}`;
}

/** 秘密情報の一致確認（LINE 署名検証などで使う）。 */
export function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
