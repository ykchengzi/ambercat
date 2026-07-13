# MCWEBSI 项目记忆

## 项目概况
橙猫生存服务器 Minecraft 服务器官方网站。
Java版 IP: mc.ambercat.top | 基岩版: be.ambercat.top:40078 | QQ群: 992719293
站主: admin@ambercat.top（腐竹）/ 3665822645@qq.com（管理员）

## 架构
- 静态 HTML 站点 + Cloudflare Pages Functions 代理
- 公开页面：`index.html` + `players.html`
- 资源：`css/style.css` + `js/data.js` + `js/script.js` + `png/`, `egg/`, `assets/`
- Functions：`functions/api/mcs/[[path]].js` 代理上游 API
- 路由配置：`_routes.json` 限制 Function 仅在 `/api/*` 触发
- 保留 `admin/` 和 `user/` PHP 目录（不参与静态部署）

## 静态化改造 (2026-07-10)
- `js/data.js` 是内容配置文件，编辑此文件即可修改网站所有内容
- `js/script.js` 已移除所有 PHP API 依赖，改为从 `data.js` 读取数据
- JS 模块 10 个：State/DOM/Announce/LazyReveal/Gallery/Nav/CMS/ServerStatus/TeamCarousel/ContactForm
- 联系表单默认 mailto（admin@ambercat.top），可在 data.js 切换 Formspree
- 导航栏已移除"登录/注册"按钮
- 团队卡片"联系我"按钮：腐竹→admin@ambercat.top，管理员→3665822645@qq.com

## 目录结构 (Cloudflare Pages 部署)
```
MCWEBSI/
├── index.html              # 网站首页
├── players.html            # 在线玩家页面
├── _routes.json            # 限制 Function 仅在 /api/* 触发
├── css/style.css           # 样式表（暗色主题）
├── js/data.js              # 静态内容配置
├── js/script.js            # 前台 JS
├── functions/api/mcs/[[path]].js   # CORS 代理 Function
├── png/ icon.png           # 站点图标
├── egg/ qq_qr.jpg          # QQ 群二维码
├── admin/ user/            # PHP 后台（不参与静态渲染）
```
Cloudflare Pages 设置: Framework=None, Build command=空, Output directory=/

## 上游 API 代理 (CORS)
- 上游: `http://chengmao.jkun.cf:36779/open-api/players`
- 浏览器直连会被 CORS 拦截，必须走 Function 代理
- Function 路径: `/api/mcs/<rest>` → `http://chengmao.jkun.cf:36779/<rest>`
- 透传响应 + 注入 `Access-Control-Allow-Origin: *`
- 处理 OPTIONS 预检请求
- 禁用缓存 (`Cache-Control: no-store`) 保证数据新鲜

## 玩家页面 (players.html)
- 30 秒自动刷新（`/api/mcs/open-api/players` 过滤 `isOnline: true`）
- 圆形头像 + 玩家名 + 游戏模式
- 点击头像弹出 3D 皮肤预览：skinview3d + Three.js + OrbitControls
- 正版验证：uapis.cn `/api/v1/game/minecraft/userinfo` 返回 skin_url + uuid
- 非正版玩家显示"无法查看皮肤"
- 主页 Hero 状态文字可点击跳转到 players.html

## 重要文件
- `index.html` - 网站首页
- `players.html` - 在线玩家页面
- `js/data.js` - 内容配置（品牌/IP/QQ群/团队邮箱都在这里改）
- `js/script.js` - 前台 JS
- `css/style.css` - 样式表
- `functions/api/mcs/[[path]].js` - CORS 代理
- `_routes.json` - Function 路由控制
