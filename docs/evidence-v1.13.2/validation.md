# 场景过渡验证 — 2026-10-05

`npm run build` 成功：103 项单元测试、31 文件离线包检查、源码性能审计、ZIP 核对及产物大小审计，零警告。构建及浏览器日志保留在 `tmp/scene-transition-*.log`。

各浏览器子检查均成功，报告如下：

- `scene-transition-report.json`：六种方向在普通与低画质各运行一次；记录淡出中点约 0.5、切换点 1、淡入中点约 0.5，验证世界只在切换点改变。还覆盖连续请求、输入与选择按钮、后台返回、窗口变化、两个真实 WebGL 上下文的丢失/恢复、恢复后的拾取，以及减少动态效果。
- `music-browser-report.json`：真实 PCM 淡入淡出、随机循环入口、快速切换、离线及返回。
- `audio-reentry-report.json`：页面缓存返回、系统中断、手势重试、延迟暂停及关闭上下文恢复的可听输出。
- `render-recovery-report.json`：三场景慢帧回调降为低画质后继续渲染，调整窗口后继续模拟。
- `browser-report.json`：四种尺寸、水纹、雨势、音效、落石、生命周期、上下文恢复与离线入口。
- `nature-browser-report.json`：雪地工具、雪球、云层、场景数据保留、尺寸与光照、触摸取消、实际 3D、离线和硬件不可用状态。
- `displacement-report.json`：雪堆积守恒、云层侧向推移、两个 GPU 画质、几何高度与相机拾取一致、屏幕边缘手势。

保留截图 `scene-transition-cover.png`、`scene-transition-reveal.png` 展示同一水到雪过渡的前后半段。其它完整测试截图存于本地 `tmp/browser-evidence-v1.13.2/`。

静态实现核对：单个界面遮罩，不复制实时场景或进行 GPU 回读；空闲时遮罩隐藏；动画由已有帧循环推进；隐藏页面停止帧循环并收尾遮罩；不使用网络、Worker、WASM、新相机模式或 Canvas 2D 伪造世界。采用 ES2017 经典脚本及基线 CSS。
