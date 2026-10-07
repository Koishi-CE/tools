# koishi-plugin-tools

> [Koishi-CE](https://github.com/Koishi-CE) 组织下的工具型插件集合，面向**通用 Koishi 宿主**
> ——官方 Koishi 与 Koishi-CE 都能直接安装。

## 插件列表

| 包 | 说明 |
| --- | --- |
| [koishi-plugin-cleanscreen](./packages/clean-screen/readme.md) | 机器人必须是群主，通过撤回消息来（暴力）清屏；支持撤回 / 空格 / 混合三种模式 |
| [koishi-plugin-market-tracker](./packages/market-tracker/readme.md) | 追踪 Koishi 插件市场的新增、更新与删除，推送到指定群 / 频道（支持图片渲染） |

## 开发

```bash
bun install     # 仓库根执行一次
bun run check   # 全量门禁：lint → typecheck → test → 自研门禁五连（提交前必跑）
bun run build   # 按包构建，产物 packages/*/lib（index.cjs + index.mjs + index.d.ts）
```

- 仓库常驻约定（铁律）：[AGENTS.md](./AGENTS.md)
- 文档索引（开发手册 / 结构 / 发布）：[docs/README.md](./docs/README.md)

## 许可

[MIT](./LICENSE)
