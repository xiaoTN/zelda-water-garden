# v1.9.11 验证记录

日期：2026-10-04。环境：Windows，Edge 154.0.4258.53。

- `npm run build`：通过。包含物理引擎与两个录音素材打包、52 项单元测试、离线包检查、源目录审计、ZIP 构建、ZIP 源码字节一致性与 Node ZIP 大小审计；见 `build.log`。
- `npm run test:browser`：通过。390×844、1440×960、320×568、844×390 四视口，28 个场景，错误数组为空；见 `browser-report.json` 与 `browser.log`。
- 单元验证原始 MP3 字节保持一致，解码一次、循环缓冲复用、首尾衔接、音量随速度变化、静止淡出、源节点释放、悬挂解码时的取消/过期手势不会重启，以及解码失败处理。
- 浏览器将真实录音循环离线渲染 14 秒，跨两次衔接仍有声音，边界变化与原始相邻采样一致。实际滑动的循环声源随手速变化，静止时淡出，松手与静音释放；轻点仍播放独立水滴录音。file URL 的录音滑动播放成功，HTTP 请求数为 0。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.9.11.zip` → `PASS: 18 file(s), 0 warning(s)`。审计器位于 `.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/scripts/`。
- `git diff --check`：通过。

发布清单见 `manifest.json`。`swipe-preview.png` 为已刷新、开启声音并滑动后的项目预览；其他截图覆盖降雨、落石与降级。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机音频、视觉和性能尚未实测。
