# v1.11.14 落石音频验证

日期：2026-10-04。环境：Windows，Edge 154。

- 原始 `stone-impact.mp3`：25,805 字节，22,050 Hz 单声道，约 3.130 秒；未裁剪或变更字节。真实离线 Web Audio 渲染峰值约 0.9268，解码时长 3.130023 秒，见 `browser-report.json`。
- `npm run build`：通过，80 项测试全部通过。新增录音字节一致性、直接播放、单次解码、四声源上限、自然结束和停止回收验证。包检查、源目录审计、ZIP 根目录、允许格式、25 个 ZIP 文件与源码字节一致性检查、Node ZIP 大小审计通过，见 `build.log`。
- `npm run test:browser`：通过，共 54 个场景。慢帧恢复 3 个、水面 32 个、自然场景 7 个、形变 12 个。水面、自然场景和形变报告的错误数组均为空，见四份报告及 `browser.log`。
- 新增浏览器检查确认石头在空中不播放录音，仅首次触水播放一次；与轻点样本独立；静音立即释放短音效，重新开启不补播旧声音；平静清理声音。离线 file URL 同样播放落石录音，HTTP 请求数为 0。
- 全量回归包含四视口、雨势连续过渡、长声音真实 PCM 淡入淡出、跨场景音频生命周期、WebGL 上下文恢复与不可用状态、雪地与云层两档几何及材料守恒。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.11.14.zip` → `PASS: 25 file(s), 0 warning(s)`，见 `audit.log`。
- 已刷新本地预览，开启水声并选择落石，点击池中央可见水下石头；界面证据见 `stone-audio-preview.png`。
- `git diff --check` 和 `git diff --cached --check`：通过。

发布清单见 `manifest.json`。ZIP 共 25 文件、658,690 字节，SHA-256：`ab11a3d8110ce81065ae2e631ebb09e6ecc241c2939857d5ff1b725ed73ff2c0`。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机视觉、音频和性能尚未实测。
