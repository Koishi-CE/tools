---
"koishi-plugin-cleanscreen": patch
"koishi-plugin-market-tracker": patch
---

chore: 迁入 Koishi-CE/tools 仓库并统一工程规范

- 源码统一为纯 ESM 写法（`__dirname` 改为 `import.meta.url`），构建产物同时提供
  CJS（`lib/index.cjs`）与 ESM（`lib/index.mjs`），由 `exports` 条件分流——官方
  Koishi 的 `require()` 加载链与 Koishi-CE 宿主的加载链都能直接用；
- peer 依赖统一指向官方 `koishi`（`^4.18.7`），并同时下沉到 `devDependencies`；
- clean-screen 的 logger 名由 `tools` 改为 `clean-screen`，日志里可直接定位插件；
- 补充纯函数单元测试（`node:test`）、SPDX 许可证头与包内 readme；
- 本仓面向通用 Koishi 宿主，包名保持 `koishi-plugin-*` 不变。
