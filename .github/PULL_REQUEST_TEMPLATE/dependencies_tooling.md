<!-- 依赖升级或工程配置调整 -->

## 改动

<!-- 升了哪些依赖 / 调了哪些工程配置（tsconfig、biome、tsdown、CI） -->

## 口径影响

<!-- 是否改变门禁口径；改了就要同步 CI 与本地 check 链，两处必须逐字一致 -->

- [ ] 未改变门禁口径
- [ ] 改变了门禁口径（已同步根 package.json 的 check 链与 .github/workflows/ci.yml）

## 验证

- [ ] `bun run check` 全绿
- [ ] `bun run build` 通过
- [ ] 锁文件变更已在 diff 中核对（未出现整份重排）
