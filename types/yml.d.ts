// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

// 词典 yml 导入的类型面：ctx.i18n.define 只读键值树，
// 具体词条结构不做静态约束（与各包 locales/*.yml 实际内容对应）。
//
// 这里用 `any` 而非 `Record<string, unknown>`：i18n.define 的参数是 koishi 的
// Store 类型（叶子必须是 string 或嵌套对象），unknown 值的 Record 与它不兼容。
// 词典的真实结构由各包 locales/*.yml 的内容保证，声明侧不做约束。
declare module "*.yml" {
    const dict: any;
    export default dict;
}
