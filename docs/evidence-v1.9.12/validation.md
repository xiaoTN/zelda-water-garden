# v1.9.12 验证记录

日期：2026-10-04。环境：Windows，Edge 154.0.4258.53。

- `npm run build`：通过。54 项单元测试、离线包检查、源目录审计、ZIP 构建、18 个 ZIP 文件与源码字节一致性检查及 Node ZIP 大小审计；见 `build.log`。
- `npm run test:browser`：通过。390×844、1440×960、320×568、844×390 四视口、30 个场景，错误数组为空；见 `browser-report.json` 与 `browser.log`。实际交互验证关闭后尾音继续、快速重新开启取消暂停、尾音结束后释放声源与暂停，隐藏页立即清理；file URL 播放录音无 HTTP 请求。
- 单元验证雨势切换复用声源、停雨淡出、快速恢复取消释放、滑动水流尾音与恢复、雷声淡出、旧内核音量保持回退、重复停止保持原期限，以及隐藏页立即清理。短水滴录音字节、直接起音和声音数量限制检查继续通过。
- 浏览器使用真实 OfflineAudioContext 渲染恒定信号，通过 PCM 测量验证水流与雨声淡入、淡出、雨势变化连续性和水流恢复；切换采样跳变小于 0.001，淡出末尾音量低于稳定音量的 2%。保留原录音跨两次循环衔接及短水滴解码播放检查。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.9.12.zip` → `PASS: 18 file(s), 0 warning(s)`；见 `audit.log`。审计器位于 `.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/scripts/`。
- `git diff --check`：通过。ZIP 共 18 文件、513,329 字节，SHA-256：`dbd8dd104a14f87746570b5aee63c8967a1e5ac176d3d4f3580d2f4daf6f825d`。

发布清单见 `manifest.json`。`audio-fade-preview.png` 为刷新后开启声音并切换至大雨的项目预览。浏览器报告与日志记录完整交互结果。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机音频、视觉和性能尚未实测。
