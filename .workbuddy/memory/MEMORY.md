# MCWEBSI 项目记忆

## 项目概况
橙猫生存服务器 Minecraft 服务器官方网站。
Java版 IP: mc.ambercat.top | 基岩版: be.ambercat.top:40078 | QQ群: 992719293

## 架构
- 原为 PHP+MySQL 动态网站，已改造为纯静态 HTML 站点
- 公开首页：`index.html` + `css/style.css` + `js/data.js` + `js/script.js`
- 管理后台：`admin/` 目录（PHP，需服务器环境才能运行）
- 用户面板：`user/` 目录（PHP，需服务器环境才能运行）
- 静态资源：`png/`、`egg/`、`assets/` 目录

## 静态化改造 (2026-07-10)
- `js/data.js` 是内容配置文件，编辑此文件即可修改网站所有内容
- `js/script.js` 已移除所有 PHP API 依赖，改为从 `data.js` 读取数据
- JS 模块从 11 个减为 10 个（移除了 UserSession 模块）
- 联系表单默认使用 mailto 协议，可在 `data.js` 中切换为 Formspree
- admin/ 和 user/ 目录保留供需要时使用，不参与静态站点渲染
- 导航栏已移除"登录/注册"按钮

## 目录结构 (Cloudflare Pages 部署适配)
```
MCWEBSI/
├── index.html        # 网站首页
├── css/style.css     # 样式表（暗色主题 CSS 变量系统）
├── js/data.js        # 静态内容配置
├── js/script.js      # 前台 JS（10 个模块）
├── png/              # 图片资源
├── egg/              # 图片资源
├── assets/           # 其他静态资源
├── admin/            # PHP 后台（不参与静态渲染）
└── user/             # PHP 用户面板（不参与静态渲染）
```
Cloudflare Pages 设置: Framework=None, Build command=空, Output directory=/

## 重要文件
- `index.html` - 网站首页（单页应用）
- `js/data.js` - 静态内容配置（品牌信息、IP、QQ群等都在这里改）
- `js/script.js` - 前台 JS（10 个模块：State/DOM/Announce/LazyReveal/Gallery/Nav/CMS/ServerStatus/TeamCarousel/ContactForm）
- `css/style.css` - 样式表（暗色主题 CSS 变量系统）
