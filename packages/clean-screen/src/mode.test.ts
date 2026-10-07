// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMode } from "./mode.ts";

describe("resolveMode", () => {
    it("识别中文别名", () => {
        assert.equal(resolveMode("空格"), "space");
        assert.equal(resolveMode("撤回"), "recall");
        assert.equal(resolveMode("混合"), "both");
    });

    it("识别英文别名，容忍大小写与首尾空白", () => {
        assert.equal(resolveMode(" Space "), "space");
        assert.equal(resolveMode("RECALL"), "recall");
        assert.equal(resolveMode("Both"), "both");
    });

    it("无法识别时返回 undefined", () => {
        assert.equal(resolveMode(undefined), undefined);
        assert.equal(resolveMode(""), undefined);
        assert.equal(resolveMode("删除"), undefined);
    });
});
