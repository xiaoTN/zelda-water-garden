# 真实冰面参考与 v1.3 改造

2026-10-03。用户指出 v1.2 冰层太假，要求查找真实参考。重新搜索透明湖冰、薄冰断裂、冰下裂缝、碎冰薄片，最终实际打开并目视检查下面三张摄影图。浏览器截图保存在 `assets-source/references/ice/`，只作对照，不进入运行包。

## 采用的三张实拍

1. [Live Science：Was the Big Bang Like Water Freezing into Ice?](https://www.livescience.com/22573-big-bang-water-freezing.html) 的裂冰近景。深灰绿的透明基底、发白的内部断层、粗细悬殊且相互交错的裂缝；并不是每个封闭多边形都有独立颜色。截图：`clear-fractures-browser.jpg`。
2. [Wild Edge：Lake Baikal Solo Expedition](https://www.wildedge.co/blogs/journal/lake-baikal-solo-expedition) 的脚下冰面照片。可以看到白色断层在不同深度叠加，小气泡和零散霜点悬在深色冰中。局部有宽白带，旁边仍有很清透的大片区域。截图：`baikal-depth-browser.jpg`。
3. [WAZ：Essen 冰面报道](https://www.waz.de/lokales/essen/article410865954/lebensgefahr-stadt-essen-warnt-ausdruecklich-davor-eisflaechen-zu-betreten.html) 的池塘碎冰实拍。碎冰的大小和形状差异很大，亮光集中在切面与棱边；大面透出环境色，并在冰面上留下阴影 / 反射。截图：`pond-shards-browser.jpg`。

也检索到了 Ausable Freshwater Center、Unsplash、Nature Picture Library 等来源。部分原图载入失败或返回 403，未将这些失败页面视为已完成视觉核验的参考。

## 对照后的具体修改

| v1.2 问题 | v1.3 处理 |
| --- | --- |
| 蓝色多边形块面、铺砖式网格 | 删除 Voronoi 分格与逐块明暗，改成连续的灰青透明层 |
| 冰下内容被完全盖住 | 用固定的微折射采样砂石与水色，叠加平滑天空反光 |
| 每条边同样亮，像荧光描边 | 保留少量长短不同的细裂缝，增加有厚度的半透明白色断面 |
| 水洞边缘像六瓣雪花 | 改为随落点变化的不规则多边形破口，边缘有方向性的亮面和暗面 |
| 大雪花图标般的结冰动画 | 去掉六臂图形，保留向外生长的冰膜和细碎凝霜 |
| 整齐方块高高弹起 | 换成大小不一的三角 / 四角薄片，降低抛起高度，缓慢翻转、向外漂移并消失 |
| 裂纹像等间距树枝 | 预生成不等长、轻微折转的应力线和稀疏分叉，破洞内不再绘制裂纹 |

这里借鉴的是实拍材质特征，仍是适合当前林间浅池的艺术化实时效果，不宣称真实冰力学或照片级复现。原有水面配色、倒影与交互保持。
