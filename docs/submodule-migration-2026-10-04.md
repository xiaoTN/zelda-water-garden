# 2026-10-04 子模块迁移

本工具从工具集合拆为独立私有仓库 [xiaoTN/zelda-water-garden](https://github.com/xiaoTN/zelda-water-garden)，在主仓库中的路径仍为 tools/zelda-water-garden/。

本工具此前未纳入主仓库 Git，现将现有目录作为独立仓库首次导入。

迁移快照提交：c878d3daedb1aa39dd71a0c3e8828bda241e7088。当前工作文件（包括原有未提交修改、素材和验证证据）先保存为快照，再补充独立仓库的配置与说明。全部原工具文件在修改说明文档之前通过 SHA-256 比对，忽略的 artifacts/、tmp/、node_modules/ 保持在原路径。

本仓库拥有 .gitignore、.gitattributes、AGENTS.md 和完整平台 Skill，可以脱离主仓库开发与构建。本次迁移保持业务源码和上传包规则；依赖、文档、素材、ZIP 与临时文件继续由本工具管理。

## 验证

- npm test：通过。
- npm run check：通过。
- npm run build：通过，构建内包含源码审计、ZIP 内容逐项比对和 ZIP 审计。
- ZIP 根目录入口和扩展名检查：通过，共 13 个文件。
- 构建产物：artifacts/zelda-water-garden-minitool-v1.8.3.zip，434365 bytes。
- SHA-256：eb6020e258a0e1237980d6f26b965b216c01cc207847a03ac6c7efc313045fb5。
- 全部原业务代码、测试、素材和历史证据在迁移及构建后通过 SHA-256 比对，保持原始字节。
- 独立远端克隆验证：待推送后完成。

这些是本地自动化门禁；本次结构迁移未进行 Chrome 61 或小红书真机测试。
