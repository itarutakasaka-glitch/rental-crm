import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// 2026-09-06: Supabase Auth からの移行。パスワードのハッシュ化を自前で持つ。
// Node標準の scrypt を使う（追加ライブラリを増やさない）。パラメータは OWASP の
// 推奨レンジ（N=2^14, r=8, p=1）。保存形式にパラメータを含めるので、後で強度を
// 上げても既存パスワードを検証できる。
const scrypt = promisify(scryptCb) as (
  password: string | Buffer, salt: string | Buffer, keylen: number, options: any
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024; // 128*N*r = 16MB を超える必要がある

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** 満たしていなければエラーメッセージ、問題なければ null */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "パスワードを入力してください";
  const pw = password.normalize("NFKC");
  if (pw.length < PASSWORD_MIN_LENGTH) return `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`;
  if (pw.length > PASSWORD_MAX_LENGTH) return `パスワードは${PASSWORD_MAX_LENGTH}文字以内にしてください`;
  if (/^\s|\s$/.test(pw)) return "パスワードの先頭・末尾に空白は使えません";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || typeof password !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  try {
    const salt = Buffer.from(parts[4], "base64");
    const key = await scrypt(password.normalize("NFKC"), salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
