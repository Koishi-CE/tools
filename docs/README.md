# 文档索引

本目录是 [Koishi-CE/tools](https://github.com/Koishi-CE/tools) 的开发文档。
仓库的**铁律**（精简、可执行）写在根 [AGENTS.md](../AGENTS.md)；本目录放方法与理由。

| 文档 | 内容 |
| --- | --- |
| [guides/development.md](./guides/development.md) | 环境、门禁构成、编码约定、测试写法、已知坑 |
| [reference/architecture.md](./reference/architecture.md) | 仓库结构、包布局、依赖纪律、产物形态 |
| [process/release.md](./process/release.md) | changesets 版本流程与发布链 |

插件本身的用法见各包 readme：[clean-screen](../packages/clean-screen/readme.md)、
[market-tracker](../packages/market-tracker/readme.md)。

## 快速上手

```bash
bun install     # 在仓库根执行一次
bun run check   # 全量门禁（提交前必跑）
bun run build   # 按包构建，产物 packages/*/lib
```
