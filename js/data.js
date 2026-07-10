/**
 * ============================================================
 * 橙猫生存服务器 - 静态站点数据配置
 * ============================================================
 * 编辑此文件即可修改网站所有内容，无需数据库/PHP。
 * 服务器地址：mc.ambercat.top
 * 官网：www.ambercat.top
 * ============================================================
 */
window.__FOXMC_STATIC_DATA__ = {

  // ---- 站点设置 ----
  site: {
    logo_text:     "橙猫生存服务器",
    logo_image:     "",
    server_ip:     "mc.ambercat.top",
    server_mode:   "international"
  },

  // ---- 顶部横幅 ----
  hero: {
    bg_image:       "",
    badge:          "在线奖励送点券，累计时长领大奖！",
    title_line1:    "欢迎来到",
    title_highlight:"橙猫生存服务器",
    subtitle:       "一个纯粹、温馨、持久的 Minecraft 生存家园，Java 版与基岩版跨版本互通",
    features:       ["多版本支持", "跨版本互通", "领地保护"]
  },

  // ---- 服务器配置 ----
  specs: {
    bg_image: "./png/89ce487b74da31797c19a3dc4ffc0d79.jpg",
    title:    "服务器信息",
    subtitle: "了解我们的服务器基础配置与参数",
    items: [
      { title: "游戏版本",   desc: "主版本 1.21.11，基于 Leaves 服务端，支持 ≥1.9 的多个版本进入",       value: "1.21.11",              icon: "./png/CPU.png" },
      { title: "服务器类型", desc: "纯净生存服，支持 Java 版与基岩版跨版本互通，可与好友一起探索世界",    value: "纯净生存",            icon: "./png/RAM.png" },
      { title: "基岩版地址", desc: "基岩版玩家可通过 be.ambercat.top 加入，端口 40078",                     value: "be.ambercat.top",     icon: "./png/network.png" },
      { title: "网页地图",   desc: "随时随地通过浏览器查看服务器地图，地址 maps.ambercat.top",               value: "网页地图",            icon: "./png/SSD.png" }
    ]
  },

  // ---- 如何加入 ----
  help: {
    bg_image: "./png/9cca3afcca8c0a79eac6a39aad5d65ec.jpg",
    title:    "如何加入服务器",
    subtitle: "注意：服务器有白名单，需加入 Q 群联系腐竹获取",
    steps: [
      { title: "加入Q群",   desc: "搜索 QQ 群 992719293 加入，联系腐竹申请白名单（需自愿赞助 ￥3.14）。" },
      { title: "添加服务器", desc: "启动 Minecraft，选择\"多人游戏\" -> \"添加服务器\"，输入 mc.ambercat.top。基岩版玩家使用 be.ambercat.top 端口 40078。" },
      { title: "开始游玩",   desc: "进入服务器后，使用 /dom 指令管理领地，保护你的赛博资产！" }
    ]
  },

  // ---- 游戏特色 ----
  features: {
    bg_image: "./png/7649e2dbc7044ee71743022dd2d51701.jpg",
    title:    "游戏特色",
    subtitle: "探索橙猫生存服务器的独特玩法与系统",
    items: [
      { title: "跨版互通", desc: "无论是 Java 版还是基岩版玩家，都能顺畅加入服务器，与好友一起探索世界。",                         icon: "./egg/002.png" },
      { title: "领地系统", desc: "使用 /dom 指令管理自己的领地，防止赛博资产被恶意破坏，安心建造。",                                 icon: "./egg/003.png" },
      { title: "安全回档", desc: "部署了 CoreProtect 插件，如遇意外可快速恢复建筑与财产，游玩无后顾之忧。",                         icon: "./egg/001.png" }
    ]
  },

  // ---- 游戏截图 ----
  gallery: {
    bg_image: "./png/f5ea0ca06bf5ac36704b7277536ab53d.jpg",
    title:    "游戏截图",
    subtitle: "每一帧都是风景，记录橙猫服务器的精彩瞬间",
    items: [
      { src: "./png/f5ea0ca06bf5ac36704b7277536ab53d.jpg", caption: "温馨的主城地区" },
      { src: "./png/5e1e1be033cbd911e62327519886379f.jpg", caption: "精美的玩家建筑" },
      { src: "./png/9cca3afcca8c0a79eac6a39aad5d65ec.jpg", caption: "广阔的生存世界" },
      { src: "./egg/img1_bcd004c0.jpg",                    caption: "热闹的社区活动" },
      { src: "./egg/img2_ab032cdc.jpg",                    caption: "和谐的玩家互动" }
    ]
  },

  // ---- 团队 ----
  team: {
    bg_image: "./png/achXdg.jpg",
    title:    "管理团队",
    subtitle: "热爱 Minecraft 的运营者，用心维护这片方块世界",
    members: [
      { name: "腐竹",       role: "Server Owner",    desc: "橙猫服务器的创建者与维护者，负责服务器整体运营。", avatar: "./egg/cat.jpg",  contact_link: "#" },
      { name: "管理员",     role: "Admin",           desc: "协助腐竹管理服务器日常事务，维护游戏秩序。",       avatar: "./egg/cat2.jpg", contact_link: "#" }
    ]
  },

  // ---- 加入社区 ----
  community: {
    bg_image:      "./png/wj Narcissa 3.png",
    title:          "加入社区",
    subtitle:       "加入 QQ 群获取白名单，与玩家实时交流",
    qq_text:        "官方QQ群",
    qq_desc:        "获取白名单、最新公告，与服务器玩家实时交流",
    qq_qr:          "",
    qq_link:        "https://qm.qq.com/cgi-bin/qm/qr?k=992719293",
    wechat_text:    "官网访问",
    wechat_desc:    "了解更多服务器信息，查看网页地图",
    wechat_qr:      "",
    wechat_link:    "https://www.ambercat.top"
  },

  // ---- 页脚 ----
  footer: {
    desc:      "橙猫生存服务器 — 一个纯粹、温馨、持久的 Minecraft 生存家园。Java 版与基岩版跨版本互通，友善社区，和谐互助。",
    copyright: "\u00a9 2025 橙猫生存服务器. All rights reserved.",
    friend_links: [
      { name: "我的世界官网",     url: "https://mc.163.com/" },
      { name: "我的世界国际服",  url: "https://www.minecraft.net/" },
      { name: "服务器网页地图",  url: "https://maps.ambercat.top" },
      { name: "服务器站",        url: "https://www.wdsjfwq.com/server-1685.html" }
    ]
  },

  // ---- 公告 ----
  announcements: {
    home: [],
    popup: [
      { id: "whitelist-notice", title: "白名单通知", content: "服务器已开启白名单！请加入 QQ 群 992719293 联系腐竹获取白名单（需自愿赞助 ￥3.14）。", level: "warning" }
    ]
  },

  // ---- 服务器在线状态 ----
  server_status: {
    mode: "static",
    static_text: "最大在线",
    static_value: "2026"
  },

  // ---- 联系表单 ----
  contact: {
    method: "mailto",
    mailto_email: "admin@ambercat.top",
    formspree_id: "",
    success_message: "邮件已通过您的邮箱客户端发送，请检查已发送邮件。"
  }
};
