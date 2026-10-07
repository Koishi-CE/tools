// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import { defineConfig } from "tsdown";

// 源码保持 ESM 写法（package.json 为 type: module），产物同时出 CJS 与 ESM：
//   - .cjs 供官方 Koishi 的 require() 加载链（Node 宿主）；
//   - .mjs 供 ESM 宿主 / Bun 的 require() 加载链（Koishi-CE）。
// 导出面由 package.json 的 exports 条件分流（import → .mjs，require → .cjs）。
export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "lib",
    format: ["cjs", "esm"],
    platform: "node",
    dts: true,
    outExtensions: ({ format }) => ({
        js: format === "cjs" ? ".cjs" : ".mjs",
        dts: ".d.ts",
    }),
    clean: true,
    deps: {
        // 依赖全部 external（koishi 为 peer 单实例），不打进产物。
        bundle: false,
        dts: {
            // koishi 生态 d.ts 用 CJS dts 语法（export = Element）或 namespace 成员
            // re-export（Fragment/Render），dts 打包无法解析 → 生成 d.ts 时保持
            // 外部引用（产物 d.ts 保留 import，消费端由 koishi 提供类型）。
            neverBundle: [
                /^koishi/,
                /^@satorijs\//,
                /^@koishijs\//,
                /^cordis/,
                /^minato/,
                /^cosmokit/,
            ],
        },
    },
});
