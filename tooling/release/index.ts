// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * 发布链（零第三方依赖，node: 直跑）。
 *
 * 用法：
 *   bun run release status       只读概览：pending changeset、各包本地 vs registry 版本
 *   bun run release version      消费 .changeset/ 条目并刷新锁文件（落地改动）
 *   bun run release build        按包构建（= bun run --filter './packages/*' build）
 *   bun run release test         与门禁同一口径的测试（node --test，用例 glob 见根 package.json）
 *   bun run release publish      逐包发布到 registry（已发布的版本自动跳过）
 *
 * 旗标：
 *   --dry-run      只打印计划，不落盘、不发包（对 publish 尤其有用）
 *   --provenance   npm publish 附带来源证明（CI 的 OIDC 环境下用；本地无 OIDC 时勿加）
 *
 * 设计取舍（本仓按小仓裁剪，不搬旗舰仓的完整发布引擎）：
 *   - **不做拓扑序**：本仓两个包互不依赖，不存在发布先后约束。
 *   - **不做 workspace 协议改写**：本仓纪律本就禁用 `workspace:*`（见 AGENTS.md），
 *     故没有改写对象。但保留**终局断言**：发布前扫描每个包的依赖字段，残留
 *     `workspace:` / `file:` / `link:` 直接失败——这类协议一旦带上就无法回滚。
 *   - **只比对 registry 的实际版本**：不做「所有权预检」与「登录态检查」，登录态
 *     由 npm 自己校验并给出更准确的报错。
 *
 * 幂等性：已发布版本经 registry 比对自动跳过，重跑安全；**例外**是 npm 暂存区中的
 * 版本（不出现在 registry 的 versions 列表里，重跑必 409）。
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { asRecord, listDirs, readJson, relativePosix, repoRoot } from "../lib/fs.ts";

/** 仓库根目录（本脚本位于 tooling/release/ 下）。 */
const ROOT = repoRoot(import.meta.dirname);

/** registry 查询源（可用 NPM_REGISTRY 覆盖，便于对拍私有源）。 */
const REGISTRY = process.env["NPM_REGISTRY"] ?? "https://registry.npmjs.org";

/** 禁止出现在依赖字段里的协议前缀：带上就无法回滚，必须拦在发布之前。 */
const FORBIDDEN_PROTOCOLS = ["workspace:", "file:", "link:"] as const;

/** 依赖字段（四个都扫，devDependencies 也会被打进发布物的 manifest）。 */
const DEP_BLOCKS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
] as const;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const withProvenance = args.includes("--provenance");
const command = args.find((arg) => !arg.startsWith("-"));

function fail(message: string): never {
    console.error(`\n✗ ${message}`);
    process.exit(1);
}

/** 跑一个子进程命令；失败即中断（发布链的每一步都不可降级跳过）。 */
function run(step: string, cmd: string, cmdArgs: string[], cwd = ROOT): void {
    console.log(`\n── ${step}\n   $ ${cmd} ${cmdArgs.join(" ")}`);
    if (dryRun) {
        console.log("   （--dry-run：跳过执行）");
        return;
    }
    const result = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell: false });
    if (result.error) fail(`${step} 无法执行：${String(result.error)}`);
    if (result.status !== 0) fail(`${step} 失败（退出码 ${String(result.status)}）`);
}

interface Pkg {
    /** 相对仓库根的 posix 路径（如 packages/clean-screen/package.json）。 */
    file: string;
    /** 包目录的绝对路径。 */
    dir: string;
    name: string;
    version: string;
    data: Record<string, unknown>;
}

/** 收集 packages/* 下所有可发布包（private 的跳过）。 */
const packages: Pkg[] = [];
for (const name of listDirs(join(ROOT, "packages"))) {
    const dir = join(ROOT, "packages", name);
    const data = asRecord(readJson(join(dir, "package.json")));
    if (!data) fail(`packages/${name}/package.json 无法读取或解析`);
    if (data["private"] === true) continue;
    const pkgName = data["name"];
    const version = data["version"];
    if (typeof pkgName !== "string") fail(`packages/${name}/package.json 缺少 name`);
    if (typeof version !== "string") fail(`packages/${name}/package.json 缺少 version`);
    packages.push({
        file: relativePosix(ROOT, join(dir, "package.json")),
        dir,
        name: String(pkgName),
        version: String(version),
        data,
    });
}
if (packages.length === 0) fail("未发现任何可发布包，检查脚本可能需要调整。");

// ---------------------------------------------------------------- 终局断言

/** 发布前扫描：依赖字段不得残留 workspace / file / link 协议。 */
function assertNoForbiddenProtocols(): void {
    const hits: string[] = [];
    for (const pkg of packages) {
        for (const block of DEP_BLOCKS) {
            const deps = asRecord(pkg.data[block]);
            if (!deps) continue;
            for (const [dep, range] of Object.entries(deps)) {
                if (typeof range !== "string") continue;
                for (const protocol of FORBIDDEN_PROTOCOLS) {
                    if (range.startsWith(protocol)) {
                        hits.push(`${pkg.file} → ${block}.${dep} = "${range}"`);
                    }
                }
            }
        }
    }
    if (hits.length > 0) {
        fail(
            `依赖字段残留不可发布的协议（发布后无法回滚，已中止）：\n${hits.map((hit) => `   - ${hit}`).join("\n")}`,
        );
    }
    console.log(
        `终局断言通过：${packages.length} 个包的依赖字段无 ${FORBIDDEN_PROTOCOLS.join(" / ")} 协议。`,
    );
}

// ---------------------------------------------------------------- registry 侧

/** 某包的已发布版本集合；包从未发布过时返回空集（404 不是错误）。 */
async function publishedVersions(name: string): Promise<Set<string>> {
    // 作用域包的 `/` 必须整体转义（用 replaceAll 而非 replace——后者只换第一处）。
    const encoded = name.replaceAll("/", "%2f");
    const response = await fetch(`${REGISTRY}/${encoded}`, {
        headers: { accept: "application/vnd.npm.install-v1+json" },
    });
    if (response.status === 404) return new Set();
    if (!response.ok) fail(`查询 ${name} 的 registry 版本失败：HTTP ${response.status}`);
    const body = asRecord(await response.json());
    const versions = asRecord(body?.["versions"]);
    return new Set(versions ? Object.keys(versions) : []);
}

// ---------------------------------------------------------------- 子命令

const USAGE = `发布链（详见 docs/process/release.md）

用法：bun run release <status|version|build|test|publish> [--dry-run] [--provenance]`;

/** status：只读概览（不做任何写入，适合本地与 CI 的干跑）。 */
async function status(): Promise<void> {
    const pending = readdirSync(join(ROOT, ".changeset")).filter(
        (name) => name.endsWith(".md") && name !== "README.md",
    );
    console.log(`pending changeset：${pending.length} 条`);
    for (const name of pending.sort()) console.log(`   - .changeset/${name}`);
    console.log("\n本地版本 vs registry：");
    for (const pkg of packages) {
        const published = await publishedVersions(pkg.name);
        const state = published.has(pkg.version)
            ? "已发布（重跑将跳过）"
            : published.size > 0
              ? "待发布"
              : "从未发布（首发，不可回滚）";
        console.log(
            `   ${pkg.name}@${pkg.version}  ${state}（registry 上 ${published.size} 个版本）`,
        );
    }
    if (process.env["ACTIONS_ID_TOKEN_REQUEST_URL"]) {
        console.log("\n检测到 OIDC 环境：走可信发布，无登录态。");
    }
}

/** publish：逐包发布，registry 上已有同版本则跳过。 */
async function publish(): Promise<void> {
    assertNoForbiddenProtocols();

    // 先算清计划再动手：任一包查询失败都在发包之前暴露出来。
    const plan: { pkg: Pkg; action: "publish" | "skip" }[] = [];
    for (const pkg of packages) {
        const published = await publishedVersions(pkg.name);
        plan.push({ pkg, action: published.has(pkg.version) ? "skip" : "publish" });
    }
    console.log("\n发布计划：");
    for (const { pkg, action } of plan) {
        console.log(`   ${action === "skip" ? "跳过" : "发布"}  ${pkg.name}@${pkg.version}`);
    }

    const pubArgs = ["publish", "--access", "public"];
    if (withProvenance) pubArgs.push("--provenance");

    for (const { pkg, action } of plan) {
        if (action === "skip") continue;
        console.log(`\n── 发布 ${pkg.name}@${pkg.version}\n   $ npm ${pubArgs.join(" ")}`);
        if (dryRun) {
            console.log("   （--dry-run：跳过执行）");
            continue;
        }
        const result = spawnSync("npm", pubArgs, {
            cwd: pkg.dir,
            stdio: "inherit",
            shell: false,
        });
        if (result.error) fail(`发布 ${pkg.name} 无法执行：${String(result.error)}`);
        if (result.status !== 0) {
            fail(
                `发布 ${pkg.name}@${pkg.version} 失败（退出码 ${String(result.status)}）。\n` +
                    "   后续包未发布。排查指引见 docs/process/release.md。",
            );
        }
    }
    const toPublish = plan.filter((item) => item.action === "publish").length;
    const skipped = plan.filter((item) => item.action === "skip").length;
    console.log(
        dryRun
            ? `\n（--dry-run：未发包）计划发布 ${toPublish} 个、跳过 ${skipped} 个。`
            : `\n✓ 发布链完成：${toPublish} 个包已发（${skipped} 个跳过）。`,
    );
}

// ---------------------------------------------------------------- 入口

switch (command) {
    case "status":
        await status();
        break;
    case "version":
        run("消费 changeset", "bun", ["run", "changeset", "version"]);
        run("刷新锁文件", "bun", ["install"]);
        break;
    case "build":
        run("按包构建", "bun", ["run", "--filter", "./packages/*", "build"]);
        break;
    case "test":
        run("测试", "node", ["--test", "packages/*/src/**/*.test.ts"]);
        break;
    case "publish":
        await publish();
        break;
    default: {
        // 无参时只打印用法（不算错误），传了未知子命令则退出码置 1。
        console.error(USAGE);
        if (command !== undefined) process.exit(1);
    }
}
