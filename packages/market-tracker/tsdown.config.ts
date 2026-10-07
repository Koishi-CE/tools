// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import yaml from "@rollup/plugin-yaml";
import { defineConfig } from "tsdown";

// 源码保持 ESM 写法，产物同时出 CJS 与 ESM（原因见 packages/clean-screen/tsdown.config.ts）。
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
    // src/index.ts 静态导入 locales/*.yml，yaml 插件把解析结果直接内联进产物。
    plugins: [yaml()],
    // render.ts 运行时经 import.meta.url 读取 template.html，构建时复制到 lib/ 下。
    copy: ["src/template.html"],
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
