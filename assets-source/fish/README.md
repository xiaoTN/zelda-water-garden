# Blender 锦鲤源文件

- `garden-koi.blend`：原创鱼身网格、4 种材质、Head / Body / Tail 三节骨骼、渐变蒙皮权重，以及 `Koi_Swim_Loop_1s` 动作。时间轴 1–24 帧、24 FPS；第 25 帧与第 1 帧闭合。在 Blender 中播放时间轴即可预览摆尾。
- `garden-koi.glb`：保留蒙皮与动画的通用模型导出，可交给其他三维软件使用。
- `garden-koi-preview.png`：Blender 中渲染的模型预览。

制作与导出脚本为 `scripts/create-fish-blender.py`。使用 Blender 5.2.2 LTS 运行：

```sh
blender --background --python-exit-code 1 --python scripts/create-fish-blender.py
```

脚本在 Blender 中建立模型、骨骼与动画，逐帧读取依赖图求值后的网格，再生成 `src/fish-asset.js`。后者是相同动画的 24 帧轻量离线数据（141 个共享顶点、235 个三角形），坐标量化精度为模型单位的 1/10000；页面仅插值播放已导出的形变，不另外用正弦公式代替摆尾动画。网页的三种配色由同一组材质槽映射而来。

`.blend` / `.glb` 和预览图作为制作源文件保留，不进入受限小工具 ZIP。运行包采用经典脚本加载动画数据，不依赖联网、GLB 加载器、WASM 或 Worker。
