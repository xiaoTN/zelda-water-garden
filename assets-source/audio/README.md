# 音频素材

`water-tap.mp3`：用户于 2026-10-04 提供的轻点水滴声，原文件名 `ddd47728614d48f88ac844c823e267c3.mp3`，来源为 `D:/BaiduNetdiskDownload/`。按用途重命名并复制入项目，来源文件保留。

原始 MP3 字节不变：5,686 字节，22,050 Hz、双声道、容器时长约 0.608 秒。SHA-256：`ecb10155e018c8e34cdf628e0566ec1ba013d4d2724172d72036335a6de1e91f`。

`water-swipe.mp3`：用户于 2026-10-04 提供的手指滑动水面水流声，原文件名 `335cd12ed8fd4662a09a27d066eadae4.mp3`，来源为 `D:/BaiduNetdiskDownload/`。按用途重命名并复制入项目，来源文件保留。原始字节不变：52,763 字节，22,050 Hz、单声道、时长约 6.5 秒。SHA-256：`4ec742a383a84833ae38af6215497741c318bc5a48b295d3e8ddcf38e7823342`。

`stone-impact.mp3`：用户于 2026-10-04 指定的石头入水声，来源为 [爱给音频文件](https://s1.aigei.com/src/aud/mp3/a7/a70922a8c46748c0af1ae8c34f0b83f9.mp3)，下载时使用用户提供的临时链接。按用途命名，完整保留原始字节：25,805 字节，22,050 Hz、单声道、容器时长约 3.130 秒。SHA-256：`a260cf244dbcee3b2ee3d7753f021a06f52bd5ac819f84a91cf630ef5dddf5b6`。仅在石头接触水面时播放一次，保留原有起音与自然尾音，不额外淡入淡出。

`water-ripples.mp3`：用户于 2026-10-04 指定的水波荡漾声，来源为 [爱给音频文件](https://s8.aigei.com/src/aud/mp3/0a/0a3c08d94728401d9f719716336b566c.mp3)，下载时使用用户提供的临时链接。完整保留原始字节：64,827 字节，22,050 Hz、双声道、容器时长约 8.011 秒。SHA-256：`36b14179708f11b3aa98b29c32a4b642b9ee9c76be77e2dd85884eb700d2bdae`。运行时循环尾首交叉淡化 120 毫秒，音量随实际波场强度平滑变化，水波消散后淡出。

`npm run audio` 将这四个样本生成至 `src/water-tap-asset.js`、`src/water-swipe-asset.js`、`src/stone-impact-asset.js` 和 `src/water-ripples-asset.js`，完整构建自动执行该步骤。小工具上传类型清单未列出 MP3，运行包因此携带小型 Base64 字节数据，通过 Web Audio 直接解码为可复用的 AudioBuffer；不使用媒体 data URL、网络请求或运行时文件读取。原始 MP3 只保留在素材目录中，ZIP 中的脚本与原始字节一致性由测试验证。

滑动录音在运行时把尾部与开头交叉淡化 120 毫秒，形成约 6.38 秒的循环；原始 MP3 保持完整。滑动只复用一个循环声源，音量随手速变化，停手后淡出。

## 场景背景音乐（2026-10-04）

用户提供的三条爱给临时下载链接分别保存为 `water-music.mp3`（水）、`snow-music.mp3`（雪）、`cloud-music.mp3`（云）。完整原始字节保留；来源、时长、采样率、声道、文件大小与 SHA-256 见 [music-manifest.json](music-manifest.json)，不记录短期访问 token。

`runtime/` 保存完整时长的离线播放副本：22,050 Hz、单声道、MP3 32 kbps，无裁剪和归一化。压缩体积分别约 451 / 499 / 246 kB。使用 `npm run audio:music`（需 FFmpeg / ffprobe）再生成副本和来源清单；常规构建仅依赖已提交的播放副本，不需要 FFmpeg。

`npm run audio` 生成三个 `src/*-music-asset.js`。与现有音效一致，使用小于 1 MiB 的独立 Base64 脚本和 Web Audio 解码，不使用媒体 data URL 或网络。超过 100 KiB 的风险已审查：上传类型清单不允许 MP3，原曲完整时长由用户要求，副本已经减半；仅当前场景按需解码，旧场景淡出结束释放声源、增益和解码缓冲。运行时将尾首交叉淡化 800 毫秒，循环长度因此略短于原文件。
