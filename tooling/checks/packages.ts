// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * workspace 包元数据与依赖纪律门禁（零依赖，node: 直跑）。
 *
 * 用法：bun run check:packages（或 node tooling/checks/packages.ts）
 *
 * 把 AGENTS.md「基本约束」中靠人工遵守的规矩固化为自动检查，共六类：
 *
 *   1. 包名纪律：`name` 一律 `koishi-plugin-*`，不得使用 `@koishi-ce/` /
 *      `@koishijs/` 作用域——本仓面向通用 Koishi 宿主，包名必须能被任何
 *      Koishi 用户直接安装；
 *   2. peer 契约：`peerDependencies` 必须声明官方 `koishi`（不得写
 *      `@koishi-ce/koishi`），range 不得为空、`*` 或 `latest`；
 *   3. 元数据统一：顶层类型字段一律 `types`，不混用旧别名 `typings`；
 *   4. 双产物形态：`type: "module"`、`main` 指向 `.cjs`、`exports` 同时提供
 *      `import`（`.mjs`）与 `require`（`.cjs`）条件，且 `types` 条件排在首位
 *      （条件对象按书写顺序匹配，types 不在最前会被运行时条件抢先）；
 *   5. 依赖协议：四个依赖字段不得出现 `workspace:` / `file:` / `link:`——
 *      changeset publish 不改写这些协议，原样上 npm 会炸下游且无法回滚；
 *   6. 源码导入纪律：`packages/<包>/src` 不得 import `@koishi-ce/*`（规则 1 的
 *      源码侧对账）。`@koishijs/*` 不在此列——类型包（如 `@koishijs/registry`）
 *      作为 devDependency 是本仓的正当依赖，运行时上游包由各包的依赖声明把关。
 *
 * 经评估**不**纳入检查的项：
 *   - `sideEffects` 字段——产物为 bundle 单文件，逐包判断误摇风险的成本高于收益；
 *   - 版本号一致性——各包独立版本，由 changesets 管理。
 *
 * 发现任何问题时退出码置 1。
 */
import { join } from "node:path";
import {
    asRecord,
    lineOfOffset,
    listDirs,
    readJson,
    readText,
    relativePosix,
    repoRoot,
    walkFiles,
} from "../lib/fs.ts";

/** 仓库根目录（本脚本位于 tooling/checks/ 下）。 */
const ROOT = repoRoot(import.meta.dirname);

/** 依赖字段（四个都扫，其中两个会被写进发布物的 manifest）。 */
const DEP_BLOCKS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
] as const;

/** 禁止出现在依赖字段里的协议前缀：带上就无法回滚，必须拦在发布之前。 */
const FORBIDDEN_PROTOCOLS = ["workspace:", "file:", "link:"] as const;

/** peer 契约要求的宿主包名（官方 Koishi，不是 Koishi-CE 的 fork）。 */
const HOST_PEER = "koishi";

/** 违规项：目标（文件或 文件:行）+ 一行描述。 */
const issues: string[] = [];
function report(target: string, message: string): void {
    issues.push(`${target}\n    ${message}`);
}

interface PackageJson {
    name?: unknown;
    type?: unknown;
    main?: unknown;
    module?: unknown;
    exports?: unknown;
    peerDependencies?: unknown;
    [key: string]: unknown;
}

interface WorkspacePackage {
    /** 相对仓库根的 posix 路径（如 packages/clean-screen/package.json）。 */
    file: string;
    /** 包目录的相对 posix 前缀（如 packages/clean-screen）。 */
    dir: string;
    name: string;
    data: PackageJson;
}

// ---------------------------------------------------------------------------
// 收集 workspace 包（packages/<包> 直接子目录）
// ---------------------------------------------------------------------------

const packages: WorkspacePackage[] = [];
for (const name of listDirs(join(ROOT, "packages"))) {
    const dir = `packages/${name}`;
    const file = `${dir}/package.json`;
    const data = asRecord(readJson(join(ROOT, file)));
    if (!data) {
        report(file, "无法读取或解析 package.json");
        continue;
    }
    packages.push({
        file,
        dir,
        name: typeof data.name === "string" ? data.name : "(无名)",
        data: data as PackageJson,
    });
}

if (packages.length === 0) {
    console.error("未发现任何 packages/* 子包，检查脚本可能需要调整。");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 检查 1：包名纪律
// ---------------------------------------------------------------------------

const PACKAGE_NAME_RE = /^koishi-plugin-[a-z0-9-]+$/;

for (const pkg of packages) {
    if (!PACKAGE_NAME_RE.test(pkg.name)) {
        report(
            pkg.file,
            `包名纪律：name "${pkg.name}" 不符合 koishi-plugin-<小写短横线名> 形态（本仓不使用 @koishi-ce / @koishijs 作用域）`,
        );
    }
}

// ---------------------------------------------------------------------------
// 检查 2：peer 契约
// ---------------------------------------------------------------------------

for (const pkg of packages) {
    const peer = asRecord(pkg.data.peerDependencies);
    if (!peer) {
        report(pkg.file, `peer 契约：缺少 peerDependencies（至少应声明 ${HOST_PEER}）`);
        continue;
    }
    for (const dep of Object.keys(peer)) {
        if (dep === HOST_PEER) continue;
        if (dep.startsWith("@koishi-ce/")) {
            report(
                pkg.file,
                `peer 契约：peerDependencies 指向 "${dep}"——本仓面向通用 Koishi 宿主，peer 只应声明官方 ${HOST_PEER}`,
            );
        }
    }
    const range = peer[HOST_PEER];
    if (typeof range !== "string" || range.trim() === "") {
        report(pkg.file, `peer 契约：peerDependencies 未声明 ${HOST_PEER} 的版本范围`);
    } else if (range === "*" || range === "latest") {
        report(pkg.file, `peer 契约：${HOST_PEER} 的 range 为 "${range}"，须写明 ^4.x 语义化范围`);
    }
}

// ---------------------------------------------------------------------------
// 检查 3：元数据统一
// ---------------------------------------------------------------------------

for (const pkg of packages) {
    if ("typings" in pkg.data) {
        report(pkg.file, "元数据统一：顶层类型字段用了旧别名 typings，应统一为 types");
    }
}

// ---------------------------------------------------------------------------
// 检查 4：双产物形态
// ---------------------------------------------------------------------------

/** 递归查 exports 条件树里某个条件的取值。 */
function findCondition(value: unknown, key: string): unknown {
    const record = asRecord(value);
    if (!record) return undefined;
    if (key in record) return record[key];
    for (const child of Object.values(record)) {
        const found = findCondition(child, key);
        if (found !== undefined) return found;
    }
    return undefined;
}

/** exports 的条件对象里，键的书写顺序（用于校验 types 是否排首位）。 */
function firstConditionKey(value: unknown): string | null {
    const record = asRecord(value);
    if (!record) return null;
    return Object.keys(record)[0] ?? null;
}

for (const pkg of packages) {
    if (pkg.data.type !== "module") {
        const actual = typeof pkg.data.type === "string" ? `"${pkg.data.type}"` : "未声明";
        report(pkg.file, `双产物：type 应为 "module"（实为 ${actual}）`);
    }
    if (typeof pkg.data.main !== "string" || !pkg.data.main.endsWith(".cjs")) {
        report(pkg.file, `双产物：main 应指向 .cjs（实为 ${JSON.stringify(pkg.data.main)}）`);
    }
    if (typeof pkg.data.module !== "string" || !pkg.data.module.endsWith(".mjs")) {
        report(pkg.file, `双产物：module 应指向 .mjs（实为 ${JSON.stringify(pkg.data.module)}）`);
    }
    const root = asRecord(pkg.data.exports)?.["."];
    if (!root) {
        report(pkg.file, '双产物：exports 缺少 "." 入口');
        continue;
    }
    const importTarget = findCondition(root, "import");
    if (typeof importTarget !== "string" || !importTarget.endsWith(".mjs")) {
        report(
            pkg.file,
            `双产物：exports 的 import 条件应指向 .mjs（实为 ${JSON.stringify(importTarget)}）`,
        );
    }
    const requireTarget = findCondition(root, "require");
    if (typeof requireTarget !== "string" || !requireTarget.endsWith(".cjs")) {
        report(
            pkg.file,
            `双产物：exports 的 require 条件应指向 .cjs（实为 ${JSON.stringify(requireTarget)}）`,
        );
    }
    if (firstConditionKey(root) !== "types") {
        report(
            pkg.file,
            `双产物：exports["."] 的首个条件应为 types（实为 ${JSON.stringify(firstConditionKey(root))}）——条件按书写顺序匹配，types 不在最前会被运行时条件抢先`,
        );
    }
}

// ---------------------------------------------------------------------------
// 检查 5：依赖协议
// ---------------------------------------------------------------------------

for (const pkg of packages) {
    for (const block of DEP_BLOCKS) {
        const deps = asRecord(pkg.data[block]);
        if (!deps) continue;
        for (const [dep, range] of Object.entries(deps)) {
            if (typeof range !== "string") continue;
            for (const protocol of FORBIDDEN_PROTOCOLS) {
                if (!range.startsWith(protocol)) continue;
                report(
                    pkg.file,
                    `依赖协议：${block}.${dep} = "${range}"——workspace 协议不会被 changeset publish 改写，原样上 npm 会炸下游`,
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 检查 6：源码导入纪律
// ---------------------------------------------------------------------------

/**
 * 源码里被禁的导入目标：`@koishi-ce/*` 命名空间。
 *
 * `@koishijs/*` 不在禁列：类型包（如 `@koishijs/registry`）作为 devDependency 是
 * 本仓的正当依赖，一并禁掉会误伤；运行时上游包由各包的依赖声明人工把关。
 */
const FORBIDDEN_IMPORT_RE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(["'])(@koishi-ce\/[^"']*)\1/g;

const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts"] as const;

for (const abs of walkFiles(join(ROOT, "packages"), SOURCE_EXTENSIONS)) {
    const file = relativePosix(ROOT, abs);
    if (!file.includes("/src/")) continue;
    const text = readText(abs);
    if (text === null) continue;
    for (const match of text.matchAll(FORBIDDEN_IMPORT_RE)) {
        report(
            `${file}:${lineOfOffset(text, match.index ?? 0)}`,
            `源码导入纪律：import "${match[2] ?? ""}"——本仓面向通用 Koishi 宿主，源码不得导入 @koishi-ce/*`,
        );
    }
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

if (issues.length > 0) {
    console.error(`check:packages 发现 ${issues.length} 处违规：\n`);
    for (const issue of issues) console.error(issue);
    process.exit(1);
}
console.log(
    `check:packages 通过：${packages.length} 个包（${packages.map((pkg) => pkg.name).join(" / ")}）元数据与依赖纪律无违规。`,
);
