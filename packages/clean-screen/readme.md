# koishi-plugin-cleanscreen

[![npm](https://img.shields.io/npm/v/koishi-plugin-cleanscreen?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-cleanscreen)

极致精简的 OneBot 群清屏插件：撤回最近的若干条消息，达到「清屏」效果。

## 功能

- 在群聊中撤回最近 N 条消息，达到「清屏」效果
- 支持「空格」模式：发送一条长空白消息，把聊天记录顶出屏幕
- 支持「混合」模式：先撤回再发空格
- 自动跳过机器人自身消息，已撤回的消息静默跳过不计失败
- 仅适用于 OneBot 平台

## 使用

| 指令 | 说明 |
| --- | --- |
| `清屏 空格` | 发送一条长空白消息，将聊天记录「顶」出屏幕 |
| `清屏 撤回 [条数]` | 撤回最近的若干条消息（默认条数见配置） |
| `清屏 混合 [条数]` | 先撤回再发空行 |
| `cleanscreen <类型> [条数]` | 同上（英文别名） |

> 机器人需为 **群主** 才能撤回他人消息。群主撤回群内消息无时间限制（自己与群员消息均可撤回）。

## 配置

| 配置项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `minAuthority` | number | `2` | 使用「清屏」指令所需的最低用户权限等级（0-5） |
| `count` | number | `20` | 不传参时撤回的消息条数 |
| `maxCount` | number | `50` | 单次清屏允许撤回的最大条数，防止滥用 |
| `spaceLines` | number | `1000` | 空白消息中包含的换行数（越大空白越长） |

## 依赖

- [koishi](https://koishi.chat/) ^4.17.4
- OneBot 协议适配器（如 `koishi-plugin-adapter-onebot`）

## 许可

MIT。本包由 [Koishi-CE/tools](https://github.com/Koishi-CE/tools) 维护，自原 `koishi-plugin-toolbox` 的 `packages/clean-screen` 迁入。
