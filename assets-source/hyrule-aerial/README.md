# 海拉鲁风格俯瞰背景

2026-10-04 使用 OpenAI imagegen 原创生成，原图为 `hyrule-aerial.png`。这是受海拉鲁风格启发的幻想地形，不是官方地图。

创作方向：垂直俯瞰、无天空与地平线的手绘游戏大地；绿色平原、森林、蜿蜒青蓝河流与湖泊、边缘山脉、远处城堡、细小道路和桥梁。无云、文字或界面，让运行时的真实 3D 云层承担遮挡与拨云效果。

运行 `npm run assets:land`（需要 FFmpeg），将原图缩至 1024×1024 JPEG，质量参数 22。生成的 JPEG 为 83,505 字节，以 data URI 写入 `src/hyrule-background.js`，确保 file:// 离线 WebGL 纹理可用。脚本限制解码图片不超过 100 KiB。原始 PNG 不进入上传 ZIP。
