# 二次元水面与冰元素参考 · v1.5.0

研究日期：2026-10-03。根据用户要求，替换 v1.3 / v1.4 的写实水光与真实薄冰方向，删除落石玩法。

## 实际查看的参考

1. [Roystan · Toon Water Shader](https://roystan.net/articles/toon-water/)：作者的技术教程，说明浅深水色、噪声阈值化水纹和接触岸边的白沫。这里借鉴视觉分层原则，使用本工具已有岸线距离场实现，不移植 Unity 深度缓冲代码。
2. [Cyanilux · Shoreline Shader Breakdown](https://www.cyanilux.com/tutorials/shoreline-shader-breakdown/)：实际打开并查看其 Preview.png。白沫分成贴岸亮边、稍远的断续波峰，并有缓慢进退。观察截图位于 `assets-source/references/anime/shoreline-browser.jpg`。
3. [Game8 · 原神璃月地灵龛攻略中的凯亚渡水实机图](https://game8.jp/genshin/354741)：实际打开原图 `https://img.game8.jp/5135920/929739e3360f6817fa2ae9bd7a6379ce.jpeg/original`。可见浅蓝冰底、密集白色不规则冰纹、霜白边缘以及施放时的雪晶亮点。观察截图位于 `assets-source/references/anime/genshin-ice-browser.jpg`。此项是实机视觉参考，不是对《原神》底层技术实现的判断。

## 对应实现

- 水色改为浅岸薄荷青、中层青绿和深处青蓝三层；取消强烈的镜面日光带与密集细碎反射。
- 岸边白沫随岸线生成，带微小不规则起伏；内侧两层断续细纹缓慢变化。减少动态效果设置下停止水面材质漂动。
- 冰层使用原创程序生成的密集折线冰纹、蓝白晶面、局部霜白和稀疏亮点。冻结边界用不规则多边形，混合采样柔化低分辨率网格轮廓。
- 冻结时出现短暂小雪晶，碎片有更清楚的蓝白切面和短促弹起。冻结、踩碎、整池冻结、融冰、手指画冰径都保留。
- Canvas 2D 兜底使用同一程序冰纹转成颜色纹理，同时保留浅深水色与岸边白沫。
- 落石按钮、移动分支、提示文案、玩法文档均移除；保留三种模式：拨水、浮叶、冰霜。

全部纹理与粒子为原创程序绘制。参考截图仅供研发对照，不进入离线上传包。
