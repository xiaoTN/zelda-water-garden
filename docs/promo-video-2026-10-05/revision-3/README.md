# 第三版：三景结尾使用水面配乐

用户要求：结尾背景音乐继续使用水的 BGM。

成片：`artifacts/promo/moment-water-promo-v3.mp4`。52 秒，1080×1440，30 fps，H.264/AAC 48 kHz，17,063,907 字节。

SHA-256：`a2dd9ae489697b43632d367f3c3d0ecc1e2365c8f5a8f52d9c0187ba3bc19100`。

## 修改

结尾 44–52 秒换成 `assets-source/audio/water-music.mp3` 的 44–52 秒片段，来源见 `assets-source/audio/music-manifest.json`。原文件保持不变。降低 12 dB 与前段原声衔接；淡入 0.6 秒，与云层尾声交叉淡化；最后 2.4 秒渐隐。结尾不叠加此前的云层原声，交叠仅存在于 44–44.6 秒转场。

画面沿用第二版，包含有环形波纹的水光图、雪与云各 4.5 秒主体展示、三景合影、文楷和悬念文案。视频包直接复制，无二次画质损失。前八段声音仍来自原录屏；此次按时间线 PCM 混音重新编码 AAC。

## 验证

- TypeScript 检查通过，`verify.py` 全部通过，详见 `validation.json`。
- 两版视频包 SHA-256 相同：`013367e87d48aacdbf4c203b77b5b36de13c58da07dfc5c3a33af66bbc51c711`。
- 音频峰值 -6.31 dBFS，无削波；整体 RMS -24.99 dBFS。
- 10、19、30、37、42、47 秒六探针均为 0 样本偏移（8 样本扫描精度），相关性不低于 0.99996。
- 27 帧安全区、动态镜头运动与结尾静图停留检测通过。
- 独立复查见 `independent-review.md`；音频测量不等同于人耳试听。
- 本轮只改宣传片音频管线与素材配置，游戏源码和发布包未改；沿用同一游戏源码此前通过的 99 项测试及 package/build/artifact audit。

重新生成命令见 `scripts/promo-video/README.md`。第二版及其视觉终检记录保留。
