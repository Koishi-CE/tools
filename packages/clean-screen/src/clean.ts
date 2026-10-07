// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { Context, Session } from "koishi";
import type { CleanMode } from "./config.ts";
import { getOneBotInternal, useLogger } from "./onebot.ts";
import { collectRecentMessageIds, describeRecallError, sendSpaceMessage } from "./utils.ts";

/** 取不到机器人成员信息时的统一提示（平台不支持与查询失败共用）。 */
const NO_MEMBER_INFO = "无法获取机器人在本群的成员信息，请确认机器人在本群内。";

/**
 * 校验平台/群聊环境，按指定模式清屏。
 * - recall：撤回最近 count 条消息（需群主）
 * - space：发送大量空行消息
 * - both：先撤回再发空格
 * 返回面向用户的结果文案。
 */
export async function doCleanScreen(
    ctx: Context,
    session: Session,
    mode: CleanMode,
    count: number,
    spaceLines: number,
): Promise<string> {
    if (session.platform !== "onebot") return "该指令仅支持 OneBot 平台。";
    const groupId = session.guildId;
    if (!groupId) return "请在群聊中使用该指令。";

    const logger = useLogger(ctx);
    const results: string[] = [];
    const needRecall = mode === "recall" || mode === "both";
    const needSpace = mode === "space" || mode === "both";

    // ── 撤回阶段 ──
    if (needRecall) {
        const internal = getOneBotInternal(session.bot);
        if (!internal) {
            logger.error("会话机器人未挂载 OneBot 底层接口，无法查询群成员信息");
            return NO_MEMBER_INFO;
        }

        // 校验机器人为群主：只有群主能撤回群内他人消息
        let isOwner = false;
        try {
            const selfInfo = await internal.getGroupMemberInfo(groupId, session.bot.selfId);
            isOwner = selfInfo?.role === "owner";
        } catch (error) {
            logger.error("查询机器人群成员信息失败：", error);
            return NO_MEMBER_INFO;
        }

        if (!isOwner) {
            results.push("撤回失败：机器人需为本群群主才能撤回他人消息。");
        } else {
            const targetIds = await collectRecentMessageIds(ctx, session, groupId, count);
            if (!targetIds.length) {
                results.push("没有可撤回的消息。");
            } else {
                let success = 0;
                let skipped = 0;
                for (const id of targetIds) {
                    try {
                        await internal.deleteMsg(id);
                        success++;
                    } catch (error) {
                        logger.debug(
                            `撤回 ${id} 失败（可能已撤回）：${describeRecallError(error)}`,
                        );
                        skipped++;
                    }
                }
                if (skipped === 0) {
                    results.push(`已撤回 ${success} 条消息。`);
                } else {
                    results.push(
                        `已撤回 ${success} 条消息（另有 ${skipped} 条可能已撤回，已跳过）。`,
                    );
                }
            }
        }
    }

    // ── 发空格阶段 ──
    if (needSpace) {
        const ok = await sendSpaceMessage(ctx, session, spaceLines);
        if (ok) {
            results.push("已发送空白消息，聊天记录已清屏。");
        } else {
            results.push("发送空白消息失败。");
        }
    }

    return results.join(" ") || "清屏操作完成。";
}
