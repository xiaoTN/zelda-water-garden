# 片刻 · 水光宣传片工程

第四版为 52 秒、1080×1440、30 fps，画面来自用户提供的两段实机视频。雪地与云海各 4.5 秒主体时段，结尾为三张真实截图合影，统一霞鹜文楷，配水面 BGM。柔边采用独立常驻图层，避免转场叠加时边缘亮度突变。

在本目录运行：

```powershell
npm ci --ignore-scripts
python prepare.py
npm run check
python check-edges.py
npm run render
python verify.py
```

Python 需 Pillow、NumPy，FFmpeg/ffprobe 需在 PATH。`prepare.py` 优先使用仓库的 `assets-source/video/` 原件；仅首次缺少时从来源路径复制。`public/media/`、`public/audio/` 为生成文件，不提交。无音效库联网依赖。

交付视频在根目录 `artifacts/promo/moment-water-promo-v4.mp4`，旧版文件保留。全局时间线为 `src/timeline.json`，原声与动态画面使用相同裁入点，动态镜头按原速播放；结尾用 `EndTriptych` 并置三张截图，配原始 `water-music.mp3` 第 44–52 秒，音量 -12 dB、0.6 秒淡入、2.4 秒淡出。

后续只改音频时可运行 `python prepare.py --audio-only --shot end`，再为 `node export.mjs --reuse-video` 指定已验收的画面文件，并将输出设为新版本路径。此路径保留已有视频包，按同一时间线混合 PCM 后编码 AAC，不经过 Remotion 的混音垫头，不再扣除 2048 样本。第四版修改画面，必须完整渲染，不能复用第二、三版视频。最后运行 `python verify.py`。

字幕、分镜和音轨可在 video-shotcraft 工作台继续编辑；原工程 `npm run studio` 同样可预览。`src/workbench.ts` 与主合成共用时间线。工作台默认导出没有本项目 `export.mjs` 的 AAC 垫头补偿；正式成片以 `npm run render` 管线为准。变更音频编码管线后，需重新运行同步检测，不照搬偏移常数。

动态镜头保留已混合的源录屏声音。结尾按用户要求使用游戏的独立水面配乐替换原云层声轨，不能将此版本标为无配乐版。

说明和验收：`docs/promo-video-2026-10-05/revision-4/`。字体原件和许可位于 `assets-source/fonts/lxgw-wenkai/`；`prepare.py` 复制字体并生成三张截图到 public 的忽略目录。
