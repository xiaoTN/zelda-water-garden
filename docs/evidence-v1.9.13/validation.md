# v1.9.13 验证记录

日期：2026-10-04。环境：Windows，Edge 154.0.4258.53。

- `npm run build`：通过。56 项单元测试、离线包检查、源目录审计、ZIP 构建、18 个 ZIP 文件与源码字节一致性检查及 Node ZIP 大小审计；见 `build.log`。
- `npm run test:browser`：通过。四视口、31 个场景，错误数组为空；见 `browser-report.json` 与 `browser.log`。实际点击暴雨→小雨→大雨→小雨→暴雨，四次边界的参数与前 20 个雨点保持一致，83 个观测帧中雨点数与下落速度始终大于零，最终密度准确回到预设。新雨滴的水纹半径在过渡期间渐变，最终暴雨为小雨的两倍；原有音频过渡、落石、降级和离线 file URL 检查继续通过。
- 单元验证切换边界的雨点位置、速度、落点与绘制命令保持一致，下一帧继续下落；雨量和新水纹半径渐变；快速反向切换从中间状态接续；重复选择不重新生成雨点；最终参数准确回到预设。普通、低档与减少动态效果三种模式均验证，已有闪电与延迟雷声能自然完成，停止与重置立即取消天气。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.9.13.zip` → `PASS: 18 file(s), 0 warning(s)`；见 `audit.log`。ZIP 共 18 文件、513,770 字节，SHA-256：`5253bb025d0dca9c9c9709e96f926a374abeeb5739fba27343be98da074dd826`。
- `git diff --check`：通过。

发布清单见 `manifest.json`。`rain-transition-preview.png` 为大雨切换至小雨时的预览，`mobile-storm-to-light-transition.png` 记录浏览器测试中的渐变中间状态。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机音频、视觉和性能尚未实测。
