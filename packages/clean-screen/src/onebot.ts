// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { Bot, Context } from "koishi";

/**
 * koishi-plugin-adapter-onebot 暴露在 Bot 实例上的底层 OneBot 接口。
 *
 * 该包是本插件的 peer 依赖，但本仓不安装它及其类型（消费端装真包），
 * 故此处按其公开接口做最小结构声明，只覆盖本插件用到的三个成员。
 * 若上游接口改名，改动集中在本文件。
 */
export interface OneBotInternal {
    /** 取群成员信息（本插件只用 role 判断机器人是否为群主）。 */
    getGroupMemberInfo(groupId: string, userId: string): Promise<{ role?: string } | undefined>;
    /** 撤回单条消息。 */
    deleteMsg(messageId: number): Promise<unknown>;
    /** 底层原始请求通道（适配器未包装的原生 action 经此调用）。 */
    _request?(
        action: string,
        params?: Record<string, unknown>,
    ): Promise<OneBotResponse | undefined>;
}

/** OneBot 原生 action 的响应外壳。 */
export interface OneBotResponse {
    retcode?: number;
    data?: { messages?: unknown[] };
}

/**
 * 取出会话机器人上的 OneBot 底层接口；非 OneBot 平台或适配器未挂载时返回 undefined。
 *
 * 结构化断言而非 `declare module` 扩充：koishi 的 `Bot` 是泛型类，接口合并需要
 * 逐字复刻其类型参数，成本与脆弱性都高于这里的单点断言。
 */
export function getOneBotInternal(bot: Bot): OneBotInternal | undefined {
    return (bot as unknown as { internal?: OneBotInternal }).internal;
}

/** 会话上下文的日志名（与包名后缀一致，便于在 Koishi 日志里定位）。 */
export const LOGGER_NAME = "clean-screen";

/** 取本插件的 logger。 */
export function useLogger(ctx: Context) {
    return ctx.logger(LOGGER_NAME);
}
