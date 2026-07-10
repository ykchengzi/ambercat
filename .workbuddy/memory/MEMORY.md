# MCWEBSI 项目记忆

## 项目概况
FoxMC（小狐狸生存服）Minecraft 服务器官方网站，作者 QQ: 2769544753。

## 架构
- 原为 PHP+MySQL 动态网站，已改造为纯静态 HTML 站点
- 公开首页：`index.html` + `style.css` + `data.js` + `script.js`
- 管理后台：`admin/` 目录（PHP，需服务器环境才能运行）
- 用户面板：`user/` 目录（PHP，需服务器环境才能运行）
- 静态资源：`png/`、`egg/`、`assets/` 目录

## 静态化改造 (2026-07-10)
- `data.js` 是内容配置文件，编辑此文件即可修改网站所有内容
- `script.js` 已移除所有 PHP API 依赖，改为从 `data.js` 读取数据
- 联系表单默认使用 mailto 协议，可在 `data.js` 中切换为 Formspree
- admin/ 和 user/ 目录保留供需要时使用，不参与静态站点渲染

## 重要文件
- `index.html` - 网站首页（单页应用）
- `data.js` - 静态内容配置
- `script.js` - 前台 JS（11 个模块：State/DOM/UserSession/Announce/LazyReveal/Gallery/Nav/CMS/ServerStatus/TeamCarousel/ContactForm）
- `style.css` - 样式表（暗色主题 CSS 变量系统）
