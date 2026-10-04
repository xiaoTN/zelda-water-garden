# v1.11.6 — 雪地和雪球接入网上雪材质

## 资源

采用 ambientCG 的 Snow001（https://ambientcg.com/view?id=Snow001），作者 ambientCG / Lennart Demes，CC0 1.0。官方授权允许修改及随游戏分发：https://docs.ambientcg.com/license/ 。该素材是程序生成的 PBR 材质，不称为实景扫描。原始颜色、OpenGL 法线贴图、预览和来源记录位于 assets-source/snow001/。

## 实现

- 雪地以世界坐标铺设颜色与法线贴图；法线细节参与实时光照，与原有高度场、接触阴影和脚印结合。
- 雪球使用物体局部坐标三向混合贴图，减轻球面接缝；法线随雪球旋转，纹理随球滚动，不留在屏幕或地面位置。
- 使用 512×512 贴图和 mipmaps。没有新增几何或 draw call；新增纹理显存约 2.67 MiB（含 mipmaps），自然场景纹理总量约 4.48 MiB。
- 原图经 FFmpeg 缩放、JPEG 编码，颜色 5767 字节，法线 11739 字节。npm run assets:snow 可重现 src/snow-textures.js。
- 两张小图以生成的 data URL 随离线 JS 包交付，避免 file:// 图片直接上传 WebGL 的跨源限制，不使用网络加载。单图均小于 100 KiB；初始化及上下文恢复时上传，销毁后旧的异步回调不再上传。

## 验证

- 47 项单元测试、18 个离线文件检查、源码审计、构建、ZIP 内容及产物审计通过。
- 自然场景浏览器检查覆盖四种视口、双视角、低画质、交互、离线 file URL、上下文丢失/恢复；新增断言确认两张真实雪贴图加载成功，恢复后及离线模式仍各加载两张。
- 雪/云高度场与边缘交互检查通过；内置浏览器已刷新并验证滚球与雪面颗粒。
- 未重跑水面专用浏览器套件；未作 Android/iOS 真机性能验收。

产物：artifacts/zelda-water-garden-minitool-v1.11.6.zip，467828 字节，18 项。
SHA-256：65cff6ca068974cd0b444d68a0f2aba92b305746d44c978974174fefa9d5e2ca。
