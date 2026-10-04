# v1.9.10 验证记录

日期：2026-10-04。环境：Windows，Edge 154.0.4258.53。

- `npm run build`：通过。包含物理引擎与音频素材生成、50 项单元测试、包检查、源目录审计、ZIP 构建、ZIP 源码字节一致性与 Node ZIP 大小审计；见 `build.log`。
- `npm run test:browser`：通过。390×844、1440×960、320×568、844×390 四视口，27 个场景，错误数组为空；见 `browser-report.json` 与 `browser.log`。
- 新增录音验证：原始 MP3 字节与打包数据相同；只解码一次；连续播放复用缓冲且最多四声部；待解码播放可取消；结束、静音与重置释放声部；解码失败回退且无未处理的 Promise 拒绝。
- 真实浏览器将样本解码并离线渲染，时长 0.608390 秒、双声道、峰值 0.109754，确认非静音；实际轻点启动声部、结束后归零，滑动不触发水滴样本，静音和重置停止样本。离线 file URL 播放成功，HTTP 请求数为 0。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.9.10.zip` → `PASS: 17 file(s), 0 warning(s)`。审计器位于 `.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/scripts/`。
- `git diff --check`：通过。

发布清单见 `manifest.json`。`tap-preview.png` 为刷新后的项目预览，声音已开启；其他截图覆盖雨效、落石、降级与四种视口。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机音频、视觉、性能尚未实测。
