// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SearchObject } from "@koishijs/registry";
import type { Dict } from "koishi";
import type { Config } from "./config.ts";
import { computeDiff } from "./diff.ts";

/** 构造最小可用的市场条目：只有 version 参与 diff，其余字段按需补。 */
function entry(version: string, extra: Record<string, unknown> = {}): SearchObject {
    return { package: { version }, ...extra } as unknown as SearchObject;
}

/** 构造只关心 showOptions 的配置。 */
function config(showOptions: string[] = []): Config {
    return { showOptions } as Config;
}

function dict(entries: Record<string, SearchObject>): Dict<SearchObject> {
    return entries;
}

describe("computeDiff", () => {
    it("识别新增插件并带上版本号", () => {
        const items = computeDiff(dict({}), dict({ alpha: entry("1.0.0") }), config());
        assert.deepEqual(items, [{ type: "added", name: "alpha", version2: "1.0.0" }]);
    });

    it("识别版本更新并给出前后版本", () => {
        const items = computeDiff(
            dict({ alpha: entry("1.0.0") }),
            dict({ alpha: entry("1.1.0") }),
            config(),
        );
        assert.deepEqual(items, [
            { type: "updated", name: "alpha", version1: "1.0.0", version2: "1.1.0" },
        ]);
    });

    it("版本未变时不产出条目", () => {
        const items = computeDiff(
            dict({ alpha: entry("1.0.0") }),
            dict({ alpha: entry("1.0.0") }),
            config(),
        );
        assert.deepEqual(items, []);
    });

    it("删除仅在开启 deletion 选项时上报", () => {
        const previous = dict({ alpha: entry("1.0.0") });
        assert.deepEqual(computeDiff(previous, dict({}), config()), []);
        assert.deepEqual(computeDiff(previous, dict({}), config(["deletion"])), [
            { type: "deleted", name: "alpha", version1: "1.0.0" },
        ]);
    });

    it("按 name 排序，且 publisher / description 仅在开启对应选项时填充", () => {
        const current = dict({
            beta: entry("2.0.0", {
                package: {
                    version: "2.0.0",
                    publisher: { username: "someone" },
                },
                manifest: { description: { zh: "中文简介", en: "English" } },
            }),
            alpha: entry("1.0.0"),
        });
        const plain = computeDiff(dict({}), current, config());
        assert.deepEqual(
            plain.map((item) => item.name),
            ["alpha", "beta"],
        );
        assert.equal(plain[1]?.publisher, undefined);
        assert.equal(plain[1]?.description, undefined);

        const rich = computeDiff(dict({}), current, config(["publisher", "description"]));
        assert.equal(rich[1]?.publisher, "someone");
        assert.equal(rich[1]?.description, "中文简介");
    });
});
