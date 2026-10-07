// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

import type { SearchObject } from "@koishijs/registry";
import type { Dict } from "koishi";
import type { Config } from "./config.ts";
import type { DiffItem } from "./types.ts";

export function computeDiff(
    previous: Dict<SearchObject>,
    current: Dict<SearchObject>,
    config: Config,
): DiffItem[] {
    return Object.keys({ ...previous, ...current })
        .map((name): DiffItem | undefined => {
            const old = previous[name];
            const cur = current[name];
            const version1 = old?.package.version;
            const version2 = cur?.package.version;
            if (version1 === version2) return undefined;

            if (!version1) {
                if (!cur) return undefined;
                const item: DiffItem = {
                    type: "added",
                    name,
                    version2: cur.package.version,
                };
                if (config.showOptions.includes("publisher")) {
                    const username = cur.package.publisher?.username;
                    if (username) item.publisher = username;
                }
                if (config.showOptions.includes("description")) {
                    const description = cur.manifest?.description;
                    if (typeof description === "object") {
                        const desc = description["zh"] || description["en"];
                        if (desc) item.description = desc;
                    } else if (typeof description === "string") {
                        item.description = description;
                    }
                }
                return item;
            }

            if (version2) {
                return {
                    type: "updated",
                    name,
                    version1,
                    version2,
                };
            }

            if (config.showOptions.includes("deletion")) {
                return {
                    type: "deleted",
                    name,
                    version1,
                };
            }
            return undefined;
        })
        .filter((x): x is DiffItem => x !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
}
