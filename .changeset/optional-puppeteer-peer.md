---
"koishi-plugin-market-tracker": patch
---

fix: 把 `koishi-plugin-puppeteer` 声明为可选 peer（`peerDependenciesMeta.optional`）

图片渲染本就是可选能力（`inject.optional` + 缺失时回退纯文本推送），但 peer 未标 optional
时包管理器会自动补装：宿主会凭空多出官方 `koishi-plugin-puppeteer`（连带 `puppeteer-core`
等依赖树）。标上 optional 后不再自动安装，由宿主按需自选实现——Koishi-CE 宿主可装
`@koishi-ce/plugin-puppeteer`（服务名同为 `puppeteer`，插件侧不区分来源）。
