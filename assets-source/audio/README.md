# 音频素材

`water-tap.mp3`：用户于 2026-10-04 提供的轻点水滴声，原文件名 `ddd47728614d48f88ac844c823e267c3.mp3`，来源为 `D:/BaiduNetdiskDownload/`。按用途重命名并复制入项目，来源文件保留。

原始 MP3 字节不变：5,686 字节，22,050 Hz、双声道、容器时长约 0.608 秒。SHA-256：`ecb10155e018c8e34cdf628e0566ec1ba013d4d2724172d72036335a6de1e91f`。

`npm run audio` 将这个小样本生成至 `src/water-tap-asset.js`，完整构建自动执行该步骤。小工具上传类型清单未列出 MP3，运行包因此携带小型 Base64 字节数据，通过 Web Audio 直接解码为可复用的 AudioBuffer；不使用媒体 data URL、网络请求或运行时文件读取。原始 MP3 只保留在素材目录中，ZIP 中的脚本与原始字节一致性由测试验证。
