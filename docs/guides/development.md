# 开发手册

本仓是 [Koishi-CE](https://github.com/Koishi-CE) 组织下的**工具型插件** monorepo
（`koishi-plugin-*` 命名，面向**通用 Koishi 宿主**——官方 Koishi 与 Koishi-CE 都能装）。
铁律见根 [AGENTS.md](../../AGENTS.md)，结构见 [architecture.md](../reference/architecture.md)。

## 1. 环境

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Bun | 1.4.2 | 包管理器与脚本运行器（锁在根 `packageManager`），**不引入 bun 专有 API** |
| Node.js | 22+（开发机 24） | 运行时与测试运行器（`node --test`），脚本只用 `node:*` 内置模块 |
| TypeScript | 7.0.2 | 经 `@typescript/native` 提供 `tsc` |
| tsdown | 0.22.14 | 基于 rolldown 的打包器 |
| Biome | 2.5.x | 格式化与 lint |

```bash
bun install     # 仓库根执行一次
```

> **宿主工作区内的已知坑**：本仓通常作为 `KCPD/external/tools` 被宿主仓库的
> `workspaces` 覆盖。宿主根执行 `bun install` 时**不会**安装本仓的 devDependencies
> （实测），需在本仓目录单独执行一次；反之在本仓目录执行时依赖会被装进
> `external/tools/node_modules`，满足直跑门禁的需要。

## 2. 门禁构成

`bun run check` 是本仓唯一的全量门禁，由**三段通用检查 + 自研门禁五连**组成（**本地
口径与 CI 必须逐字一致**，改任一侧都要同步另一侧）：

| 段 | 命令 | 内容 |
| --- | --- | --- |
| lint | `biome check .` | 格式化 + lint（范围见根 `biome.json` 的 `files.includes`） |
| typecheck | `tsc -p tsconfig.json` | 一次性检查 `packages/*/src`（paths 指向源码，不依赖构建产物） |
| test | `node --test "packages/*/src/**/*.test.ts"` | `node:test` 用例 |
| 自研五连 | `check:locales` / `check:packages` / `check:docs-links` / `check:pr-templates` / `check:spdx` | 见 [tooling/README.md](../../tooling/README.md) |

```bash
bun run check     # 全量门禁（提交前必跑）
bun run lint      # 单跑某一段
bun run format    # 只做格式化
bun run build     # 按包构建（产物 packages/*/lib）
```

- **门禁与提交必须拆成两条命令**：不要用 `&&` 串联，也不要 `bun run check | tail`
  ——管道的退出码是 `tail` 的，会把红灯当绿灯。
- 顺序依赖（隐性约束，别顺手重排）：当前**不需要** build 前置于 typecheck / test。
  根 `tsconfig.json` 的 paths 指向各包 `src/index.ts` 源码，测试也经同一套 paths
  解析到源码，因此干净检出（没有 `lib/`）时 typecheck 与 test 都能过。一旦将来有
  paths 改指 `lib/*.d.ts`、或有测试去读真实产物，**必须**把 build 提到它们之前。

## 3. 编码约定

- 4 空格缩进、行宽 100、双引号、尾逗号 all、LF；格式以 biome 为唯一权威
  （`bun run format` 收尾，不要手工对齐）。
- 严格模式全家桶：`strict` / `noUncheckedIndexedAccess` /
  `noPropertyAccessFromIndexSignature` / `exactOptionalPropertyTypes` /
  `noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly`。
- **禁 enum 与构造器参数属性**（`erasableSyntaxOnly`）：用 const 对象 + 联合类型替代。
  该开关同时保证源码可被 Node 的 type stripping 直接执行（测试就是这么跑的）。
- 类型导入一律 `import type`；相对导入带 `.ts` 后缀（`allowImportingTsExtensions`），
  tsdown 与 tsc 都能解析。
- 异步调用必须 `await`、显式 `void` 或 `.catch`（`noFloatingPromises` 为 error）。
- 导入顺序交给 biome 的 organizeImports，不要手工维护。

## 4. 测试写法

- 用 `node:test` + `node:assert/strict`，**不引入 bun:test / chai / vitest**。
- 测试文件与被测模块同目录，命名 `*.test.ts`，由根 `test` 脚本的 glob 收集。
- 优先测**纯函数**（如 `resolveMode`、`computeDiff`），涉及 Koishi 会话的部分通过
  依赖注入的参数化边界来隔离，不搭真实 bot。
- `biome.json` 对 `*.{spec,test}.*` 关掉了 `noNonNullAssertion`。

## 5. 产物形态

**源码纯 ESM 写法，产物同时出 CJS 与 ESM**（原因与取舍见
[architecture.md](../reference/architecture.md) 第 3 节）：

- `packages/*/lib/index.cjs` —— 官方 Koishi 的 `require()` 加载链；
- `packages/*/lib/index.mjs` —— ESM 宿主与 Bun 的 `require()` 加载链；
- `packages/*/lib/index.d.ts` —— 类型入口（两份构建共用同一份 d.ts）。

因此**源码里不要写 `__dirname`**：产物是双格式的，只有 CJS 侧有 `__dirname`。
需要定位产物同目录的资源时用 `import.meta.url`——rolldown 会在 CJS 输出里把它改写成
`require("url").pathToFileURL(__filename).href` 的等价形式（market-tracker 的
`render.ts` 即此写法，已实测两种产物都能定位到 `lib/template.html`）。

## 6. 已知坑

- **块注释里不能出现 `*/`**：写「`packages/*/src`」这种描述时用 `packages/<包>/src`，
  否则 `*/` 会提前闭合注释，报出莫名其妙的语法错误。
- **`node --test` 的目录参数在 Windows 上失效**（会被当作入口模块解析），必须用
  glob 形式 `node --test "packages/*/src/**/*.test.ts"`。
- **`biome.json` 里不能写注释**：出现 `//` 会让 Biome 静默丢弃整个 `overrides` 数组
  （不报错、不警告）。配置说明写在本文件里。
- **`useLiteralKeys` 已关闭**：`description["zh"]` 这类索引访问不要改成 `.zh`——
  tsconfig 的 `noPropertyAccessFromIndexSignature` 会拒绝点号访问索引签名。
- **`types/yml.d.ts` 的词典值用 `any`**：koishi 的 `i18n.define` 参数是 `Store`
  （叶子必须是 string 或嵌套对象），`Record<string, unknown>` 与之不兼容。
- **peer 依赖要同时下沉到 devDependencies**：CI 在独立检出上只跑 `bun install`，
  不装 peer 就做不了类型检查（本仓 `koishi` 即在两处都声明）。
- **`readme.md` 的大小写在 Windows 上不可见**（git 索引里是小写），Linux / macOS
  检出的工具会踩；改名用 `git mv -f` 并在 `git ls-files` 里核实。
- **官方 koishi 的 ESM 链有双包危害**：`import()` 我们的 `.mjs` 产物时会因
  `@koishijs/loader` 报 `Class extends value #<Object> is not a constructor` 而失败
  （koishi 上游问题，与产物无关）。Node 侧请走 CJS（`require`）——这也是
  `exports.default` 指向 `.cjs` 的原因，详见 [architecture.md](../reference/architecture.md) 第 3 节。
- **`lib/` 是构建产物**，不进 git（见根 `.gitignore`），发布时由 `files` 字段带上。

## 7. 索引与工具

- 门禁脚本与发布链：[tooling/README.md](../../tooling/README.md)
- 包布局与依赖纪律：[architecture.md](../reference/architecture.md)
- 版本与发布：[release.md](../process/release.md)
