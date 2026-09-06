import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// architecture-v2.md §10 S-2: 実在しない組織ID "org_default" の直書きは、同じ型のバグを
// 6回(cron/workflow, statuses, organization, workflows, templates, workflow-run)生んだ。
// 二度と入らないよう、API route / server action に文字列リテラルとして現れたらテストで落とす。
// (コメント行は対象外。組織IDは必ずログインユーザーか顧客レコードから導出する)
function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

test('"org_default" literal must not appear in API routes, server actions or components', () => {
  // 2026-09-06: components でも同じ文字列が URL に埋め込まれていたため対象を広げた
  const roots = [join(process.cwd(), "src/app"), join(process.cwd(), "src/actions"), join(process.cwd(), "src/components")];
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (code.includes('"org_default"') || code.includes("'org_default'")) offenders.push(`${file}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(offenders, [], `org_default literal found:\n${offenders.join("\n")}`);
});
