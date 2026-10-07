// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { Context } from "koishi";
import { doCleanScreen } from "./clean.ts";
import type { ConfigOptions } from "./config.ts";
import { resolveMode } from "./mode.ts";
import { useLogger } from "./onebot.ts";

export type { CleanMode, ConfigOptions } from "./config.ts";
export { Config } from "./config.ts";

/** 插件名：Koishi 用它在配置文件中标识该插件实例。 */
export const name = "clean-screen";

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>✨ 极致精简，开箱即用，零配置</p>
  <p>🎯 在群聊中撤回最近的若干条消息，达到「清屏」效果</p>
  <p>⚠️ 仅适用于 <strong>OneBot</strong> 平台，机器人需为 <strong>群主</strong> 才能撤回他人消息</p>
  <p>⏳ 群主撤回群内消息<strong>无时间限制</strong>（自己与群员消息均可撤回）</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>清屏 &lt;类型&gt;</code> — 按指定类型清屏（空格 / 撤回 / 混合）</li>
    <li><code>清屏 &lt;类型&gt; &lt;条数&gt;</code> — 按指定类型和数量清屏</li>
    <li><code>cleanscreen &lt;类型&gt; [条数]</code> — 同上（英文别名）</li>
  </ul>
  <p>📌 <strong>清屏类型说明（必填）：</strong></p>
  <ul>
    <li><code>空格</code> / <code>space</code> — 发送一条长空白消息，将聊天记录「顶」出屏幕</li>
    <li><code>撤回</code> / <code>recall</code> — 撤回最近若干条消息（默认，需群主）</li>
    <li><code>混合</code> / <code>both</code> — 先撤回再发空格，双保险</li>
  </ul>
  <p>💡 机器人自身的历史消息会被跳过，不参与撤回。</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export function apply(ctx: Context, config: ConfigOptions) {
    const { minAuthority: authority } = config;

    ctx.command(
        "清屏 <type:string> [count:number]",
        "撤回最近若干条消息或发送空行清屏（撤回需管理）",
        { authority },
    )
        .alias("cleanscreen")
        .usage("类型支持：空格(space)、撤回(recall)、混合(both)；不传数量则使用默认值")
        .example("清屏 空格       发送一条长空白消息顶屏")
        .example("清屏 撤回 30    撤回最近 30 条消息")
        .example("清屏 混合 20    先撤回 20 条再发空行")
        .action(async (argv, type, count) => {
            const { session } = argv;
            if (!session) return "无法获取会话信息。";

            const mode = resolveMode(type);
            if (!mode) return "请指定清屏类型：空格(space)、撤回(recall)、混合(both)。";

            const requested =
                typeof count === "number" && !Number.isNaN(count)
                    ? Math.floor(count)
                    : config.count;
            const clamped = Math.max(1, Math.min(requested, config.maxCount));

            return doCleanScreen(ctx, session, mode, clamped, config.spaceLines);
        });

    useLogger(ctx).info("CleanScreen 插件已加载");
}
