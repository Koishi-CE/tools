// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

/**
 * koishi-plugin-puppeteer 是可选 peer 依赖（inject.optional），本开发工作区未安装
 * 该包及其类型。此处按其公开接口做最小局部声明，仅为通过类型检查；
 * 消费端安装真包后以真包类型为准（本文件是 src 下的环境声明，不进构建产物）。
 *
 * 注意：本文件必须保持"全局脚本"上下文（不能出现顶层 import/export），
 * 否则声明会从"声明缺失模块"变成"模块扩充"而失效。
 * 对 koishi 的 Context 扩充在 puppeteer-service.d.ts 中（扩充必须写在模块文件里）。
 */
declare module "koishi-plugin-puppeteer" {
    /** 页面内元素句柄，业务侧只原样传回 next()，无需了解内部结构。 */
    export interface ElementHandle {}

    /** puppeteer Page 的最小可用子集（仅声明本项目用到的方法）。 */
    export interface Page {
        setViewport(viewport: {
            width: number;
            height: number;
            deviceScaleFactor?: number;
        }): Promise<unknown>;
        $(selector: string): Promise<ElementHandle | null>;
    }

    export interface Puppeteer {
        render(
            content: string,
            callback?: (
                page: Page,
                next: (handle?: ElementHandle) => Promise<string>,
            ) => Promise<string>,
        ): Promise<string>;
    }
}
