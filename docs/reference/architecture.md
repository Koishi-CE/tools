# 仓库结构

## 1. 定位

`tools` 是 [Koishi-CE](https://github.com/Koishi-CE) 组织下的**工具型插件** monorepo：
收录面向普通用户的实用插件（与同组织的 [services](https://github.com/Koishi-CE/services)
互补——那个仓收录的是「向其他插件提供基础服务」的服务型插件）。

两条与 services 的**根本差异**，决定了本仓大部分工程取舍：

| | services | tools（本仓） |
| --- | --- | --- |
| 面向宿主 | 仅 Koishi-CE（peer 为 `@koishi-ce/koishi`） | **通用 Koishi**（peer 为官方 `koishi`），官方 Koishi 4.x 与 Koishi-CE 都能装 |
| 包名 | `@koishi-ce/plugin-*` | `koishi-plugin-*`（官方生态命名，可被任何 Koishi 用户直接安装） |
| 产物 | ESM-only（`.mjs`） | **CJS + ESM 双份**（`.cjs` + `.mjs`） |
| 运行时 API | Bun-first（`Bun.cron` / `Bun.file` / `bun:test`） | **只用 `node:*`**（含门禁脚本与测试） |

## 2. 目录结构

```
tools/
├── .changeset/                    changesets 配置与待发布条目
├── .github/
│   ├── PULL_REQUEST_TEMPLATE/     PR 模板与下拉清单（check:pr-templates 对账）
│   └── workflows/                 CI 门禁与发布链
├── docs/                          开发文档（本目录）
├── packages/
│   ├── clean-screen/              koishi-plugin-cleanscreen
│   └── market-tracker/            koishi-plugin-market-tracker
├── tooling/                       工程工具集（门禁脚本 + 发布链，零第三方依赖）
├── types/yml.d.ts                 词典 yml 导入的类型面
├── AGENTS.md                      仓库常驻约定（铁律）
├── biome.json                     格式化与 lint 配置
├── tsconfig.base.json             编译器基线（各包 extend 它）
└── tsconfig.json                  大一统 typecheck 工程（paths 指向各包源码）
```

## 3. 产物形态：为什么是 CJS + ESM 双份

源码写法**只有 ESM 一种**（`type: "module"`、`import`、无 `require` / `module.exports`），
但构建产物同时出两份：

| 产物 | 给谁用 | 依据 |
| --- | --- | --- |
| `lib/index.cjs` | 官方 Koishi 的加载链 | Koishi 的 loader 用 `require()` 加载插件，Node 宿主要求 CJS |
| `lib/index.mjs` | ESM 宿主 / Bun | Koishi-CE 宿主由 Bun 的 `require()` 直接加载 ESM |
| `lib/index.d.ts` | 类型检查 | 两份构建共用同一份声明 |

分流由 `package.json` 的 `exports` 条件完成：

```jsonc
"exports": {
    ".": {
        "types": "./lib/index.d.ts",      // 必须排第一：条件按书写顺序匹配
        "development": "./src/index.ts",  // Koishi 开发态直载源码
        "import": "./lib/index.mjs",
        "require": "./lib/index.cjs",
        "default": "./lib/index.cjs"      // 兜底给不认 import/require 的加载器
    }
}
```

`check:packages` 会强制这套形态（含「`types` 必须居首」这一条）。

**因此源码不能写 `__dirname`**——它在 ESM 产物里不存在。需要定位产物同目录的资源时
统一用 `import.meta.url`：rolldown 会在 CJS 输出里把它改写成
`require("url").pathToFileURL(__filename).href`（market-tracker 的 `render.ts` 即此写法，
两种产物均已实测可定位到 `lib/template.html`）。

## 4. 包布局

每个包是自洽的一层，构建配置**按包隔离**（根不做统一构建配置）：

```
packages/<包>/
├── src/                    源码（含 *.test.ts 与必要的局部类型声明 *.d.ts）
├── locales/                词典（仅 market-tracker 有）
├── package.json            含 exports / peerDependencies / koishi 元数据
├── readme.md               插件用法说明
├── tsconfig.json           extends ../../tsconfig.base.json
└── tsdown.config.ts        该包的构建配置（entry / format / plugins / copy）
```

根 `bun run build` 经 `--filter './packages/*' build` 逐包调用 `tsdown`——**不引入
Turborepo，也不引入根级统一构建**：两个包的构建整轮是秒级，缓存收益不成立。

## 5. 依赖纪律

- **peer 只声明官方 `koishi`**：本仓面向通用 Koishi 宿主，peer 不得写 `@koishi-ce/koishi`；
  平台相关依赖也走 peer（`koishi-plugin-adapter-onebot` / `koishi-plugin-puppeteer`）。
- **peer 同时下沉到 `devDependencies`**：CI 在独立检出上只跑 `bun install`，不装 peer
  就做不了类型检查与测试。两处版本保持一致。
- **禁 `workspace:` / `file:` / `link:` 协议**：changesets 不改写这些协议，原样上 npm
  会炸下游且无法回滚。发布链的「终局断言」会在发包前扫描四个依赖字段拦下它们。
- **可选依赖用局部类型桩，不装真包**：`koishi-plugin-puppeteer`（可选 peer）与
  `koishi-plugin-adapter-onebot`（平台 peer）的类型在本仓以 `src/*.d.ts` 的最小声明
  兜底，消费端装真包后由真包类型接管。桩分两类文件：
  - **全局脚本上下文**（无顶层 import/export，如 `koishi-plugin-puppeteer.d.ts`）——
    声明缺失模块本身；
  - **模块上下文**（有 `export {}`，如 `puppeteer-service.d.ts` / `cron-service.d.ts`）——
    对 `koishi` 的 `Context` 做接口扩充。
  两者不能混：把扩充写进全局脚本会**遮蔽**真模块，导致 koishi 全部类型丢失。
- **包间互不依赖**：两个包各自独立，不引用彼此。

## 6. 门禁与发布

- 门禁构成与本地/CI 口径：见 [development.md](../guides/development.md) 第 2 节。
- 门禁脚本清单：见 [tooling/README.md](../../tooling/README.md)。
- 版本与发布链：见 [release.md](../process/release.md)。

## 7. 来源与许可

全部包 **MIT**（根 [LICENSE](../../LICENSE)）。各包来源：

| 包 | 来源 | 版权 |
| --- | --- | --- |
| `koishi-plugin-cleanscreen` | 自 `koishi-plugin-toolbox` 的 `packages/clean-screen` 迁入 | © 2026-present Oppenheymu and Koishi-CE contributors |
| `koishi-plugin-market-tracker` | 自独立仓库 `koishi-plugin-market-tracker` 迁入 | © 2026-present Oppenheymu and Koishi-CE contributors |

手写源文件带 SPDX 标识符头（由 `check:spdx` 强制，覆盖
`packages/<包>/src/**`、`packages/<包>/tsdown.config.ts`、`tooling/**` 与 `types/**`）。
