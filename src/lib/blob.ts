import { put, del } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { blobPathname } from "@/lib/attachment-rules";

// implementation-spec-v1.md §4 F-6 / F-7: 添付ファイルの実体置き場（Vercel Blob）。
//
// import しただけで例外を投げないこと（lib/resend.ts と同じ方針）。
// BLOB_READ_WRITE_TOKEN が未設定でもアプリは起動し、添付だけが使えない状態にする。
// 未設定のまま送信経路が 500 になるのが一番わかりにくいので、呼び出し側で判定できるようにする。

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export class BlobNotConfiguredError extends Error {
  constructor() {
    super("添付ファイルの保存先（Vercel Blob）が未設定です");
    this.name = "BlobNotConfiguredError";
  }
}

export type StoredBlob = { url: string; pathname: string };

/**
 * 会社ごとのフォルダに、乱数を挟んで保存する。
 * `addRandomSuffix: false` にして、こちらが決めたパスをそのまま使う
 * （同名ファイルの衝突は乱数フォルダで避ける）。
 */
export async function putAttachment(params: {
  organizationId: string;
  filename: string;
  contentType: string;
  body: Buffer | Uint8Array | ArrayBuffer;
}): Promise<StoredBlob> {
  if (!isBlobConfigured()) throw new BlobNotConfiguredError();
  const pathname = blobPathname(params.organizationId, randomBytes(12).toString("hex"), params.filename);
  const res = await put(pathname, params.body as any, {
    access: "public", // Blob の公開URLは外に出さず、認証付きの配信経路からのみ読む
    contentType: params.contentType,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return { url: res.url, pathname: res.pathname };
}

export async function deleteAttachment(url: string): Promise<void> {
  if (!isBlobConfigured()) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (e: any) {
    // 実体の削除失敗で DB 側の整理を止めない（孤児は残るが、参照は消える）
    console.error("[blob] delete failed:", e?.message || e);
  }
}

/** 配信用に実体を取り出す。URL は呼び出し側の外に出さないこと。 */
export async function fetchAttachmentBody(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    console.error("[blob] fetch failed:", e?.message || e);
    return null;
  }
}
