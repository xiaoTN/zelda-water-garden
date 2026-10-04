# 水之庭素材

环境、石块、沙底、草叶由 `src/scene.js` 确定性绘制；水面、折射、反光、焦散由 `src/renderer.js` 实时渲染。界面图标为原创内联 SVG，轻点水声使用用户提供的录音，其他水声由手势触发 Web Audio 合成。

运行包不请求外部资源。轻点录音在 `audio/water-tap.mp3`，来源与打包方式见 [音频素材记录](audio/README.md)。v1.1 的七张《旷野之息》实机参考图位于 `references/botw/`，仅作本地研究，不打入 ZIP。研究记录见 `docs/botw-water-study-v1.1.0.md`；v1.0 的初始资料保留在 `docs/research.md`。

v1.2 的薄冰、晶纹、裂纹、碎冰和冰裂声为原创程序效果。`src/ice.js` 在初始化生成 256×256 周期晶面纹理，水面网格的 B 通道保存冰层覆盖，不新增外部素材；Canvas 2D 降级使用低分辨率冰层遮罩和简化冰纹。

v1.3 删除周期晶面纹理，改成随视口比例生成、最长边 1024 的连续冰层纹理：R 保存多层裂缝、G 保存气泡、B 保存局部凝霜。三张真实摄影的浏览器对照截图在 `references/ice/`；来源和观察记录在 `docs/ice-reference-study-v1.3.0.md`。参考截图不被程序加载，也不进入 ZIP。
