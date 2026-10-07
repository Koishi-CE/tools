// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import { Schema } from "koishi";

export interface Target {
    platform: string;
    selfId?: string;
    channelId: string;
}

export interface Config {
    endpoint: string;
    fetchInterval: number;
    batchPush: boolean;
    pushInterval?: number;
    renderImage: boolean;
    showOptions: string[];
    targets: Target[];
}

export const Config = Schema.intersect([
    Schema.object({
        targets: Schema.array(
            Schema.object({
                platform: Schema.string().description("平台名称"),
                selfId: Schema.string().description("机器人ID").default(""),
                channelId: Schema.string().description("目标群/频道ID"),
            }),
        )
            .role("table")
            .default([])
            .description("推送目标列表，将更新推送到指定机器人所在的群/频道"),
        endpoint: Schema.string()
            .default("https://registry.koishi.chat/index.json")
            .description("插件市场地址。"),
        renderImage: Schema.boolean()
            .default(true)
            .description("是否将更新渲染为图片，需要安装 puppeteer 服务"),
        showOptions: Schema.array(
            Schema.union([
                Schema.const("hidden").description("显示隐藏的插件"),
                Schema.const("deletion").description("显示删除的插件"),
                Schema.const("publisher").description("显示插件发布者"),
                Schema.const("description").description("显示插件描述"),
            ]),
        )
            .role("checkbox")
            .default([])
            .description("显示选项"),
        fetchInterval: Schema.number().min(1).default(5).description("拉取间隔（分钟）"),
        batchPush: Schema.boolean()
            .default(false)
            .description("是否启用集中推送。不启用则一有更新立即推送"),
    }),
    Schema.union([
        Schema.object({
            batchPush: Schema.const(true).required(),
            pushInterval: Schema.number()
                .min(1)
                .default(60)
                .description("推送间隔（分钟）。必须大于等于拉取间隔"),
        }),
        Schema.object({}),
    ]),
]);
