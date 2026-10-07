// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * 把 puppeteer 服务挂到 koishi 的 Context 接口上（对应 index.ts 的
 * inject.optional: ["puppeteer"] 与 render.ts 里的 ctx.puppeteer）。
 *
 * 注意：模块扩充必须写在"模块文件"里（有顶层 import/export），否则会变成
 * 遮蔽真模块的模块声明，导致 koishi 全部类型丢失。类型来自
 * koishi-plugin-puppeteer.d.ts 的局部声明；消费端安装真包后由真包的
 * 同名扩充接管（本文件不进构建产物）。
 */
export {};

declare module "koishi" {
    interface Context {
        puppeteer: import("koishi-plugin-puppeteer").Puppeteer;
    }
}
