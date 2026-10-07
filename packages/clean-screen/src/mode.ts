// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { CleanMode } from "./config.ts";

/**
 * 解析用户输入的清屏类型字符串。
 * 支持中文 / 英文别名：
 * - 空格 / space
 * - 撤回 / recall
 * - 混合 / both
 * 无法识别时返回 undefined。
 */
export function resolveMode(raw: string | undefined): CleanMode | undefined {
    if (!raw) return undefined;
    const value = raw.trim().toLowerCase();
    if (value === "空格" || value === "space") return "space";
    if (value === "撤回" || value === "recall") return "recall";
    if (value === "混合" || value === "both") return "both";
    return undefined;
}
