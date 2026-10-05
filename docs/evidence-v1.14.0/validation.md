# 雪球惯性与调参验证 — 2026-10-05

构建通过 108 项单元测试、33 文件离线包检查、源码审计、ZIP 核对和产物审计，零警告。各浏览器子检查报告均无页面错误。

`snow-inertia-report.json` 保存普通和低画质的松手速度、后续球体位置/旋转/半径、行进距离、再次抓取后的零速度。惯性中没有手指仍保持录音播放，抓取或取消后音效最终静音。测试通过 UI 改摩擦并刷新验证保留，恢复默认，读取参数 JSON；另外验证原生 Touch 回退、退出页面停止运动、320×568 布局和安全区、离线与正式容器的面板隐藏。

其它回归报告：

- `scene-transition-report.json`：六种切换方向、两种画质、改选、输入保护、生命周期、真实上下文恢复及拾取。
- `music-browser-report.json`、`audio-reentry-report.json`：真实 PCM 淡入淡出、循环和音频重入。
- `render-recovery-report.json`：慢回调降画质后保持三个场景的 WebGL 渲染。
- `browser-report.json`：四种尺寸下的水纹、雨势、音效、落石、恢复和离线。
- `nature-browser-report.json`：雪地工具、静止雪球/手动滚动/合并、云层、场景数据、相机/球体接触、两档 GPU 预算、触摸、上下文恢复、离线和不可用状态。
- `displacement-report.json`：雪堆积守恒、云层连续位移、GPU 通道和世界坐标拾取一致、边缘交互。

保留 `developer-panel-portrait.png`、`developer-panel-wide.png` 与 `snow-inertia-normal.png`、`snow-inertia-low.png`；其它自动化截图在 `tmp/browser-evidence-v1.14.0/`。

静态核对：无新网络、Worker、WASM、剪贴板、下载能力；调试设置读取有异常保护和数值边界；正式入口使用默认值。雪球运动复用已有滚动、扫掠接触、球体网格与音频控制器，停止时不重复模拟，不进行 GPU 回读。页面隐藏停帧并停止惯性，上下文不可用时不执行运动。源代码采用经典脚本、ES2017 与基线 CSS。
