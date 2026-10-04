# v1.11.16 默认声音验证

日期：2026-10-04。环境：Windows，Edge 154。

- 三个自然场景均无声音开关；移除按钮、静音状态与专用样式。初始 `audioEnabled` 为 true，AudioContext 在首次用户操作中创建。
- 浏览器验证首次触摸播放水滴录音，直接点击下雨自动播放雨声，空格 / Enter 键盘路径及无 PointerEvent 的鼠标路径自动启用音频。缺少音频能力时显示说明，水面仍可交互。
- `npm run build`：通过，83 项测试全部通过。26 个离线文件的包检查、源目录审计、ZIP 入口与允许格式、源码字节一致性以及 Node ZIP 大小审计通过，见 `build.log`。
- `npm run test:browser`：通过，共 61 个场景。慢帧恢复 3 个、水面 39 个、自然场景 7 个、形变 12 个。水面、自然场景与形变报告错误数组均为空，见四份报告与 `browser.log`。
- 平静、场景切换与页面隐藏的音频释放及恢复检查通过。水滴、滑动、落石、余波、雨声与雷声维持原有播放及包络；雨声强度切换连续，松手后余波持续。离线 file URL 首次点击即播放录音，HTTP 请求数为 0。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.11.16.zip` → `PASS: 26 file(s), 0 warning(s)`，见 `audit.log`。
- 已刷新本地预览并点水，底部保留拨水、浮叶、落石、下雨与平静，无声音按钮；见 `default-audio-preview.png`。
- `git diff --check` 和 `git diff --cached --check`：通过。

发布清单见 `manifest.json`。ZIP 共 26 文件、719,014 字节，SHA-256：`79689fcd461112463c15bd47cd298e955df4480671efbb20a8489e5d1e22fcf6`。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机视觉、音频和性能尚未实测。
