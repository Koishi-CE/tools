// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * SPDX 许可证头门禁（零依赖，node: 直跑）。
 *
 * 用法：bun run check:spdx（或 node tooling/checks/spdx.ts）
 *
 * 检查**手写源码**是否带 SPDX 许可证标识头：
 *
 *   // SPDX-License-Identifier: MIT
 *
 * 扫描面：
 *   - packages 下各包的源码与测试（`packages/<包>/src/**`，.ts/.mts/.cts）；
 *   - 各包的 tsdown 构建配置（`packages/<包>/tsdown.config.ts`）；
 *   - 本目录的工程脚本（`tooling/**`，.ts/.mts/.cts）；
 *   - 根类型声明（`types/**`，.d.ts）。
 *
 * 明确豁免（不扫）：生成物 `lib/**` / `dist/**`（tsdown 产出的 .mjs / .cjs /
 * .d.ts 无头，属正常）、第三方区 `node_modules/**`、覆盖率目录 `coverage/**`。
 *
 * 只校验 SPDX 标识符，**不**校验版权行：版权归属随文件来源而不同（本仓自研
 * 文件是「Oppenheymu and Koishi-CE contributors」），强行统一会抹掉署名。
 * 标识符的检查窗口为文件前 3 行（留出 shebang 与 BOM 的余地）。
 *
 * 发现任何问题时退出码置 1。
 */
import { relative, resolve } from "node:path";
import { DEFAULT_SKIP_DIRS, readText, toPosix, walkFiles } from "../lib/fs.ts";

/** 仓库根目录（本脚本位于 tooling/checks/ 下）。 */
const ROOT = resolve(import.meta.dirname, "../..");

/** 许可证标识（本仓统一 MIT）。 */
const LICENSE_ID = "SPDX-License-Identifier: MIT";

/** 头部检查窗口：前 3 行内出现即算合规。 */
const HEAD_LINES = 3;

const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts"] as const;

/** 检查面：逐目录收集，便于输出里保留来源分类。 */
const GLOBS: { dir: string; extensions: readonly string[] }[] = [
    { dir: "packages", extensions: SOURCE_EXTENSIONS },
    { dir: "tooling", extensions: SOURCE_EXTENSIONS },
    { dir: "types", extensions: [".d.ts"] },
];

const files: string[] = [];
for (const { dir, extensions } of GLOBS) {
    for (const abs of walkFiles(resolve(ROOT, dir), extensions, DEFAULT_SKIP_DIRS)) {
        files.push(toPosix(relative(ROOT, abs)));
    }
}

if (files.length === 0) {
    console.error("未匹配到任何待检查文件，检查脚本可能需要调整。");
    process.exit(1);
}

const problems: string[] = [];
for (const file of files.sort()) {
    const text = readText(resolve(ROOT, file));
    if (text === null) continue;
    const head = text.split(/\r?\n/).slice(0, HEAD_LINES);
    if (head.some((line) => line.includes(LICENSE_ID))) continue;
    problems.push(`${file}：缺少 SPDX 许可证标识（前 ${HEAD_LINES} 行内未找到 "${LICENSE_ID}"）`);
}

if (problems.length > 0) {
    console.error(`SPDX 头检查发现 ${problems.length} 个问题：`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}
console.log(
    `SPDX 头检查通过：${files.length} 个手写源文件均带许可证头（生成物 lib/dist 与 node_modules 已豁免）。`,
);
