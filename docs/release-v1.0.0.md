# 水之庭 v1.0.0

发布日期：2026-10-03。

## 交付内容

林间青绿水池，具有实时水波传播、叠加与阻尼、岸边反射、水底折射、焦散、波峰反光及水花粒子。支持指尖拨水、长按后释放水花、投石和连续打水漂、放置浮叶与推叶、细雨、晨光 / 暮色 / 月夜，以及默认关闭的合成水声。

新工具独立放在 `tools/zelda-water-garden/`；仓库根 README 工具表已添加入口。

## 门禁与证据

| 检查 | 结果 |
| --- | --- |
| `npm test` | 6 个测试通过，覆盖波传播、衰减、路径连续性、干岸、重叠稳定性、高度编码和像素预算 |
| `npm run check` | 通过；6 个离线静态文件，入口、相对资源、经典脚本、能力扫描、DOM 绑定、CSS 回退与降级钩子符合约束 |
| `npm run test:browser` | Edge 154.0.4258.53 通过；零页面异常 / console error |
| 手机与桌面尺寸 | 390×844、320×568、844×390、1440×960；均无页面溢出，底部安全区验证通过 |
| 交互 | 原生模拟触摸点击、鼠标连续拖动、长按释放、双指操作 / 取消、投石、浮叶受水流推动、细雨、光照、水声开关、归于平静均通过 |
| 生命周期 | 控制 `document.hidden` 的测试验证暂停 / 恢复；实际 WebGL context loss / restore 验证通过 |
| 运行时降档 | 注入 60 ms 的模拟 RAF 时间，验证 normal → low → Canvas 2D，降级后仍可触碰。该测试不是设备帧率测量 |
| 离线运行 | `file://` 入口可用，HTTP / HTTPS 请求计数为 0 |
| `npm run build` | 通过；自动执行测试、包检查、目录审计、ZIP 文件清单与解压内容比对、ZIP 包体审计 |
| 技能 Python ZIP 审计 | 通过，读取真实 ZIP 内部；6 文件、0 警告 |

浏览器报告：[browser-report.json](evidence-v1.0.0/browser-report.json)。其中 `readyAndSettleMs` 包含测试主动等待时间，不能作为首屏性能指标。

画面证据：[手机静水](evidence-v1.0.0/mobile-calm.png)、[手机拨水](evidence-v1.0.0/mobile-ripples.png)、[月夜细雨](evidence-v1.0.0/mobile-moon-rain.png)、[桌面静水](evidence-v1.0.0/desktop-calm.png)、[二维降级](evidence-v1.0.0/mobile-fallback.png)。

## 上传包

- 文件：`artifacts/zelda-water-garden-minitool-v1.0.0.zip`
- 压缩大小：18,678 字节，约 18.24 KiB
- ZIP 文件数：6
- SHA-256：`6441aab6fd72845d3c144ca9736ffdacb2eb0ead2bc66c9013f50a011e9cf077`
- 根入口：`index.html`

## 平台预算核对

纯离线，无网络、外链、内联 JS、模块脚本、eval、Worker、WASM、传感器、下载、JSBridge 或远程资产。ES2017 语法；CSS 使用 Flex margin 基线、安全区变量与 env 回退，毛玻璃仅作 `@supports` 增强。WebGL 1 / 高精度片元能力检测；单张纹理最长边 1024；默认 DPR ≤ 1.5 / 200 万像素，低档 DPR ≤ 1 / 100 万像素；每帧 1 draw call / 2 三角形。波场上限 192×192，粒子最多 150 / 低档 60，浮叶最多 18。无每帧 GPU 回读。页面隐藏时取消 RAF、暂停音频并清理提示定时器。

没有真实 Android 8.1 / Chrome 61、iOS 小红书 WebView 的设备验证。旧内核 JS / CSS 实际兼容性、扬声器播放结果、真机首屏时间、帧率和内存尚未实测。默认 30 FPS 是设计目标，浏览器通过不替代真机性能验收。二维降级保留操作与涟漪，省略实时水底折射。
