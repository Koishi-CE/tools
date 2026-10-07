# koishi-plugin-market-tracker

[![npm](https://img.shields.io/npm/v/koishi-plugin-market-tracker?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-market-tracker)
[![platform](https://img.shields.io/badge/platform-Koishi-blueviolet)](https://koishi.chat/)
[![license](https://img.shields.io/github/license/Koishi-CE/tools?style=flat-square)](https://github.com/Koishi-CE/tools/blob/main/LICENSE)

> 追踪 Koishi 插件市场更新，自动推送到指定群 / 频道。

## 功能

- 定时轮询插件市场，检测插件的新增、更新与删除
- 支持图片渲染（需安装 puppeteer 服务）与纯文本两种推送模式
- 可配置推送目标（平台 / 机器人 / 频道）
- 可自定义显示隐藏插件、发布者、描述等信息
- 支持中英双语推送

## 配置

| 配置项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `targets` | table | `[]` | 推送目标列表（平台 / 机器人 ID / 群或频道 ID） |
| `endpoint` | string | `https://registry.koishi.chat/index.json` | 插件市场地址 |
| `renderImage` | boolean | `true` | 是否渲染为图片，需要 puppeteer 服务 |
| `showOptions` | checkbox | `[]` | 显示选项：隐藏插件 / 删除插件 / 发布者 / 描述 |
| `fetchInterval` | number | `5` | 拉取间隔（分钟） |
| `batchPush` | boolean | `false` | 是否集中推送；关闭则一有更新立即推送 |
| `pushInterval` | number | `60` | 集中推送间隔（分钟），须大于等于拉取间隔 |

## 依赖

- [koishi](https://koishi.chat/) ^4.18.7
- `koishi-plugin-puppeteer`（可选，缺失时回退纯文本推送）

## 特别鸣谢

本项目由官方插件 [koishi-plugin-market-info](https://github.com/koishijs/koishi-plugin-market-info) 启发，特此致谢。

## 许可

MIT。本包由 [Koishi-CE/tools](https://github.com/Koishi-CE/tools) 维护，自原独立仓库 `koishi-plugin-market-tracker` 迁入。
