# 项目常驻指令

> 本文件是本仓库（`tools`，GitHub 组织 [Koishi-CE](https://github.com/Koishi-CE) 下的**工具型插件** monorepo，发布 npm 包名 `koishi-plugin-*`）的常驻开发约定。
> **定位**：收录面向普通用户的实用插件（现有 `koishi-plugin-cleanscreen` / `koishi-plugin-market-tracker`），面向**通用 Koishi 宿主**——官方 Koishi 与 Koishi-CE 都能装。
> **技术栈**：TypeScript 7（@typescript/native）+ tsdown + biome + Changesets；Bun 只作包管理器与脚本运行器，运行时代码与工程脚本**只用 Node 能力**（`node:*`）。
> 本文件只放**铁律**（精简、可执行）；方法与理由见 [docs/guides/development.md](docs/guides/development.md)，结构见 [docs/reference/architecture.md](docs/reference/architecture.md)，发布见 [docs/process/release.md](docs/process/release.md)。

## 基本约束

- **全程使用简体中文**：回复、代码注释、提交说明、文档均用简体中文。
- **包名一律 `koishi-plugin-*`**：本仓不使用 `@koishi-ce` / `@koishijs` 作用域——包名必须能被任何 Koishi 用户直接安装。
- **peer 一律指向官方 `koishi`**（`^4.18.7`），不得写 `@koishi-ce/koishi`；peer 同时下沉到 `devDependencies`（CI 在独立检出上只跑 `bun install`，不装 peer 就做不了类型检查）。
- **只用 `node:*` 能力**：运行时代码、测试与 `tooling/**` 脚本一律 Node 内置模块；**不要引入 `bun:test` / `Bun.file` / `Bun.Glob` / `Bun.cron` 等 Bun 专有 API**（Bun 仅作包管理器与 `bun run` 运行器）。
- **源码 ESM 写法，产物 CJS + ESM 双份**：源码不写 `__dirname` / `require`，产物出 `lib/index.cjs` + `lib/index.mjs` + `lib/index.d.ts`，由 `exports` 条件分流；资源定位统一用 `import.meta.url`。
- **跨包依赖写 semver range，禁写 `workspace:` / `file:` / `link:`**：changesets 不改写这些协议，原样上 npm 会炸下游（发布链有终局断言拦截）。
- **不引入 Turborepo、不引入根级统一构建**：两个包的按包构建是秒级，缓存收益不成立。

## 硬性约束（违反即错误）

1. **只用 `node:test` + `node:assert/strict` 写测试**，不引入 bun:test / chai / vitest。
2. **新增 `locales/*.yml` 必须 import 并 `ctx.i18n.define`**：只把文件放进 `locales/` 不会在运行时注册；`check:locales` 的「存在但未 import」对账会拦住漏改。
3. **类型导入一律 `import type`**，相对导入带 `.ts` 后缀（tsconfig 已开 `verbatimModuleSyntax` / `allowImportingTsExtensions`）。
4. **禁 enum 与构造器参数属性**（`erasableSyntaxOnly`）：用 const 对象 + 联合类型替代；该开关同时保证源码可被 Node 的 type stripping 直接执行。
5. **异步调用必须 await 或显式 void / `.catch`**（`noFloatingPromises` 为 error）。
6. **门禁与提交拆成两条命令**：不要用 `&&` 串联，也不要 `bun run check | tail`（退出码是 `tail` 的，会把红灯当绿灯）。
7. **`biome.json` 里不能写注释**：出现 `//` 会让 Biome **静默丢弃整个 `overrides` 数组**（不报错、不警告）。配置说明写进 [docs/guides/development.md](docs/guides/development.md)。
8. **TS 块注释里不能出现 `*/`**：写路径时用 `packages/<包>/src`，不要写 `packages/*/src`（否则注释提前闭合，报莫名其妙的语法错误）。
9. **`tooling/checks/*` 是零依赖脚本**：只用 `node:*`，不占 devDependencies，不写进根 tsconfig 的 include。
10. **写进仓内的临时探针文件必须删除干净**，提交前用 `git status --short` 核实。

## 工作流与门禁

```bash
bun install          # 仓库根执行；宿主工作区内还要在本仓目录单独跑一次（见下方已知坑）
bun run check        # 全量门禁：lint → typecheck → test → 自研门禁五连（提交前必跑）
bun run lint         # biome check .
bun run typecheck    # tsc -p tsconfig.json（大一统：packages/*/src 一次查完）
bun run test         # node --test（用例 glob 见根 package.json）
bun run build        # 按包构建（产物 packages/*/lib）
bun run format       # biome format --write .
```

- 门禁构成（三段通用检查 + 自研五连）、本地与 CI 的对应关系见 [docs/guides/development.md](docs/guides/development.md) 第 2 节。**本地口径与 CI 必须逐字一致**，改任一侧都要同步另一侧。
- 根 `tsconfig.json` 的 paths 按具体文件登记各包入口（`koishi-plugin-*` → `packages/*/src/index.ts`），新增包时同步补一行。
- 自研门禁五连：`check:locales` / `check:packages` / `check:docs-links` / `check:pr-templates` / `check:spdx`，规则见 [tooling/README.md](tooling/README.md)。
- 门禁全绿才提交；逐功能小步提交。

## 代码风格（biome 已强制）

- 4 空格缩进、行宽 100、双引号、尾逗号 all、LF；格式以 biome 为唯一权威（`bun run format` 收尾，不要手工对齐）。
- 类型安全：strict 全家桶、`noUncheckedIndexedAccess`、`noPropertyAccessFromIndexSignature`、`exactOptionalPropertyTypes`、`noUnusedLocals`、`noUnusedParameters`。
- `useLiteralKeys` 已关闭：索引签名用 `obj["key"]` 形式（点号访问会被 `noPropertyAccessFromIndexSignature` 拒绝）。
- 测试文件例外：关 `noNonNullAssertion`。

## changesets 工作流（强制，勿攒）

- 面向发布的包有**行为变化**时随提交写 `.changeset/` 条目，不要攒到发版前——攒必漏。纯 chore / 文档 / 工具链改动不写。
- bump 类型（当前 1.x）：API 破坏 → major，新功能 → minor，修复 → patch。
- 手写模板：

  ```md
  ---
  "koishi-plugin-cleanscreen": patch
  ---

  fix: ……（简体中文说明）
  ```

- **已知坑**：全新仓库在首次 commit 之前 `changeset status` 会报 "Failed to find where HEAD diverged from main"——先做初始提交即可。
- 发版：`bun run release <status|version|build|test|publish>`，细节见 [docs/process/release.md](docs/process/release.md)。

## 已知坑（一行一条，细节见 docs/guides/development.md 第 6 节）

- 宿主工作区（`KCPD/external/tools`）的宿主根执行 `bun install` **不会**安装本仓的 devDependencies，需在本仓目录单独执行一次。
- `node --test` 的目录参数在 Windows 上失效，必须用 glob 形式。
- `readme.md` 的大小写在 Windows 上不可见（git 索引里是小写），改名用 `git mv -f` 并在 `git ls-files` 里核实。
- `types/yml.d.ts` 的词典值必须是 `any`：koishi 的 `i18n.define` 参数是 `Store`，`Record<string, unknown>` 与之不兼容。

## git 提交流程

1. 先跑 `bun run check` 确认全绿再提交（**门禁与提交务必拆成两条命令，勿用 `&&` 串联**）；涉及构建改动加跑 `bun run build`。
2. `git add -A` 后提交，简体中文提交信息（`feat:` / `fix:` / `docs:` / `chore:` / `build:`，可带 scope 如 `fix(clean-screen):`）。
3. 主分支 `main` 直提；完成后向用户简要说明改动内容与提交哈希。
