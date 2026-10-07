// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import { Schema } from "koishi";

/** 清屏模式类型 */
export type CleanMode = "recall" | "space" | "both";

export interface ConfigOptions {
    /**
     * 使用「清屏」指令所需的最低用户权限等级。
     * Koishi 默认权限等级：0 未授权，1 普通用户，2 管理员，3 超管，4+ 自定义。
     * 清屏会撤回群内消息，影响较大，默认要求管理员（2）。
     * 实际能否撤回仍由「机器人是否群主」与 OneBot 侧校验决定。
     */
    minAuthority: number;
    /** 不传参时撤回的消息条数。 */
    count: number;
    /** 单次清屏允许撤回的最大条数，防止滥用。 */
    maxCount: number;
    /** 空白消息中包含的换行数（越大空白越长）。 */
    spaceLines: number;
}

export const Config: Schema<ConfigOptions> = Schema.object({
    minAuthority: Schema.number()
        .default(2)
        .min(0)
        .max(5)
        .step(1)
        .description("使用「清屏」指令所需的最低用户权限等级（0-5）。默认 2。"),
    count: Schema.number()
        .default(20)
        .min(1)
        .max(500)
        .step(1)
        .description("不传参时撤回的消息条数。默认 20。"),
    maxCount: Schema.number()
        .default(50)
        .min(1)
        .max(1000)
        .step(1)
        .description("单次清屏允许撤回的最大条数，防止滥用。默认 50。"),
    spaceLines: Schema.number()
        .default(1000)
        .min(10)
        .step(1)
        .description("空白消息中包含的换行数（越大空白越长）。小了没效果"),
});
