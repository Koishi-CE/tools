# 版本与发布

本仓用 [Changesets](https://github.com/changesets/changesets) 管理版本号，发布链由
[tooling/release/index.ts](../../tooling/release/index.ts) 编排（零第三方依赖）。

## 1. 日常：随改动写 changeset

**每次用户可见的改动（feat / fix / 行为调整）必须随提交写 `.changeset/` 条目，不要攒到
发版前**——攒必漏，漏写则 `changeset version` 无 pending 条目直接退出，版本号不更新、
包发不出去。

```bash
bun run changeset        # 交互式：选包 → 选 bump 类型 → 填简体中文说明
```

或手写 `.changeset/<名字>.md`：

```md
---
"koishi-plugin-cleanscreen": patch
---

fix: 修正清屏指令在非群聊场景下的提示文案
```

`bump` 类型（当前均为 1.x）：

| 类型 | 适用 |
| --- | --- |
| `patch` | 缺陷修复、微小调整 |
| `minor` | 向后兼容的功能新增 |
| `major` | 破坏性变更（配置 / 指令行为 / 导出面不兼容） |

**不需要 changeset**：纯 chore——文档、格式化、依赖升级、构建脚本调整等无行为变化的改动。

## 2. 发布链

```bash
bun run release status            # 只读概览：pending changeset、各包本地 vs registry 版本
bun run release version           # 消费 changeset（升版本号）+ 刷新锁文件
bun run release build             # 按包 tsdown
bun run release test              # 与门禁同口径的测试
bun run release publish           # 终局断言 → registry 比对 → 逐包 npm publish
```

- `--dry-run` 只打印计划（对 `publish` 尤其有用：先看清哪些包会发、哪些会跳过）；
- `--provenance` 让 `npm publish` 附带来源证明（CI 的 OIDC 环境下用，本地无 OIDC 时勿加）。

设计取舍（写在这里是因为它们解释了脚本为什么这么短）：

- **不做拓扑序**：两个包互不依赖，不存在发布先后约束；
- **不做 workspace 协议改写**：本仓纪律本就禁用 `workspace:*`，故没有改写对象。但保留
  **终局断言**——发布前扫描四个依赖字段，残留 `workspace:` / `file:` / `link:` 直接失败。
  这类协议一旦带上就无法回滚；
- **不做所有权 / 登录态预检**：这些都交给 npm 自己校验，它的报错更准确。

## 3. 本地发版（备用链）

CI 不可用时的手工流程：

```bash
bun run check                     # 先确认门禁全绿
bun run release version           # 消费 changeset
git add -A && git commit -m "chore(release): 消费 changeset 并更新版本"
bun run release build
bun run release publish           # 需要已登录 npm（npm login）
```

`publish` 会先查 registry：已发布过的版本自动跳过，因此重跑安全。**例外**是 npm 暂存区
中的版本（不出现在 registry 的 versions 列表里，重跑必 409）——遇到时等暂存区过期或联系
npm 支持，不要反复重试。

## 4. CI 发版

[.github/workflows/release.yml](../../.github/workflows/release.yml) 在携带 changeset 的
合并进入 `main` 后自动消费并发布；`workflow_dispatch` 作补发 / 重跑逃生舱。

前置条件：

1. 仓库 Secrets 配置 `NPM_TOKEN`（npm 的 Automation token，需对两个包有发布权限）；
2. 若 `main` 开启了分支保护，发布链推送版本提交的 token 必须在 bypass 名单里：默认用
   `GITHUB_TOKEN` 会被保护规则拒绝（GitHub 不允许把 `GITHUB_TOKEN` 加进 bypass 名单），
   此时需改用 GitHub App token（workflow 里已留出替换位置与注释）。

想改用 npm 的**可信发布（OIDC）**时：删掉 `NODE_AUTH_TOKEN` 相关步骤、给 publish job 加
`id-token: write`、并在 npm 包设置里登记受信发布者（repository / workflow 文件名 /
environment 三个 claim 必须与 workflow 严格一致），随后给 `release` 脚本的 publish 调用
补上 `--provenance`。

## 5. 已知坑

- **全新仓库首次提交前** `changeset status` 会报
  `Failed to find where HEAD diverged from main`——先做一次初始提交即可。
- **`biome.json` 不能写注释**：出现 `//` 会让 Biome 静默丢弃整个 `overrides` 数组。
- 发布前务必让工作区干净（`git status --short` 无输出），否则构建产物可能混入未提交内容。
