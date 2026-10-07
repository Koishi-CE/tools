# tooling/

本目录是本仓的**工程工具集**：服务于开发与门禁流程的 TypeScript 脚本，**不占
devDependencies**（只用 `node:*` 内置模块），工具不进 npm 发布范围，也不被任何
运行时代码消费——改动这里只影响开发 / 门禁体验，不影响两个插件的本体行为。

## 通用约定

- **零第三方依赖**：只用 `node:*` 内置模块（`node:fs` / `node:path` / `node:url` /
  `node:child_process` 等），需要 CLI 语义就自己解析 argv。
  - 由 `lib/yaml.ts` 提供一个**极简 YAML 子集解析器**替代第三方 yaml 依赖：只覆盖
    本仓门禁实际要读的两类文件（`locales/*.yml` 与 PR 模板 `config.yml`），
    支持面与取舍写在脚本头部注释里；
  - 由 `lib/fs.ts` 提供目录遍历 / 读文件 / 路径归一等工具。
- **直跑**：入口均为脚本文件，优先经根 `package.json` 的 script 调用
  （`bun run check:locales` 等），也可直接 `bun tooling/checks/<脚本>.ts` 执行。
  脚本内部只用 `node:` API，因此 Node 22+ 亦可直接运行。
- **不进门禁 typecheck**：`tooling/` 不在根 tsconfig 的 include 内（根 tsconfig 只
  include `packages/*/src`），目录下的 [tsconfig.json](./tsconfig.json) 仅供编辑器
  语言服务命中。
- **头部 JSDoc 即文档**：每个入口脚本用 JSDoc 块写清用途、用法与规则取舍，本
  README 只做索引；细节冲突时以脚本注释为准。
- **SPDX 头必备**：`tooling/**/*.ts` 由 `check:spdx` 逐一核对（前 3 行内须有
  `SPDX-License-Identifier: MIT`）。

## 目录总览

| 子目录 | 调用方式 | 用途 |
| --- | --- | --- |
| [lib/](./lib/) | 被 checks / release 复用 | 共享工具：`fs.ts`（遍历与路径）、`yaml.ts`（极简 YAML 解析）、`types.ts`（行模型） |
| [checks/](./checks/) | `bun run check:*`（已并入 `bun run check`） | 门禁检查脚本：词典 / 包纪律 / 文档链接 / PR 模板 / SPDX |
| [release/](./release/) | `bun run release <status\|version\|build\|test\|publish>` | 发布链：消费 changeset、按包构建、与门禁同口径的测试、registry 比对后逐包发布 |

## checks/ — 门禁检查脚本

五个零依赖脚本，均已并入根 `bun run check`；发现任何问题退出码置 1，具体规则与
豁免清单见各脚本头部注释：

| 脚本 | script 名 | 检查内容 |
| --- | --- | --- |
| [locales.ts](./checks/locales.ts) | `check:locales` | 词典键对齐（以 `zh_CN.yml` 为基准）/ 假翻译（拉丁语种值里不得残留中文）/ `locales/*.yml` 必须被同包源码 import |
| [packages.ts](./checks/packages.ts) | `check:packages` | 包名纪律（一律 `koishi-plugin-*`）/ peer 指向官方 `koishi` / 顶层类型字段统一 `types` / 双产物形态（`import`+`require`+`types` 条件齐备且 `types` 居首）/ 依赖协议禁用 / 源码不得导入 `@koishi-ce`、`@koishijs` 运行时包 |
| [docs-links.ts](./checks/docs-links.ts) | `check:docs-links` | `docs/**`、根部门面文件与 `.github/**`（含 PR 模板目录）markdown 的相对链接与锚点存活 |
| [pr-templates.ts](./checks/pr-templates.ts) | `check:pr-templates` | PR 模板与 `.github/PULL_REQUEST_TEMPLATE/config.yml` 清单对账（孤儿文件 / 字段形态 / name 重复） |
| [spdx.ts](./checks/spdx.ts) | `check:spdx` | 手写源码（`packages/*/src/**`、`packages/*/tsdown.config.ts`、`tooling/**`、`types/**`）的 SPDX 许可证头齐备；生成物与 `node_modules` 豁免 |

### 尚未纳入的检查（本仓已知缺口）

- **`koishi.locales` 的完整性**：本仓不校验 `package.json` 的 `koishi.locales` 声明
  与磁盘语种文件的对应关系（该字段当前只用于市场展示），漏声明不会红。
- **JSON 与 YAML 的格式**：`biome` 只覆盖 TS 源码（见根 `biome.json` 的
  `files.includes`），`package.json` / `tsconfig*.json` / `locales/*.yml` 的字段
  形态与缩进不在任何门禁视野内。

## release/ — 发布链

零依赖脚本，编排「消费 changeset → 构建 → 测试 → 逐包发布」四环；版本与发布流程
见 [docs/process/release.md](../docs/process/release.md)。

```bash
bun run release status     # 只读概览：pending changeset、各包本地 vs registry 版本
bun run release version    # 消费 changeset + 刷新锁文件
bun run release build      # 按包 tsdown
bun run release test       # 与门禁同口径的测试（node --test packages/）
bun run release publish    # 终局断言 → registry 比对 → 逐包 npm publish
```

`--dry-run` 只打印计划；`--provenance` 在 OIDC 环境下附带来源证明。按小仓裁剪的
取舍（不做拓扑序 / 不做 workspace 协议改写但保留终局断言 / 不做所有权预检）写在
脚本头部注释里。

## 新增工具时

- 放进 `checks/`（或按主题新建子目录），单文件入口 + 头部 JSDoc 写清用法（现有
  脚本即模板：SPDX 头 + 用法块 + 规则取舍）。
- 遵守通用约定：零第三方依赖（只用 `node:*`）、可直跑。
- 门禁类入口挂到根 `package.json` 的 scripts，命名为 `check:*`，并**并入
  `check` 与 `.github/workflows/ci.yml` 的 gate job**（两条链的口径必须逐字一致，
  否则本地绿而 CI 红）。
