// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { Context, Session } from "koishi";
import { getOneBotInternal, useLogger } from "./onebot.ts";

/**
 * 获取本群最近 count 条消息的 message_id（按时间从新到旧），跳过机器人自身消息。
 *
 * napcat 的 get_group_msg_history 传 message_seq 时不会向前回溯（Issue #441），
 * 故翻页无效；但其支持 count 参数，可一次指定返回条数。koishi 适配器的
 * internal.getGroupMsgHistory 未暴露 count，这里通过底层 _request 直接调用，
 * 不传 message_seq 即从最新消息向前取 count 条。
 */
export async function collectRecentMessageIds(
    ctx: Context,
    session: Session,
    groupId: string,
    count: number,
): Promise<number[]> {
    const logger = useLogger(ctx);
    const internal = getOneBotInternal(session.bot);
    if (!internal?._request) {
        logger.error("会话机器人未挂载 OneBot 底层请求通道，无法获取群历史消息");
        return [];
    }

    const selfId = session.bot.selfId;
    let messages: { message_id: number; sender?: { user_id?: number } }[];
    try {
        // koishi 适配器未暴露 count 参数，直接通过底层 _request 调用 napcat 原生接口
        const response = await internal._request("get_group_msg_history", {
            group_id: groupId,
            count,
        });
        if (response?.retcode !== 0) {
            logger.error(`获取群历史消息失败：retcode ${response?.retcode ?? "unknown"}`);
            return [];
        }
        messages = (response.data?.messages ?? []) as typeof messages;
    } catch (error) {
        logger.error("获取群历史消息失败：", error);
        return [];
    }

    const targetIds: number[] = [];
    const seen = new Set<number>();
    // 历史消息按时间正序（旧→新），从最新一条向前收集
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!msg) continue;
        if (seen.has(msg.message_id)) continue;
        seen.add(msg.message_id);

        // 跳过机器人自身的历史消息
        const senderId = msg.sender?.user_id;
        if (senderId !== undefined && String(senderId) === selfId) continue;

        targetIds.push(msg.message_id);
        if (targetIds.length >= count) break;
    }
    return targetIds;
}

/**
 * 从 delete_msg 失败的 SenderError 中提取 retcode，返回简短标识（仅用于 debug 日志）。
 *
 * 撤回失败最常见原因是目标消息已被撤回，调用方会将其静默跳过，
 * 此处仅给出 retcode 便于排查，不做可能误导的具体归因。
 *
 * koishi-plugin-adapter-onebot 抛出的 SenderError 会把 retcode 同时挂在
 * `error.code` 与 `error.message` 文本中，两种来源都做兼容读取。
 */
export function describeRecallError(error: unknown): string {
    const err = error as { code?: unknown; message?: string } | undefined;
    const code = typeof err?.code === "number" ? err.code : undefined;

    let retcode = code;
    if (retcode === undefined && err?.message) {
        const match = err.message.match(/retcode[:\s]*(\d+)/i);
        if (match) retcode = Number(match[1]);
    }

    return retcode === undefined ? "未知错误" : `retcode ${retcode}`;
}

/**
 * 发送一条由大量空白行组成的长消息，将聊天记录「顶」出屏幕。
 * 每行开头都有一个 \u200B（零宽空格），防止 QQ 将空行折叠或当作空消息丢弃。
 */
export async function sendSpaceMessage(
    ctx: Context,
    session: Session,
    spaceLines: number,
): Promise<boolean> {
    const logger = useLogger(ctx);
    // \u200B 零宽空格：每行一个，确保 QQ 不会合并连续空行
    const content = "\u200B\n".repeat(spaceLines);
    try {
        await session.send(content);
        return true;
    } catch (error) {
        logger.debug("发送空格消息失败：", error);
        return false;
    }
}
