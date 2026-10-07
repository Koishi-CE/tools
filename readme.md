# koishi-plugin-tools

[![npm](https://img.shields.io/npm/v/koishi-plugin-tools?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-tools)

（待补充项目简介）

## 开发

```bash
bun install            # 在宿主工作区根目录执行一次（workspace 成员依赖提升）
bun run build          # 根级：--filter 构建全部子包（产物 packages/*/lib/index.cjs）
bun run --filter 'koishi-plugin-tools' check   # 单包门禁：biome + 类型检查
```

约定详见 `AGENTS.md`。
