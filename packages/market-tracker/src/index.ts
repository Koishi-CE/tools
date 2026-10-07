// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { SearchObject, SearchResult } from "@koishijs/registry";
import type { Context, Dict } from "koishi";
import en from "../locales/en.yml";
import zhCN from "../locales/zh_CN.yml";
import { Config } from "./config.ts";
import { computeDiff } from "./diff.ts";
import { renderDiff } from "./render.ts";
import type { DiffItem } from "./types.ts";

export { Config };

export const name = "market-tracker";

export const usage = `
<style>
  .mt-radio-zh, .mt-radio-en { display: none; }
  .mt-content-en { display: none; }
  .mt-radio-en:checked ~ .mt-content-zh { display: none; }
  .mt-radio-en:checked ~ .mt-content-en { display: block; }
  .mt-lang-switch { text-align: right; margin-bottom: 16px; user-select: none; }
  .mt-lang-switch label {
    display: inline-block;
    padding: 4px 14px;
    font-size: 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    background: #fff;
    color: #666;
    margin-left: 8px;
    transition: all 0.2s;
  }
  .mt-lang-switch label:hover { border-color: #4a6ee0; color: #4a6ee0; }
  .mt-radio-zh:checked ~ .mt-lang-switch label[for="mt-zh"],
  .mt-radio-en:checked ~ .mt-lang-switch label[for="mt-en"] {
    background: #4a6ee0; color: #fff; border-color: #4a6ee0;
  }
</style>
<input type="radio" name="mt-lang" id="mt-zh" class="mt-radio-zh" checked>
<input type="radio" name="mt-lang" id="mt-en" class="mt-radio-en">
<div class="mt-lang-switch">
  <label for="mt-zh">🇨🇳 中文</label>
  <label for="mt-en">🇬🇧 English</label>
</div>

<div class="mt-content-zh">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #722ed1;">📦 插件介绍</h2>
    <p>追踪 Koishi 插件市场的新增、更新与删除，自动将变更推送到你指定的群/频道。</p>
    <p>支持图片渲染（需装puppeteer）与纯文本两种模式，可自定义显示隐藏插件、发布者、描述等信息。</p>
  </div>
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #52c41a;">🙏 鸣谢</h2>
    <p>本项目由官方插件 <a href="https://github.com/koishijs/koishi-plugin-market-info#readme" style="color:#52c41a;text-decoration:none;"><strong>koishi-plugin-market-info</strong></a> 改进，特此鸣谢</p>
  </div>
</div>

<div class="mt-content-en">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #722ed1;">📦 Introduction</h2>
    <p>Track additions, updates, and removals in the Koishi plugin market, and automatically push changes to your configured groups/channels.</p>
    <p>Supports image rendering (requires puppeteer) and plain text modes, with customizable display of hidden plugins, publishers, descriptions, etc.</p>
  </div>
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #52c41a;">🙏 Credits</h2>
    <p>Improved from the official plugin <a href="https://github.com/koishijs/koishi-plugin-market-info#readme" style="color:#52c41a;text-decoration:none;"><strong>koishi-plugin-market-info</strong></a>. Special thanks.</p>
  </div>
</div>
`;

export const inject = {
    required: ["database", "cron"],
    optional: ["puppeteer"],
};

function describeError(error: unknown): string {
    if (error instanceof Error) {
        const cause = error.cause;
        if (cause instanceof Error) return `${error.message}: ${cause.message}`;
        return error.message;
    }
    return String(error);
}

export function apply(ctx: Context, config: Config) {
    // locales 为 .yml 静态导入：构建时由 @rollup/plugin-yaml 解析内联进产物，
    // 开发态则经 esbuild-register + yml-register（见根 package.json dev 脚本）。
    ctx.i18n.define("zh", zhCN);
    ctx.i18n.define("en", en);

    const logger = ctx.logger("market-tracker");

    let disposed = false;
    ctx.on("dispose", () => {
        disposed = true;
    });

    const makeDict = (result: SearchResult) => {
        const dict: Dict<SearchObject> = {};
        for (const object of result.objects) {
            if (object.manifest?.hidden && !config.showOptions.includes("hidden")) continue;
            dict[object.shortname] = object;
        }
        return dict;
    };

    const getMarket = async () => {
        let lastError: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await ctx.http.get<SearchResult>(config.endpoint, {
                    timeout: 30 * 1000,
                });
                return makeDict(data);
            } catch (error) {
                lastError = error;
                if (attempt < 3) {
                    const delay = attempt * 2000;
                    logger.warn(
                        `拉取失败（第 ${attempt} 次）：${describeError(error)}，${delay / 1000} 秒后重试`,
                    );
                    await new Promise<void>((resolve) => setTimeout(resolve, delay));
                    if (disposed) throw lastError;
                }
            }
        }
        throw lastError;
    };

    ctx.on("ready", async () => {
        let cycleStart: Dict<SearchObject> = {};
        let latest: Dict<SearchObject> = {};

        try {
            cycleStart = await getMarket();
            latest = cycleStart;
        } catch (error) {
            logger.warn(`初始化插件市场数据失败：${describeError(error)}`);
        }

        if (disposed) return;

        ctx.command("market-tracker [name]").action(async ({ session }, name) => {
            if (!session) return;
            if (!name) {
                return session.text(".overview", [Object.values(latest).length]);
            }
            const data = latest[name];
            if (!data) return session.text(".not-found", [name]);
            return session.text(".detail", data);
        });

        const fetchInterval = config.fetchInterval;

        const pushUpdates = async (items: DiffItem[]) => {
            if (!items.length) return;
            if (disposed) return;
            const content = await renderDiff(ctx, items, config);
            logger.info(`[插件市场更新] ${items.length} 项变更`);
            for (const target of config.targets) {
                const botId = target.selfId
                    ? `${target.platform}:${target.selfId}`
                    : target.platform;
                const bot = ctx.bots.find(
                    (b) =>
                        b.platform === target.platform &&
                        (!target.selfId || b.selfId === target.selfId),
                );
                if (!bot?.isActive) {
                    logger.warn(`机器人 ${botId} 不可用，跳过 ${target.channelId}`);
                    continue;
                }
                try {
                    await bot.sendMessage(target.channelId, content);
                } catch (error) {
                    logger.warn(
                        `推送到 ${target.platform}:${target.channelId} 失败：${describeError(error)}`,
                    );
                }
            }
        };

        // 拉取定时器：按 fetchInterval 更新 latest 快照
        ctx.cron(`*/${fetchInterval} * * * *`, async () => {
            try {
                latest = await getMarket();
            } catch (error) {
                logger.warn(`拉取插件市场数据失败：${describeError(error)}`);
                return;
            }
            if (!config.batchPush) {
                const items = computeDiff(cycleStart, latest, config);
                cycleStart = latest;
                await pushUpdates(items);
            }
        });

        // 集中推送定时器：仅启用集中推送时生效，触发时刻对齐到小时整点
        // 例如 pushInterval=30 → 每小时 0 分和 30 分触发；pushInterval=60 → 每小时 0 分触发
        if (config.batchPush && config.pushInterval) {
            const pushInterval = Math.max(config.pushInterval, fetchInterval);
            const minutes: number[] = [];
            for (let m = 0; m < 60; m += pushInterval) minutes.push(m);
            const cronExpr = `${minutes.join(",")} * * * *`;
            ctx.cron(cronExpr, async () => {
                if (disposed) return;
                const items = computeDiff(cycleStart, latest, config);
                cycleStart = latest;
                await pushUpdates(items);
            });
        }
    });
}
