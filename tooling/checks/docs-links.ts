// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * 文档相对链接存活检查（零依赖，node: 直跑）。
 *
 * 用法：bun run check:docs-links（或 node tooling/checks/docs-links.ts）
 *
 * 扫描 docs/ 全部 markdown、根部门面文件（readme.md 与 AGENTS.md）与 .github/
 * 下的 markdown（含 PR 模板目录），校验两件事：
 *   1. 相对链接（含图片与引用式链接）指向的文件 / 目录是否存在；
 *   2. 链接锚点（#fragment）能否在目标文件（或本文件）的标题中找到对应的
 *      GitHub 风格 slug。
 *
 * 外链（http:// / https:// / mailto:）不校验；代码围栏与行内代码中的内容整体
 * 跳过，避免示例链接误报。
 *
 * 名称大小写提醒：根部门面文件在 git 索引里是小写 `readme.md`（Linux / macOS
 * 检出大小写敏感），改名前不要写成 `README.md`，否则本检查在 Linux 上会静默
 * 扫不到该文件。
 *
 * 发现任何问题时退出码置 1。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { relativePosix, repoRoot, walkFiles } from "../lib/fs.ts";

/** 仓库根目录（本脚本位于 tooling/checks/ 下）。 */
const ROOT = repoRoot(import.meta.dirname);

/** 收集目录下全部 .md 文件（跳过 node_modules / lib / dist / coverage）。 */
function collectMarkdown(dir: string): string[] {
    return walkFiles(dir, [".md"]);
}

/** 待检查文件清单：docs 全树 + 根部门面文件 + .github 文档（含 PR 模板目录）。 */
const FILES: string[] = [
    ...collectMarkdown(join(ROOT, "docs")),
    join(ROOT, "readme.md"),
    join(ROOT, "README.md"),
    join(ROOT, "AGENTS.md"),
    ...collectMarkdown(join(ROOT, ".github")),
].filter((file) => existsSync(file));

if (FILES.length === 0) {
    console.error("未匹配到任何待检查 markdown，检查脚本可能需要调整。");
    process.exit(1);
}

/**
 * 生成标题的 GitHub 风格锚点 slug：转小写、删除标点（保留字母数字（含中日韩）、
 * 下划线、连字符与空白）、连续空白折叠为单个连字符。
 */
function githubSlug(heading: string): string {
    return heading
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s+/g, "-");
}

/** 提取 markdown 文件内全部可用锚点（围栏外）：标题 slug 加 HTML 显式锚点。 */
function anchorSlugs(file: string): Set<string> {
    const slugs = new Set<string>();
    if (!existsSync(file)) return slugs;
    let inFence = false;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        if (line.trimStart().startsWith("```")) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (heading) {
            slugs.add(githubSlug(heading[2] ?? ""));
            continue;
        }
        for (const anchor of line.matchAll(/<a\s+id="([^"]+)"/g)) {
            slugs.add(anchor[1] ?? "");
        }
    }
    return slugs;
}

/**
 * 链接相对路径的解析基准目录。GitHub 对 .github 顶层与
 * .github/PULL_REQUEST_TEMPLATE/ 下的社区健康文件（PR 模板等）按仓库根解析
 * 相对链接，其余文件按所在目录解析。
 */
function linkBaseDir(file: string): string {
    const rel = relativePosix(ROOT, file);
    return /^\.github\/(?:[^/]+\.md|PULL_REQUEST_TEMPLATE\/[^/]+\.md)$/.test(rel)
        ? ROOT
        : dirname(file);
}

interface LinkIssue {
    file: string;
    line: number;
    message: string;
}

/** 校验单个链接目标；通过返回 null，否则返回问题描述。 */
function checkTarget(target: string, fromFile: string): string | null {
    if (/^(https?:|mailto:)/i.test(target)) return null;
    const hashIndex = target.indexOf("#");
    const pathPart = hashIndex === -1 ? target : target.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? "" : target.slice(hashIndex + 1);
    let destFile = fromFile;
    if (pathPart !== "") {
        let decoded: string;
        try {
            decoded = decodeURIComponent(pathPart);
        } catch {
            return `链接路径无法 URL 解码：${target}`;
        }
        destFile = resolve(linkBaseDir(fromFile), decoded);
        if (!existsSync(destFile)) return `链接目标不存在：${decoded}`;
    }
    if (anchor === "") return null;
    if (!destFile.endsWith(".md")) return null;
    if (!anchorSlugs(destFile).has(anchor.toLowerCase())) {
        const where = destFile === fromFile ? "本文件" : "目标文件";
        return `锚点 #${anchor} 在${where}的标题中不存在`;
    }
    return null;
}

/** 校验单个 markdown 文件，返回问题列表。 */
function checkFile(file: string): LinkIssue[] {
    const issues: LinkIssue[] = [];
    const relFile = relativePosix(ROOT, file);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    let inFence = false;
    lines.forEach((rawLine, index) => {
        const lineNo = index + 1;
        if (rawLine.trimStart().startsWith("```")) {
            inFence = !inFence;
            return;
        }
        if (inFence) return;
        // 剔除行内代码段，避免示例文本中的方括号被当作链接。
        const line = rawLine.replace(/`[^`]*`/g, "");
        const check = (target: string | undefined) => {
            const problem = checkTarget(target ?? "", file);
            if (problem) issues.push({ file: relFile, line: lineNo, message: problem });
        };
        for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
            check(match[1]);
        }
        for (const match of line.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(\S+)/g)) {
            check(match[1]);
        }
    });
    return issues;
}

const allIssues: LinkIssue[] = [];
for (const file of FILES) allIssues.push(...checkFile(file));

if (allIssues.length === 0) {
    console.log(`文档链接检查通过（${FILES.length} 个文件）。`);
} else {
    for (const issue of allIssues) {
        console.error(`${issue.file}:${issue.line}: ${issue.message}`);
    }
    console.error(`文档链接检查失败：${allIssues.length} 处问题。`);
    process.exitCode = 1;
}
