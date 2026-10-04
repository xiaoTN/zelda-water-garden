# 片刻 · 水光宣传片工程

45 秒、1080×1440、30 fps，全部画面来自用户提供的两段实机视频。

在本目录运行：

```powershell
npm ci --ignore-scripts
python prepare.py
npm run check
npm run render
python verify.py
```

Python 需 Pillow、NumPy，FFmpeg/ffprobe 需在 PATH。`prepare.py` 优先使用仓库的 `assets-source/video/` 原件；仅首次缺少时从来源路径复制。`public/media/`、`public/audio/` 为生成文件，不提交。无音效库联网依赖。

交付视频在根目录 `artifacts/promo/moment-water-promo.mp4`。全局时间线为 `src/timeline.json`，原声与画面使用相同裁入点，所有镜头按原速播放。

字幕、分镜和音轨可在 video-shotcraft 工作台继续编辑；原工程 `npm run studio` 同样可预览。`src/workbench.ts` 与主合成共用时间线。工作台默认导出没有本项目 `export.mjs` 的 AAC 垫头补偿；正式成片以 `npm run render` 管线为准。变更音频编码管线后，需重新运行同步检测，不照搬偏移常数。

源录屏声音已混合，本工程保留它，不额外叠加配乐，不能将此版本标为无配乐版。需要更换背景音乐时，应回到游戏原始独立音效重新混音。

说明和验收：`docs/promo-video-2026-10-05/`。
