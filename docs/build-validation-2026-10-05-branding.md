# 构建验证 — 2026-10-05

本次仅构建现有项目并新增发布文案、Icon 候选素材，没有修改游戏逻辑或渲染代码。

- 版本：1.12.0。
- npm run build：通过，包含物理/音频打包、99 项测试、离线包检查、源码审计、ZIP 生成及内容一致性检查。
- 测试：99 通过，0 失败、0 跳过。
- 离线包：30 个文件，根目录包含 index.html，扩展名与文件内容检查通过。
- Node 源码审计：30 个文件，0 警告。
- Node ZIP 体积审计：通过。
- Python audit_artifact.py ZIP 内容审计：30 个文件，0 警告。
- ZIP：artifacts/zelda-water-garden-minitool-v1.12.0.zip。
- 字节数：1,965,306（约 1.87 MiB）。
- SHA-256：bff1abd271c46e45c2d2702800f08d571afc9359a12ea774bf8471f69f1965d0。

此次未进行真机或 Chrome 61 / Android 8.1 实测，不将静态检查与构建成功等同于真机验证。

四张 Icon 候选存放于 assets-source/branding/2026-10-05/，没有打入运行时 ZIP；待用户选择后再确定发布图标。
