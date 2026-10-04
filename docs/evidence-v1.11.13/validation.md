# v1.11.13 合并验证

日期：2026-10-04。环境：Windows，Edge 154。

- 合并输入：本地 `4617d2a` 与 `origin/main` 的 `bb18a9e`，共同祖先 `70cfa01`。解决 README、package.json、package-lock.json、构建脚本、浏览器脚本、app.js 与 style.css 共 7 个冲突文件。AGENTS.md 自动合并保留资源授权、音频偏好与 3D 合同。
- `npm run build`：通过，79 项测试全部通过，包含水面、自然场景、3D 几何与相机拾取。包检查、源目录审计、ZIP 根目录、允许格式、24 个 ZIP 文件与源码字节一致性检查、Node ZIP 大小审计通过；见 `build.log`。
- `npm run test:browser`：通过，共 52 个场景。慢帧恢复 3 个、水面 30 个、自然场景 7 个、形变 12 个，见四份 `*-report.json` 和 `browser.log`。后三份报告错误数组为空。覆盖四视口、雨势与录音过渡、跨场景音频释放和恢复、WebGL 丢失/恢复及缺失提示、雪地脚印和雪球、云海/地形、相机视角与拾取、两档几何、完整扫动材料守恒、离线 file URL。
- Python ZIP 内容审计：`audit_artifact.py artifacts/zelda-water-garden-minitool-v1.11.13.zip` → `PASS: 24 file(s), 0 warning(s)`，见 `audit.log`。
- 源码确认冰霜玩法、模拟和渲染未重新引入。离线资源加载顺序包含自然场景及两份录音数据。音频淡出清理在各场景通用的更新路径执行，页面隐藏立即停止声音。
- `git diff --check` 和 `git diff --cached --check`：通过。

发布清单见 `manifest.json`。ZIP 共 24 文件、632,864 字节，SHA-256：`433a1b628337a4c34d16b321c8dbfb8cd407bc95f012eb5ca96cfc8da373c0bd`。

Android 8.1 / Chrome 61 与 iOS 小红书 WebView 的真机视觉、音频和性能尚未实测。
