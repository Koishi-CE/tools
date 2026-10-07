// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * 词典门禁（零依赖，node: 直跑）。
 *
 * 用法：bun run check:locales（或 node tooling/checks/locales.ts）
 *
 * 逐个检查 packages 下各包的 locales 目录（基准语种为 `zh_CN`）：
 *
 *   1. 键对齐：目录内其他语种的键路径集合必须与基准 zh_CN.yml 逐键一致
 *      （缺失 / 多余键均报告；数组下标也参与键路径，保证列表形态同构）；
 *   2. 假翻译：拉丁 / 西里尔语种的叶子值若仍含汉字即视为占位（本仓当前只有
 *      `en`，基线语种与中日韩语种不参与此项——按字形分不出真伪）；
 *   3. 存在但未 import：locales 目录内每个 yml 都必须被**同包源码** import。
 *      词典文件躺在磁盘上却没进 ctx.i18n.define() 时运行时不会有任何报错，
 *      只是该语种静默缺失，故在门禁层面按「文件 → import 语句」对账。
 *
 * 与参照仓的差异（本仓按实际规模裁剪）：
 *   - **不要求语种齐全**：本仓词典只有 `zh_CN` + `en` 两个语种，不设七语种门槛，
 *     新增语种只做键对齐与假翻译检查；
 *   - **不校验 `koishi.locales` 声明**：本仓包内该字段仅用于描述语种展示，
 *     与磁盘文件的对应关系尚不稳定，纳入检查会制造无谓的假红。
 *
 * 发现任何问题时退出码置 1。
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listDirs, readText, relativePosix, repoRoot, walkFiles } from "../lib/fs.ts";
import { extractKeyPaths, parseYaml, walkLeaves } from "../lib/yaml.ts";

/** 仓库根目录（本脚本位于 tooling/checks/ 下）。 */
const ROOT = repoRoot(import.meta.dirname);

/** 基准语种：其余语种的键路径都与它对齐。 */
const BASE_LOCALE = "zh_CN";

/** 参与假翻译检测的语种（拉丁 / 西里尔书写；中日韩无法按字形判真伪）。 */
const LATIN_LOCALES = new Set(["en", "en-US", "fr", "fr-FR", "de", "de-DE", "ru", "ru-RU", "es"]);

/** 源码扩展名（测试文件同样计入：它们也会 import 词典）。 */
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts"] as const;

/** 词典被源码 import 的形态：`from "../locales/<文件名>.yml"`。 */
const IMPORT_RE = /from\s*["']([^"']*\blocales\/[^"']+\.ya?ml)["']/g;

/** 判断文本是否含汉字。 */
function containsChinese(text: string): boolean {
    return /[\u4e00-\u9fa5]/.test(text);
}

const problems: string[] = [];

// ---------------------------------------------------------------------------
// 收集带词典的包
// ---------------------------------------------------------------------------

const packagesDir = join(ROOT, "packages");
const localeDirs: string[] = [];
for (const name of listDirs(packagesDir)) {
    const dir = join(packagesDir, name, "locales");
    if (existsSync(dir)) localeDirs.push(dir);
}

if (localeDirs.length === 0) {
    console.error("未找到任何 packages/*/locales 目录，检查脚本可能需要调整。");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 逐个词典目录检查
// ---------------------------------------------------------------------------

for (const dir of localeDirs) {
    const relDir = relativePosix(ROOT, dir);
    const pkgDir = relDir.replace(/\/locales$/, "");
    const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
    const present = new Set(files.map((name) => name.replace(/\.ya?ml$/, "")));

    if (!present.has(BASE_LOCALE)) {
        problems.push(`${relDir}：缺少基准文件 ${BASE_LOCALE}.yml`);
        continue;
    }

    const baseParsed = parseYaml(readText(join(dir, `${BASE_LOCALE}.yml`)) ?? "");
    const baseKeys = extractKeyPaths(baseParsed);

    for (const locale of present) {
        if (locale === BASE_LOCALE) continue;
        const relFile = `${relDir}/${locale}.yml`;
        const parsed = parseYaml(readText(join(dir, `${locale}.yml`)) ?? "");
        const keys = extractKeyPaths(parsed);

        for (const key of baseKeys) {
            if (!keys.has(key)) problems.push(`${relFile}：缺少键 ${key}`);
        }
        for (const key of keys) {
            if (!baseKeys.has(key)) problems.push(`${relFile}：多余键 ${key}`);
        }

        if (!LATIN_LOCALES.has(locale)) continue;
        walkLeaves(parsed, (path, leaf) => {
            if (typeof leaf === "string" && containsChinese(leaf)) {
                problems.push(`${relFile}：键 ${path} 疑似假翻译（值仍为中文）`);
            }
        });
    }

    // ---- 存在但未 import：同包源码对账 ----
    const imported = new Set<string>();
    for (const abs of walkFiles(join(ROOT, pkgDir, "src"), SOURCE_EXTENSIONS)) {
        const text = readText(abs);
        if (text === null) continue;
        for (const match of text.matchAll(IMPORT_RE)) {
            const specifier = match[1];
            if (!specifier) continue;
            imported.add(specifier.slice(specifier.lastIndexOf("/") + 1));
        }
    }
    for (const file of files) {
        if (imported.has(file)) continue;
        problems.push(
            `${relDir}/${file}：存在但未被同包源码 import（该语种不会进 ctx.i18n.define()，也不会被内联进产物）`,
        );
    }
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

if (problems.length > 0) {
    console.error(`词典检查发现 ${problems.length} 个问题：`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}
console.log(
    `词典检查通过：${localeDirs.length} 个词典目录（键对齐 / 假翻译 / import 对账均无问题）。`,
);
