// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "koishi";
import type {} from "koishi-plugin-puppeteer";
import type { Config } from "./config.ts";
import type { DiffItem } from "./types.ts";

/**
 * 模板由 tsdown 的 copy 选项在构建时复制到 lib/ 下，运行时从产物同目录读取。
 *
 * 路径用 import.meta.url 表达而非 __dirname：产物同时有 .cjs 与 .mjs，而
 * rolldown 会在 CJS 输出里把 import.meta.url 改写成等价的 __filename 表达，
 * 于是这一种写法在两种产物中都成立，不必按格式分支。
 */
const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(resolve(here, "template.html"), "utf-8");

const TIME_LOCALE_MAP: Record<string, string> = {
    zh: "zh-CN",
    en: "en-US",
};

interface DiffTexts {
    title: string;
    textTitle: string;
    added: string;
    updated: string;
    deleted: string;
    footer: string;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderItem(item: DiffItem, tags: Record<DiffItem["type"], string>): string {
    let version = "";
    if (item.type === "updated" && item.version1 && item.version2) {
        version = `<div class="item-version">${escapeHtml(item.version1)}<span class="arrow">→</span><span class="new">${escapeHtml(item.version2)}</span></div>`;
    }
    let desc = "";
    if (item.description) {
        desc = `<div class="item-desc">${escapeHtml(item.description)}</div>`;
    }
    let publisher = "";
    if (item.publisher) {
        publisher = `<div class="item-publisher">@${escapeHtml(item.publisher)}</div>`;
    }
    return `<div class="item ${item.type}">
          <span class="item-tag">${escapeHtml(tags[item.type])}</span>
          <div class="item-body">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${version}${desc}${publisher}
          </div>
        </div>`;
}

function buildDiffHtml(
    items: DiffItem[],
    timestamp: Date,
    texts: DiffTexts,
    timeLocale: string,
    tags: Record<DiffItem["type"], string>,
): string {
    const timeStr = timestamp.toLocaleString(timeLocale, {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
    const added = items.filter((i) => i.type === "added").length;
    const updated = items.filter((i) => i.type === "updated").length;
    const deleted = items.filter((i) => i.type === "deleted").length;

    return template
        .replace(/<!--title-->/g, () => escapeHtml(texts.title))
        .replace(/<!--time-->/g, () => timeStr)
        .replace(/<!--label-added-->/g, () => escapeHtml(texts.added))
        .replace(/<!--label-updated-->/g, () => escapeHtml(texts.updated))
        .replace(/<!--label-deleted-->/g, () => escapeHtml(texts.deleted))
        .replace(/<!--added-->/g, () => String(added))
        .replace(/<!--updated-->/g, () => String(updated))
        .replace(/<!--deleted-->/g, () => String(deleted))
        .replace(/<!--items-->/g, () => items.map((i) => renderItem(i, tags)).join(""))
        .replace(/<!--footer-->/g, () => escapeHtml(texts.footer));
}

function formatDiffText(items: DiffItem[], tags: Record<DiffItem["type"], string>): string {
    return items
        .map((item) => {
            if (item.type === "added") {
                let output = `${tags.added}: ${item.name}`;
                if (item.publisher) output += ` (@${item.publisher})`;
                if (item.description) output += `\n  ${item.description}`;
                return output;
            }
            if (item.type === "updated") {
                return `${tags.updated}: ${item.name} (${item.version1} → ${item.version2})`;
            }
            return `${tags.deleted}: ${item.name}`;
        })
        .join("\n");
}

export async function renderDiff(ctx: Context, items: DiffItem[], config: Config): Promise<string> {
    const locale = ctx.i18n.fallback([])[0] ?? "zh";
    const t = (path: string, params?: unknown) => ctx.i18n.text([locale], [path], params ?? []);

    const tags: Record<DiffItem["type"], string> = {
        added: t("market-tracker.added"),
        updated: t("market-tracker.updated"),
        deleted: t("market-tracker.deleted"),
    };

    if (config.renderImage) {
        try {
            const texts: DiffTexts = {
                title: t("market-tracker.title"),
                textTitle: t("market-tracker.text-title"),
                added: tags.added,
                updated: tags.updated,
                deleted: tags.deleted,
                footer: t("market-tracker.footer", [items.length]),
            };
            const timeLocale = TIME_LOCALE_MAP[locale] ?? "en-US";
            const html = buildDiffHtml(items, new Date(), texts, timeLocale, tags);
            return await ctx.puppeteer.render(html, async (page, next) => {
                await page.setViewport({
                    width: 600,
                    height: 800,
                    deviceScaleFactor: 2,
                });
                return next((await page.$(".container")) ?? undefined);
            });
        } catch (error) {
            ctx.logger("market-tracker").warn("图片渲染失败，回退到文本模式", error);
        }
    }
    return `${t("market-tracker.text-title")}\n${formatDiffText(items, tags)}`;
}
