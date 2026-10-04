# v1.11.17 无树雪地验证

日期：2026-10-04。环境：Windows，Edge 154。

- 删除原有 8 棵程序生成树的网格、缓冲、绘制调用及专用着色属性。每帧减少 560 个三角形与 1 次绘制；未增加替代景物。
- `npm run build`：通过，83 项测试全部通过。26 个离线文件的包检查、源目录审计、ZIP 入口与允许格式、源码字节一致性以及 Node ZIP 大小审计通过，见 `build.log`。
- `npm run test:browser`：通过，共 61 个场景。慢帧恢复 3 个、水面 39 个、自然场景 7 个、形变 12 个。水面、自然场景与形变报告错误数组均为空，见四份报告及 `browser.log`。
- 两档真实几何检查确认有一个雪球且飘雪时仅绘制雪面、雪球与雪花，共 3 次绘制；三角形数量等于雪面加雪球，没有装饰树几何。默认档 87,536 个、低档 32,312 个三角形。雪球的相机拾取和深度检测继续通过。
- 俯视和斜视、雪痕、脚印、雪球滚动、横竖屏、完整扫动材料守恒、WebGL 丢失 / 恢复和离线触摸继续通过。共用着色器的云层与大地回归通过。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.11.17.zip` → `PASS: 26 file(s), 0 warning(s)`，见 `audit.log`。
- 已刷新本地雪地预览并检查两个视角。界面证据为 `snow-no-trees-preview.png` 与 `snow-no-trees-oblique-preview.png`。
- `git diff --check` 和 `git diff --cached --check`：通过。

发布清单见 `manifest.json`。ZIP 共 26 文件、718,447 字节，SHA-256：`83d7161f671269bfdc4c16d1364c047168d7b83b753eaaa3387c4a42a732b727`。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机视觉、音频和性能尚未实测。
