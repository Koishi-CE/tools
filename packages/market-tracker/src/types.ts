// SPDX-License-Identifier: MIT
// Copyright (c) 2026-present Oppenheymu and Koishi-CE contributors.

export interface DiffItem {
    type: "added" | "updated" | "deleted";
    name: string;
    version1?: string;
    version2?: string;
    publisher?: string;
    description?: string;
}
