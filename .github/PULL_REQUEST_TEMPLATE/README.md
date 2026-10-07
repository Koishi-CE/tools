# PR 模板

本目录的模板按改动领域拆分，由同目录 `config.yml` 的下拉清单指向（GitHub 约定的
`name` / `description` / `body` 三字段）。

- 新增模板：写好 `*.md` 后**必须**登记进 `config.yml` 的 `templates`，否则
  `bun run check:pr-templates` 会以「孤儿文件」报错；
- 删除 / 重命名模板：同步改 `config.yml`，否则清单会指向不存在的文件；
- 本文件（`README.md`）是导航页，不参与模板对账。

模板数量与命名不做硬编码约束，对账规则见
[tooling/checks/pr-templates.ts](tooling/checks/pr-templates.ts) 头部注释。

> 本目录下的 markdown 由 GitHub 按**仓库根**解析相对链接（社区健康文件约定），
> 故上面的链接不带 `../../`。
