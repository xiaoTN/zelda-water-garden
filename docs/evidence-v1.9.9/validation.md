# v1.9.9 验证记录

日期：2026-10-04。环境：Windows，Edge 154.0.4258.53。

- `npm run build`：通过。包含物理引擎打包、48 项单元测试、包检查、源目录审计、ZIP 构建、ZIP 源码字节一致性与 Node ZIP 大小审计，输出见 `build.log`。
- `npm run test:browser`：通过。390×844、1440×960、320×568、844×390 四视口，26 个场景，错误数组为空，结果见 `browser-report.json` 和 `browser.log`。
- 浏览器确认只显示拨水、浮叶、落石三种模式，不存在冰封/融冰控件；拨水、长按、多指取消、浮叶、鱼群、水深遮挡、四档雨势、雨纹倍率、雷电与音频、落石容量回收、重置、旋转、安全区、上下文恢复、Canvas 降级、低精度着色器、离线 file URL 与减少动态效果场景通过。
- Python 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.9.9.zip` → `PASS: 16 file(s), 0 warning(s)`。审计器位置：`.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/scripts/`。
- 静态确认 `src/ice.js` 已删除，源文件无 `WaterIce`、`IceField`、`field.ice`、`uIce` 或冰霜提示残留。
- `git diff --check`：通过。

发布清单见 `manifest.json`；页面截图见 `fish-mobile.png`、`mobile-calm.png` 和 `desktop-calm.png`，雨效与落石截图在同目录。

自动化浏览器结果不代表 Android 8.1 / Chrome 61 或 iOS 小红书 WebView 真机视觉、音频与性能通过；这些尚未实测。
