// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * 把计划任务服务挂到 koishi 的 Context 上（对应 index.ts 的 inject.required: ["cron"]）。
 *
 * 计划任务服务由宿主装配的 cron 插件提供——官方 koishi-plugin-cron、社区
 * koishi-plugin-cron-fix 与 Koishi-CE 的 @koishi-ce/plugin-cron 实现同一签名，
 * 本仓不安装其中任何一个，故按其公共签名做最小局部声明（本文件不进构建产物）。
 *
 * 注意：模块扩充必须写在"模块文件"里（有顶层 import/export），否则会变成遮蔽
 * 真模块的模块声明，导致 koishi 全部类型丢失。
 */
export {};

declare module "koishi" {
    interface Context {
        /**
         * 注册一个 cron 计划任务。
         * @param expression 标准 5 字段 cron 表达式（分 时 日 月 周）
         * @param callback 触发时执行的回调
         * @returns 取消该任务的函数
         */
        cron(expression: string, callback: () => void | Promise<void>): () => void;
    }
}
