import { test, describe } from "node:test";
import assert from "node:assert";
import {
  sanitizeFilename, extensionOf, validateUpload, validateBatch, formatSize, blobPathname,
  MAX_FILE_BYTES, MAX_FILES_PER_MESSAGE,
} from "./attachment-rules";

// implementation-spec-v1.md §4 F-6 / F-7。
// ここが緩むと「実行ファイルを受け取って社内で開く」「巨大ファイルで送信が丸ごと落ちる」が起きる。

describe("ファイル名の安全化", () => {
  test("パス区切りを潰す（別フォルダに書かせない）", () => {
    assert.strictEqual(sanitizeFilename("../../etc/passwd"), "etc_passwd");
    assert.strictEqual(sanitizeFilename("a\\b\\c.pdf"), "a_b_c.pdf");
  });

  test("先頭のドットと空白を落とす", () => {
    assert.strictEqual(sanitizeFilename("  .env"), "env");
    assert.strictEqual(sanitizeFilename("..hidden.txt"), "hidden.txt");
  });

  test("日本語はそのまま残す", () => {
    assert.strictEqual(sanitizeFilename("契約書_2026.pdf"), "契約書_2026.pdf");
  });

  test("空になったら file にする", () => {
    assert.strictEqual(sanitizeFilename(""), "file");
    assert.strictEqual(sanitizeFilename("..."), "file");
    assert.strictEqual(sanitizeFilename(null as any), "file");
  });

  test("長すぎる名前は拡張子を残して切り詰める", () => {
    const long = "あ".repeat(300) + ".pdf";
    const out = sanitizeFilename(long);
    assert.ok(out.length <= 120, "長さ: " + out.length);
    assert.ok(out.endsWith(".pdf"));
  });

  test("拡張子を取り出せる", () => {
    assert.strictEqual(extensionOf("a.PDF"), "pdf");
    assert.strictEqual(extensionOf("noext"), "");
    assert.strictEqual(extensionOf("trailing."), "");
  });
});

describe("1ファイルの受け入れ判定", () => {
  const ok = { filename: "見積書.pdf", contentType: "application/pdf", size: 1024 };

  test("PDF は受け入れる", () => {
    const r = validateUpload(ok);
    assert.strictEqual(r.kind, "ok");
    if (r.kind === "ok") assert.strictEqual(r.filename, "見積書.pdf");
  });

  test("charset 付きの Content-Type も受け入れる", () => {
    assert.strictEqual(validateUpload({ filename: "a.txt", contentType: "text/plain; charset=utf-8", size: 10 }).kind, "ok");
  });

  test("実行ファイルは Content-Type を偽っても弾く", () => {
    const r = validateUpload({ filename: "invoice.exe", contentType: "application/pdf", size: 10 });
    assert.strictEqual(r.kind, "ng");
  });

  test("許可リストにない種類は弾く", () => {
    assert.strictEqual(validateUpload({ filename: "a.svg", contentType: "image/svg+xml", size: 10 }).kind, "ng");
    assert.strictEqual(validateUpload({ filename: "a.html", contentType: "text/html", size: 10 }).kind, "ng");
  });

  test("空ファイル・サイズ超過は弾く", () => {
    assert.strictEqual(validateUpload({ ...ok, size: 0 }).kind, "ng");
    assert.strictEqual(validateUpload({ ...ok, size: MAX_FILE_BYTES + 1 }).kind, "ng");
    assert.strictEqual(validateUpload({ ...ok, size: MAX_FILE_BYTES }).kind, "ok");
  });

  test("パス遡りのファイル名でも、安全化した名前で通る", () => {
    const r = validateUpload({ filename: "../../secret.pdf", contentType: "application/pdf", size: 10 });
    assert.strictEqual(r.kind, "ok");
    if (r.kind === "ok") assert.ok(!r.filename.includes("/") && !r.filename.includes(".."));
  });
});

describe("1通あたりの制限", () => {
  test("件数の上限", () => {
    assert.strictEqual(validateBatch(new Array(MAX_FILES_PER_MESSAGE).fill(1)).kind, "ok");
    assert.strictEqual(validateBatch(new Array(MAX_FILES_PER_MESSAGE + 1).fill(1)).kind, "ng");
  });

  test("合計サイズの上限", () => {
    assert.strictEqual(validateBatch([10 * 1024 * 1024, 10 * 1024 * 1024]).kind, "ok");
    assert.strictEqual(validateBatch([10 * 1024 * 1024, 10 * 1024 * 1024, 1]).kind, "ng");
  });

  test("添付なしは通る", () => {
    assert.strictEqual(validateBatch([]).kind, "ok");
  });
});

describe("保存先とサイズ表示", () => {
  test("会社ごとに分かれ、乱数が入る", () => {
    const p = blobPathname("org_123", "abcdef", "契約書.pdf");
    assert.strictEqual(p, "attachments/org_123/abcdef/契約書.pdf");
  });

  test("保存先にもパス遡りを持ち込ませない", () => {
    const p = blobPathname("org_123", "abcdef", "../../evil.pdf");
    assert.ok(!p.includes(".."), p);
  });

  test("サイズ表示", () => {
    assert.strictEqual(formatSize(512), "512 B");
    assert.strictEqual(formatSize(2048), "2 KB");
    assert.strictEqual(formatSize(1572864), "1.5 MB");
  });
});
