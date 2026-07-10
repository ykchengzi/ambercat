<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/backup.php';
requireLogin();
requireAdIntegrity();

// 启用输出缓冲，页面末尾做广告输出校验（防注释包裹 / 内联隐藏 / 节点被抽走）
ob_start();

$content = loadContent();
$settings = loadSettings();
$csrf = generateCsrf();
$currentTab = $_GET['tab'] ?? 'dashboard';
$tabs = [
    'dashboard'  => ['label' => '后台首页',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>'],
    'site'       => ['label' => '网站设置',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'],
    'hero'       => ['label' => '首页横幅',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'],
    'specs'      => ['label' => '服务器配置', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>'],
    'help'       => ['label' => '加入指南',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'],
    'features'   => ['label' => '游戏特色',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'],
    'gallery'    => ['label' => '游戏截图',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'],
    'team'       => ['label' => '管理团队',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'],
    'monitor'    => ['label' => '实时监控', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'],
    'messages'   => ['label' => '消息通知',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>'],
    'announcements' => ['label' => '公告管理', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>'],
    'tickets'    => ['label' => '工单管理',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'],
    'logs'       => ['label' => '行为日志',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>'],
    'risk'       => ['label' => '风控分析',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg>'],
    'users'      => ['label' => '用户管理',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>'],
    'applications' => ['label' => '入服申请',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-5"/></svg>'],
    'shop_revenue' => ['label' => '收益概览', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/><path d="M14 7h5v5"/></svg>'],
    'shop_products' => ['label' => '商品管理', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>'],
    'shop_orders' => ['label' => '订单管理', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>'],
    'shop_inventory' => ['label' => '库存管理', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>'],
    'shop_delivery' => ['label' => '发货链路', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M21 14v5a2 2 0 0 1-2 2h-5"/><path d="M3 10V5a2 2 0 0 1 2-2h5"/><path d="M3 14l7 7"/><path d="M3 21h5v-5"/></svg>'],
    'shop_payments' => ['label' => '支付设置', 'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h1"/><path d="M11 15h3"/></svg>'],
    'community'  => ['label' => '社区链接',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'],
    'footer'     => ['label' => '页脚设置',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>'],
    'backup'     => ['label' => '备份恢复',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>'],
    'images'     => ['label' => '图片管理',   'icon' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="0"/></svg>'],
];
$siteTabs = ['site', 'hero', 'specs', 'help', 'features', 'gallery', 'team', 'monitor', 'community', 'footer', 'images'];
$shopTabs = ['shop_revenue', 'shop_products', 'shop_orders', 'shop_inventory', 'shop_delivery', 'shop_payments'];
$mainTabs = ['dashboard', 'messages', 'announcements', 'tickets', 'logs', 'risk', 'users', 'applications'];
$systemTabs = ['backup'];

/**
 * 设置类标签按需渲染：
 * - 当前页就是设置标签之一 → 把所有 9 个设置表单全部渲染到 DOM，子菜单之间走 SPA 切换。
 * - 否则 → 9 个设置标签只输出占位空 div，节省首屏 HTML（~100KB→~10KB）。
 * 注意：monitor 由于依赖大量 JS 行为，始终保留在 DOM 中（不算"纯表单"），不参与按需渲染。
 */
$lazySettingsTabs = ['site', 'hero', 'specs', 'help', 'features', 'gallery', 'team', 'community', 'footer', 'images'];
$renderSettingsTabs = in_array($currentTab, $siteTabs, true);

$msg = $_GET['msg'] ?? '';

$imgAttr = function($url, $tab) use ($currentTab) {
    if (empty($url)) return '';
    $fullUrl = "../" . e($url);
    if ($tab === $currentTab) {
        return 'src="' . $fullUrl . '"';
    }
    return 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="' . $fullUrl . '"';
};

// Calculate unread messages（直接 SQL COUNT，避免读全表）
$unreadCount = isUserSystemInstalled() ? countUnreadMessages() : 0;
$pendingApplicationsCount = 0;
$openTicketsCount = 0;
$dashboardStats = ['today_users' => 0, 'today_applications' => 0, 'pending_applications' => 0, 'approved_unsynced' => 0, 'need_more_info' => 0, 'open_tickets' => 0, 'recent_rejected' => 0];
if (isUserSystemInstalled()) {
    try {
        $dashboardStats = getDashboardStats();
        $pendingApplicationsCount = $dashboardStats['pending_applications'];
        $openTicketsCount = $dashboardStats['open_only_tickets'] ?? $dashboardStats['open_tickets'];
    } catch (Throwable $e) {
        $pendingApplicationsCount = 0;
        $openTicketsCount = 0;
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>网站管理后台</title>
    <meta name="robots" content="noindex, nofollow">
    <?php $cssV = max(
        @filemtime(__DIR__.'/css/variables.css'),
        @filemtime(__DIR__.'/css/layout.css'),
        @filemtime(__DIR__.'/css/forms.css'),
        @filemtime(__DIR__.'/css/components.css'),
        @filemtime(__DIR__.'/css/shop.css'),
        @filemtime(__DIR__.'/css/login.css'),
        @filemtime(__DIR__.'/css/monitor.css'),
        @filemtime(__DIR__.'/css/modals.css'),
        @filemtime(__DIR__.'/css/utilities.css')
    ); ?>
    <link rel="stylesheet" href="css.php?b=panel&amp;v=<?= $cssV ?>">
</head>
<body>
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4H20V20H4V4Z"/><path d="M4 12H20"/><path d="M12 4V20"/></svg>
                <span class="sidebar-title">FoxMC 后台</span>
            </div>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-section">
                <div class="nav-section-title">常用管理</div>
                <?php foreach ($mainTabs as $key): $t = $tabs[$key]; ?>
                <a href="#tab-<?= $key ?>" onclick="switchTab('<?= $key ?>'); return false;" class="nav-item <?= $currentTab === $key ? 'active' : '' ?>" id="nav-<?= $key ?>">
                    <?= $t['icon'] ?>
                    <span><?= $t['label'] ?></span>
                    <?php if ($key === 'messages' && $unreadCount > 0): ?>
                        <span class="badge"><?= $unreadCount > 99 ? '99+' : $unreadCount ?></span>
                    <?php endif; ?>
                    <?php if ($key === 'applications' && $pendingApplicationsCount > 0): ?>
                        <span class="badge" id="pendingApplicationsBadge"><?= $pendingApplicationsCount > 99 ? '99+' : $pendingApplicationsCount ?></span>
                    <?php elseif ($key === 'applications'): ?>
                        <span class="badge" id="pendingApplicationsBadge" style="display:none;"></span>
                    <?php endif; ?>
                    <?php if ($key === 'tickets' && $openTicketsCount > 0): ?>
                        <span class="badge" id="openTicketsBadge"><?= $openTicketsCount > 99 ? '99+' : $openTicketsCount ?></span>
                    <?php elseif ($key === 'tickets'): ?>
                        <span class="badge" id="openTicketsBadge" style="display:none;"></span>
                    <?php endif; ?>
                </a>
                <?php endforeach; ?>
            </div>

            <div class="nav-section">
                <div class="nav-group <?= in_array($currentTab, $shopTabs, true) ? 'open' : '' ?>">
                    <button type="button" class="nav-item nav-group-toggle <?= in_array($currentTab, $shopTabs, true) ? 'active' : '' ?>" onclick="toggleNavGroup(this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L23 6H6"/></svg>
                        <span>商城管理</span>
                        <svg class="nav-group-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="nav-submenu">
                        <?php foreach ($shopTabs as $key): $t = $tabs[$key]; ?>
                        <a href="#tab-<?= $key ?>" onclick="switchTab('<?= $key ?>'); return false;" class="nav-subitem <?= $currentTab === $key ? 'active' : '' ?>" id="nav-<?= $key ?>">
                            <span><?= $t['label'] ?></span>
                        </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <div class="nav-section">
                <div class="nav-group <?= in_array($currentTab, $siteTabs, true) ? 'open' : '' ?>">
                    <button type="button" class="nav-item nav-group-toggle <?= in_array($currentTab, $siteTabs, true) ? 'active' : '' ?>" onclick="toggleNavGroup(this)">
                        <?= $tabs['site']['icon'] ?>
                        <span>网站设置</span>
                        <svg class="nav-group-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="nav-submenu">
                        <?php foreach ($siteTabs as $key): $t = $tabs[$key]; ?>
                        <?php
                        // monitor 始终在 DOM 中，可以走 SPA 切换；其余设置标签当前未渲染时需要整页加载
                        $needsReload = !$renderSettingsTabs && in_array($key, $lazySettingsTabs, true);
                        ?>
                        <?php if ($needsReload): ?>
                        <a href="?tab=<?= $key ?>" class="nav-subitem <?= $currentTab === $key ? 'active' : '' ?>" id="nav-<?= $key ?>">
                            <span><?= $t['label'] ?></span>
                        </a>
                        <?php else: ?>
                        <a href="#tab-<?= $key ?>" onclick="switchTab('<?= $key ?>'); return false;" class="nav-subitem <?= $currentTab === $key ? 'active' : '' ?>" id="nav-<?= $key ?>">
                            <span><?= $t['label'] ?></span>
                        </a>
                        <?php endif; ?>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">系统</div>
                <?php foreach ($systemTabs as $key): $t = $tabs[$key]; ?>
                <a href="#tab-<?= $key ?>" onclick="switchTab('<?= $key ?>'); return false;" class="nav-item <?= $currentTab === $key ? 'active' : '' ?>" id="nav-<?= $key ?>">
                    <?= $t['icon'] ?>
                    <span><?= $t['label'] ?></span>
                </a>
                <?php endforeach; ?>
            </div>

            <div class="nav-divider"></div>
            <a href="../index.html" class="nav-item" target="_blank">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>前往前台</span>
            </a>
            <a href="index.php?action=logout" class="nav-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>退出登录</span>
            </a>
        </nav>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <button class="mobile-menu-btn" id="mobileMenuBtn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h2 class="topbar-title" id="page-title"><?= e($tabs[$currentTab]['label'] ?? '管理后台') ?></h2>
            <div class="topbar-actions">
                <div class="topbar-profile" onclick="openProfileModal()">
                    <img src="<?= !empty($settings['admin_avatar']) ? e($settings['admin_avatar']) : '../assets/images/cat.jpg' ?>" alt="Avatar" id="topbarAvatar">
                    <span class="topbar-user">管理员</span>
                </div>
            </div>
        </header>

        <!-- Profile Modal -->
        <div id="profileModal" class="modal-overlay" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>管理员账号设置</h3>
                    <button type="button" class="close-modal" onclick="closeProfileModal()">×</button>
                </div>
                <form id="profileForm" method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="profile">
                    
                    <div class="form-group" style="text-align: center;">
                        <div class="avatar-upload-preview">
                            <img src="<?= !empty($settings['admin_avatar']) ? e($settings['admin_avatar']) : '../assets/images/cat.jpg' ?>" id="avatarPreview">
                            <label for="avatarInput" class="avatar-edit-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </label>
                            <input type="file" id="avatarInput" name="avatar" accept="image/*" style="display: none;" onchange="previewAvatar(this)">
                        </div>
                        <p class="file-hint">点击图标修改头像</p>
                    </div>

                    <div class="form-group">
                        <label>新密码 (留空则不修改)</label>
                        <input type="password" name="new_password" class="form-input" placeholder="输入新密码">
                    </div>
                    
                    <div class="form-group">
                        <label>确认新密码</label>
                        <input type="password" name="confirm_password" class="form-input" placeholder="再次输入新密码">
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="closeProfileModal()">取消</button>
                        <button type="submit" class="btn-save">保存设置</button>
                    </div>
                </form>
            </div>
        </div>

<?= renderAdBanner($settings) ?>

        <?php
            // U1: 检测当前是否仍在用默认密码 123456
            $usingDefaultPass = false;
            try {
                $usingDefaultPass = password_verify(ADMIN_DEFAULT_PASS, getAdminPassHash());
            } catch (Throwable $_passEx) { /* 静默处理：仅是提示，不影响主流程 */ }
        ?>
        <?php if ($usingDefaultPass): ?>
        <div class="security-notice security-notice--warning">
            <div class="security-notice__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div class="security-notice__body">
                <div class="security-notice__title">您当前仍在使用默认密码 <code>123456</code></div>
                <div class="security-notice__desc">为了账号安全，建议立即前往「个人资料」修改为只有您知道的强密码。</div>
            </div>
            <button type="button" onclick="openProfileModal()" class="security-notice__action security-notice__action--warning">
                立即修改密码
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
        </div>
        <?php endif; ?>

        <?php if ($msg === 'ok'): ?>
        <div class="alert success">保存成功！内容已更新。</div>
        <?php elseif ($msg === 'err'): ?>
        <div class="alert error">保存失败，请检查文件权限。</div>
        <?php elseif ($msg === 'csrf'): ?>
        <div class="alert error">安全验证失败，请重新提交。</div>
        <?php endif; ?>

        <div class="page-content">
            
            <div id="tab-dashboard" class="tab-pane" style="display: <?= $currentTab === 'dashboard' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">运营待办概览</h3>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px;">
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:18px;"><div style="font-size:1.8em;font-weight:800;color:#16a34a;"><?= (int)$dashboardStats['today_users'] ?></div><div style="color:#475569;font-size:.9em;">今日新增注册</div></div>
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:18px;"><div style="font-size:1.8em;font-weight:800;color:#16a34a;"><?= (int)$dashboardStats['today_applications'] ?></div><div style="color:#475569;font-size:.9em;">今日新增申请</div></div>
                        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:14px;padding:18px;"><div style="font-size:1.8em;font-weight:800;color:#ca8a04;"><?= (int)$dashboardStats['pending_applications'] ?></div><div style="color:#475569;font-size:.9em;">待审核申请</div></div>
                        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px;"><div style="font-size:1.8em;font-weight:800;color:#2563eb;"><?= (int)$dashboardStats['approved_unsynced'] ?></div><div style="color:#475569;font-size:.9em;">已通过未同步白名单</div></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:20px;">
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;"><strong style="color:#0f172a;">申请审核</strong><span style="color:#ca8a04;font-weight:800;"><?= (int)$dashboardStats['pending_applications'] ?></span></div>
                            <p style="margin:0 0 12px;color:#64748b;font-size:.88em;">优先处理待审核申请，降低玩家等待时间。</p>
                            <button type="button" onclick="switchTab('applications')" style="border:none;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">去审核</button>
                        </div>
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;"><strong style="color:#0f172a;">白名单同步</strong><span style="color:#2563eb;font-weight:800;"><?= (int)$dashboardStats['approved_unsynced'] ?></span></div>
                            <p style="margin:0 0 12px;color:#64748b;font-size:.88em;">已通过但未同步的申请需要复制命令到服务器执行。</p>
                            <button type="button" onclick="switchTab('applications')" style="border:1px solid #bfdbfe;padding:10px 16px;border-radius:8px;background:#eff6ff;color:#1d4ed8;cursor:pointer;">去同步</button>
                        </div>
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;"><strong style="color:#0f172a;">待跟进申请</strong><span style="color:#ca8a04;font-weight:800;"><?= (int)($dashboardStats['need_more_info'] ?? 0) ?></span></div>
                            <p style="margin:0 0 12px;color:#64748b;font-size:.88em;">已要求补充信息的申请，适合定期复查或通知提醒。</p>
                            <button type="button" onclick="switchTab('applications')" style="border:1px solid #fde68a;padding:10px 16px;border-radius:8px;background:#fefce8;color:#a16207;cursor:pointer;">查看申请</button>
                        </div>
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;"><strong style="color:#0f172a;">待处理工单</strong><span style="color:#dc2626;font-weight:800;"><?= (int)($dashboardStats['open_tickets'] ?? 0) ?></span></div>
                            <p style="margin:0 0 12px;color:#64748b;font-size:.88em;">玩家反馈、举报、申诉和建议需要及时回复。</p>
                            <button type="button" onclick="switchTab('tickets')" style="border:1px solid #fecaca;padding:10px 16px;border-radius:8px;background:#fef2f2;color:#b91c1c;cursor:pointer;">处理工单</button>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button type="button" onclick="switchTab('applications')" style="border:none;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">处理入服申请</button>
                        <button type="button" onclick="switchTab('messages')" style="border:1px solid #dcfce7;padding:10px 16px;border-radius:8px;background:#fff;color:#15803d;cursor:pointer;">查看消息通知</button>
                        <button type="button" onclick="switchTab('risk')" style="border:1px solid #fee2e2;padding:10px 16px;border-radius:8px;background:#fff;color:#dc2626;cursor:pointer;">查看风险分析</button>
                    </div>
                </div>
            </div>

            <div id="tab-announcements" class="tab-pane" style="display: <?= $currentTab === 'announcements' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">公告管理</h3>
                    <details id="announcementComposer" class="announcement-composer">
                        <summary>
                            <span>发布 / 编辑公告</span>
                            <span id="announcementsCount">点击展开填写公告内容</span>
                        </summary>
                        <div class="announcement-editor">
                            <input type="hidden" id="announcementId" value="">
                            <div class="announcement-main">
                                <div class="form-group"><label>公告标题</label><input type="text" id="announcementTitle" class="form-input" maxlength="120" placeholder="例如：周末活动公告"></div>
                                <div class="form-group announcement-content-field"><label>公告内容</label><textarea id="announcementContent" class="form-input" rows="4" placeholder="输入公告内容..."></textarea></div>
                            </div>
                            <div class="announcement-side">
                                <div class="announcement-side-row">
                                    <div class="form-group"><label>公告类型</label><select id="announcementLevel" class="form-input"><option value="info">普通</option><option value="success">活动</option><option value="warning">维护</option><option value="danger">紧急</option></select></div>
                                    <div class="form-group"><label>发布时间</label><input type="datetime-local" id="announcementPublishAt" class="form-input"></div>
                                </div>
                                <div class="announcement-side-row">
                                    <div class="form-group"><label>开始生效时间</label><input type="datetime-local" id="announcementStartAt" class="form-input"></div>
                                    <div class="form-group"><label>结束时间</label><input type="datetime-local" id="announcementEndAt" class="form-input"></div>
                                </div>
                                <div class="announcement-options">
                                    <label><input type="checkbox" id="announcementPinned"> 置顶</label>
                                    <label><input type="checkbox" id="announcementActive" checked> 启用</label>
                                    <label><input type="checkbox" id="announcementShowInHome"> 首页显示</label>
                                    <label><input type="checkbox" id="announcementShowInUserCenter" checked> 用户中心显示</label>
                                    <label><input type="checkbox" id="announcementShowAsPopup"> 维护弹窗</label>
                                </div>
                                <div class="announcement-actions">
                                    <button type="button" onclick="saveAnnouncement()" class="btn-primary">保存公告</button>
                                    <button type="button" onclick="resetAnnouncementForm()" class="btn-secondary">清空</button>
                                </div>
                            </div>
                        </div>
                    </details>
                    <div id="announcementsList" style="display:grid;gap:10px;"></div>
                </div>
            </div>

            <div id="tab-tickets" class="tab-pane" style="display: <?= $currentTab === 'tickets' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">工单管理</h3>
                    <details class="application-settings-panel" style="margin-bottom:16px;">
                        <summary class="application-settings-summary">
                            <span>工单频率限制</span>
                            <span>0 表示不限制</span>
                        </summary>
                        <form method="POST" action="save.php" data-ajax="true" class="application-settings-form" style="margin-top:14px;">
                            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                            <input type="hidden" name="tab" value="ticket_settings">
                            <div class="settings-panel-head">
                                <div>
                                    <h4>提交频率</h4>
                                    <p>限制普通用户在指定时间窗口内可新建的工单数量；不影响已有工单回复。</p>
                                </div>
                                <button type="submit" class="btn-save small">保存限制</button>
                            </div>
                            <div class="compact-field-grid">
                                <div class="form-group">
                                    <label>时间窗口（小时）</label>
                                    <input type="number" min="0" max="8760" name="ticket_rate_limit_hours" value="<?= e((string)($settings['ticket_rate_limit_hours'] ?? 0)) ?>" class="form-input" placeholder="例如 24">
                                </div>
                                <div class="form-group">
                                    <label>最多提交工单数</label>
                                    <input type="number" min="0" max="999" name="ticket_rate_limit_count" value="<?= e((string)($settings['ticket_rate_limit_count'] ?? 0)) ?>" class="form-input" placeholder="例如 3">
                                </div>
                            </div>
                        </form>
                    </details>
                    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                        <select id="ticketStatusFilter" class="form-input" style="width:auto;min-width:140px;">
                            <option value="">全部工单</option>
                            <option value="open">待处理</option>
                            <option value="replied">已回复</option>
                            <option value="closed">已关闭</option>
                        </select>
                        <button type="button" onclick="loadTicketsList()" style="border:none;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">刷新</button>
                    </div>
                    <div id="ticketsList" style="display:grid;gap:12px;"></div>
                    <div id="ticketsPagination" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:16px;"></div>
                </div>
            </div>

            <div id="tab-logs" class="tab-pane" style="display: <?= $currentTab === 'logs' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">行为日志</h3>
                    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                        <div style="flex:1;min-width:220px;position:relative;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="logSearchInput" class="form-input" placeholder="搜索用户名 / 邮箱 / 游戏ID / IP / 详情..." style="padding-left:36px;">
                        </div>
                        <select id="logActionFilter" class="form-input" style="width:auto;min-width:160px;">
                            <option value="">全部行为</option>
                        </select>
                        <button type="button" onclick="loadUserLogs(1)" style="border:none;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">查询</button>
                    </div>
                    <div style="overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;">
                        <table style="width:100%;border-collapse:collapse;font-size:.9em;">
                            <thead style="background:#f8fafc;color:#64748b;">
                                <tr>
                                    <th style="padding:12px;text-align:left;">时间</th>
                                    <th style="padding:12px;text-align:left;">用户</th>
                                    <th style="padding:12px;text-align:left;">行为</th>
                                    <th style="padding:12px;text-align:left;">详情</th>
                                    <th style="padding:12px;text-align:left;">IP</th>
                                </tr>
                            </thead>
                            <tbody id="logsTableBody">
                                <tr><td colspan="5" style="padding:32px;text-align:center;color:#94a3b8;">加载中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="logsPagination" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:16px;"></div>
                </div>
            </div>

            <div id="tab-risk" class="tab-pane" style="display: <?= $currentTab === 'risk' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">风控分析</h3>
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
                        <p style="color:#64748b;font-size:.9em;margin:0;">综合登录暴破、锁定状态、注册集群、IP 黑名单等信号，并提供一键封禁 / 解锁动作。</p>
                        <button type="button" onclick="loadRiskSummary()" style="border:none;padding:9px 14px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">刷新分析</button>
                    </div>
                    <div id="riskThreatBanner" style="margin-bottom:12px;"></div>
                    <div id="riskStatsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;"></div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:12px;">
                        <div style="background:#fff;border:1px solid #fecaca;border-radius:14px;padding:14px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
                                <h4 style="margin:0;color:#dc2626;">登录暴破 IP（24h）</h4>
                                <span style="color:#94a3b8;font-size:.82em;">失败 ≥5 次</span>
                            </div>
                            <div id="riskBruteForceList" style="display:grid;gap:8px;"></div>
                        </div>
                        <div style="background:#fff;border:1px solid #fde68a;border-radius:14px;padding:14px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
                                <h4 style="margin:0;color:#ca8a04;">当前被锁定的 IP / 账号</h4>
                                <span style="color:#94a3b8;font-size:.82em;">可一键解锁</span>
                            </div>
                            <div id="riskLockedList" style="display:grid;gap:8px;"></div>
                        </div>
                    </div>

                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                            <h4 style="margin:0;color:#0f172a;">IP 黑名单</h4>
                            <form id="riskAddBlocklistForm" onsubmit="return riskAddBlocklist(event);" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                                <input type="text" id="riskBlockIpInput" placeholder="IP 地址" required style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;width:160px;">
                                <input type="text" id="riskBlockReasonInput" placeholder="封禁原因（可选）" maxlength="200" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;width:200px;">
                                <select id="riskBlockTtlInput" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;">
                                    <option value="0">永久</option>
                                    <option value="3600">1 小时</option>
                                    <option value="86400">1 天</option>
                                    <option value="604800">7 天</option>
                                    <option value="2592000">30 天</option>
                                </select>
                                <button type="submit" style="border:none;padding:6px 12px;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;font-size:.86em;">封禁</button>
                            </form>
                        </div>
                        <div id="riskBlocklistList" style="display:grid;gap:8px;"></div>
                    </div>

                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
                            <h4 style="margin:0;color:#0f172a;">近期需关注申请</h4>
                            <span style="color:#94a3b8;font-size:.84em;">优先复查拒绝、需补充和异常申请</span>
                        </div>
                        <div id="riskApplicationsList" style="display:grid;gap:8px;"></div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:12px;">
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <h4 style="margin:0 0 10px;color:#dc2626;">注册集群（24h 内同 IP 多账号注册）</h4>
                            <div id="riskRegisterClusterList" style="display:grid;gap:8px;"></div>
                        </div>
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <h4 style="margin:0 0 10px;color:#ca8a04;">新注册即申请（≤5 分钟）</h4>
                            <div id="riskQuickApplyList" style="display:grid;gap:8px;"></div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <h4 style="margin:0 0 10px;color:#0f172a;">同 IP 多账号</h4>
                            <div id="riskMultiIpList" style="display:grid;gap:8px;"></div>
                        </div>
                        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <h4 style="margin:0 0 10px;color:#0f172a;">24 小时高频 IP</h4>
                            <div id="riskHighFreqList" style="display:grid;gap:8px;"></div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px;">
                        <details open style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <summary style="cursor:pointer;color:#0f172a;font-weight:800;">申请来源统计</summary>
                            <div id="riskSourceStatsList" style="display:grid;gap:8px;margin-top:10px;"></div>
                        </details>
                        <details style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
                            <summary style="cursor:pointer;color:#0f172a;font-weight:800;">审核质量分析</summary>
                            <div id="riskReviewQualityList" style="display:grid;gap:8px;margin-top:10px;"></div>
                        </details>
                    </div>
                </div>
            </div>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-site" class="tab-pane" style="display: <?= $currentTab === 'site' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="site">
                    <div class="form-section">
                        <h3 class="section-title">服务器类型</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">选择您服务器所属的平台类型。</p>
                        <div class="server-mode-selector">
                            <?php
                            $currentMode = $content['site']['server_mode'] ?? 'international';
                            $serverModes = [
                                'international' => ['label' => '官方国际服', 'icon' => '../egg/mc.webp'],
                                'netease'       => ['label' => '网易山头服', 'icon' => '../egg/sbwangyi.webp'],
                            ];
                            foreach ($serverModes as $modeVal => $modeInfo):
                            ?>
                            <label class="server-mode-card server-mode-card--<?= $modeVal ?> <?= $currentMode === $modeVal ? 'is-active' : '' ?>">
                                <input type="radio" name="site[server_mode]" value="<?= $modeVal ?>" <?= $currentMode === $modeVal ? 'checked' : '' ?> onchange="updateModeCards()">
                                <img src="<?= $modeInfo['icon'] ?>" alt="<?= $modeInfo['label'] ?>">
                                <span><?= $modeInfo['label'] ?></span>
                            </label>
                            <?php endforeach; ?>
                        </div>

                        <?php
                        $currentTier = $content['site']['netease_tier'] ?? 'shangyao';
                        $tiers = [
                            'shangyao' => ['name' => '山腰', 'players' => 4,  'saves' => 1],
                            'shanfeng' => ['name' => '山峰', 'players' => 12, 'saves' => 3],
                            'yunding'  => ['name' => '云顶', 'players' => 40, 'saves' => 3],
                        ];
                        ?>
                        <div class="netease-tier-section" id="neteaseTierSection" style="display: <?= $currentMode === 'netease' ? 'block' : 'none' ?>">
                            <p class="netease-tier-title">选择套餐规格</p>
                            <div class="tier-selector">
                                <?php foreach ($tiers as $tierVal => $tierInfo): ?>
                                <label class="tier-card <?= $currentTier === $tierVal ? 'is-active' : '' ?>">
                                    <input type="radio" name="site[netease_tier]" value="<?= $tierVal ?>" <?= $currentTier === $tierVal ? 'checked' : '' ?> onchange="updateTierCards()">
                                    <span class="tier-name"><?= $tierInfo['name'] ?></span>
                                    <span class="tier-spec">至多 <?= $tierInfo['players'] ?> 名玩家</span>
                                    <span class="tier-spec"><?= $tierInfo['saves'] ?> 个存档位置</span>
                                </label>
                                <?php endforeach; ?>
                            </div>
                            <p class="tier-common-note">全部套餐均包含：全天候畅玩 &middot; 成员免费游玩 &middot; 存档自动备份</p>
                        </div>
                    </div>
                    <div class="form-section">
                        <h3 class="section-title">网站基本信息</h3>
                        <div class="form-group">
                            <label>网站标题</label>
                            <input type="text" name="site[title]" value="<?= e($content['site']['title'] ?? '') ?>" class="form-input">
                        </div>
                        <div class="form-group">
                            <label>网站描述 (SEO)</label>
                            <textarea name="site[description]" class="form-input" rows="3"><?= e($content['site']['description'] ?? '') ?></textarea>
                        </div>
                        <div class="form-group">
                            <label>服务器 IP 地址</label>
                            <input type="text" name="site[server_ip]" value="<?= e($content['site']['server_ip'] ?? '') ?>" class="form-input" placeholder="play.example.com">
                        </div>
                    </div>
                    <div class="form-section">
                        <h3 class="section-title">导航栏 LOGO 设置</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">上传图片后将替换默认文字 LOGO；清空图片则恢复为文字显示。</p>
                        <div class="form-group">
                            <label>LOGO 文字（默认显示）</label>
                            <input type="text" name="site[logo_text]" value="<?= e($content['site']['logo_text'] ?? '我的世界服务器') ?>" class="form-input" placeholder="我的世界服务器">
                        </div>
                        <div class="form-group">
                            <label>LOGO 图片（可选，优先于文字）</label>
                            <div class="image-upload-group">
                                <?php if (!empty($content['site']['logo_image'])): ?>
                                <img src="../<?= e($content['site']['logo_image']) ?>" class="preview-img small" alt="当前LOGO">
                                <?php endif; ?>
                                <input type="file" name="site_logo_image" accept="image/*" class="form-file">
                                <input type="hidden" name="site[logo_image]" value="<?= e($content['site']['logo_image'] ?? '') ?>">
                                <span class="file-hint">建议高度 40px，PNG 透明背景效果最佳。留空则使用文字 LOGO。</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="switch" style="margin-top: 8px;">
                                <input class="toggle" type="checkbox" name="site[clear_logo]" value="1">
                                <span class="slider"></span>
                            </label>
                            <span style="margin-top: 8px; font-size: 0.85rem; color: var(--text-muted);">勾选后保存将清除图片 LOGO，恢复为文字显示</span>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
                
                <div class="form-section" style="margin-top: 32px;">
                    <h3 class="section-title">后台管理设置</h3>
                    <form method="POST" action="save.php" data-ajax="true">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <input type="hidden" name="tab" value="general_settings">
                        
                        <div class="form-group" style="display: flex; flex-direction: column; align-items: center;">
                            <label class="switch">
                                <input class="toggle" type="checkbox" name="hide_ad_banner" value="1" <?= !empty($settings['hide_ad_banner']) ? 'checked' : '' ?>>
                                <span class="slider"></span>
                            </label>
                            <span style="margin-top: 12px; font-weight: 500; color: var(--text-primary);">永久关闭全局广告横幅</span>
                            <p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">开启此选项后，后台顶部的雨云IDC广告将不再显示。</p>
                        </div>

                        <hr style="border:none;border-top:1px dashed #e2e8f0;margin:24px 0;">

                        <div class="form-group">
                            <label style="display:flex;align-items:center;gap:8px;font-weight:600;color:#0f172a;">
                                可信反代 / CDN 出口段（高级）
                                <span style="font-weight:400;color:#64748b;font-size:0.8em;">影响登录限流、日志真实 IP</span>
                            </label>
                            <?php
                                $detectedRemote = $_SERVER['REMOTE_ADDR'] ?? '-';
                                $detectedReal   = function_exists('getRealClientIp') ? getRealClientIp() : $detectedRemote;
                                $isProxied      = $detectedRemote !== $detectedReal;
                                $isRemoteTrusted = function_exists('isTrustedProxy') && isTrustedProxy($detectedRemote);
                            ?>
                            <div style="background:<?= $isProxied ? '#f0fdf4' : '#fef9c3' ?>;border:1px solid <?= $isProxied ? '#bbf7d0' : '#fde68a' ?>;border-radius:10px;padding:12px;margin:8px 0 12px;font-size:0.86rem;line-height:1.6;color:#334155;">
                                <div><strong>当前检测：</strong></div>
                                <div>· 反代地址 (REMOTE_ADDR)：<code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;"><?= e($detectedRemote) ?></code><?= $isRemoteTrusted ? ' <span style="color:#16a34a;font-weight:700;">✓ 已识别为可信代理</span>' : ' <span style="color:#b45309;">（未列入可信段，header 将被忽略）</span>' ?></div>
                                <div>· 解析后的真实 IP：<code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;"><?= e($detectedReal) ?></code><?= $isProxied ? '' : '<span style="color:#94a3b8;"> （与反代地址相同 = 当前判定无反代或反代未被信任）</span>' ?></div>
                            </div>
                            <textarea name="admin_trusted_proxies" rows="5" class="form-input" style="font-family:Consolas,monospace;font-size:0.86em;" placeholder="每行一个 IP 或 CIDR，例如：&#10;10.0.0.0/8&#10;192.168.1.5&#10;172.20.0.0/16"><?= e((string)($settings['admin_trusted_proxies'] ?? '')) ?></textarea>
                            <div style="margin-top:8px;font-size:0.82rem;color:#64748b;line-height:1.7;">
                                <strong>什么时候需要填？</strong>站点放在 <em>nginx 反代 / Cloudflare（中国版）/ 阿里云 / 腾讯云 / 自建 CDN</em> 后面时，把反代的真实出口 IP 段填进来；这样登录失败次数才能正确按访客的真实 IP 限流，否则所有人共享反代 IP，单个攻击者就能把全网都锁死 5 分钟。
                                <br><br>
                                <strong>不需要填的情况：</strong>站点直连公网（无反代/无 CDN）；或者用 <em>Cloudflare 国际版</em>（已内置默认信任）；或者 nginx 同机部署（127.0.0.1 已内置）。
                                <br><br>
                                <strong>怎么验证：</strong>填完保存后刷新本页，从手机移动网络访问后台，看上面的"解析后的真实 IP"是不是变成你的真实手机 IP。
                                <br><br>
                                <button type="button" onclick="document.querySelector('[name=admin_trusted_proxies]').value+='\n10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16'" style="border:1px solid #cbd5e1;background:#fff;color:#475569;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.82em;">追加内网三段</button>
                                <button type="button" onclick="document.querySelector('[name=admin_trusted_proxies]').value=''" style="border:1px solid #fca5a5;background:#fff;color:#b91c1c;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.82em;margin-left:6px;">清空</button>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn-save">保存设置</button>
                        </div>
                    </form>
                </div>
            </div>
            <?php else: ?>
            <div id="tab-site" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-hero" class="tab-pane" style="display: <?= $currentTab === 'hero' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="hero">
                    <div class="form-section">
                        <h3 class="section-title">首页横幅内容</h3>
                        <div class="form-group">
                            <label>顶部标签文字</label>
                            <input type="text" name="hero[badge]" value="<?= e($content['hero']['badge'] ?? '') ?>" class="form-input">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>标题第一行</label>
                                <input type="text" name="hero[title_line1]" value="<?= e($content['hero']['title_line1'] ?? '') ?>" class="form-input">
                            </div>
                            <div class="form-group">
                                <label>标题高亮部分</label>
                                <input type="text" name="hero[title_highlight]" value="<?= e($content['hero']['title_highlight'] ?? '') ?>" class="form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>副标题</label>
                            <textarea name="hero[subtitle]" class="form-input" rows="2"><?= e($content['hero']['subtitle'] ?? '') ?></textarea>
                        </div>
                        <div class="form-group">
                            <label>特性标签 (每行一个)</label>
                            <textarea name="hero[features_text]" class="form-input" rows="3"><?= e(implode("\n", $content['hero']['features'] ?? [])) ?></textarea>
                        </div>
                        <div class="form-group">
                            <label>背景图片</label>
                            <div class="image-upload-group">
                                <?php if (!empty($content['hero']['bg_image'])): ?>
                                <img <?= $imgAttr($content['hero']['bg_image'], 'hero') ?> class="preview-img" alt="">
                                <?php endif; ?>
                                <input type="file" name="hero_bg_image" accept="image/*" class="form-file">
                                <input type="hidden" name="hero[bg_image]" value="<?= e($content['hero']['bg_image'] ?? '') ?>">
                                <span class="file-hint">留空则保持当前图片不变</span>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-hero" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-specs" class="tab-pane" style="display: <?= $currentTab === 'specs' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="specs">
                    <div class="form-section">
                        <h3 class="section-title">服务器配置板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="specs[title]" value="<?= e($content['specs']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="specs[subtitle]" value="<?= e($content['specs']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <?php foreach (($content['specs']['items'] ?? []) as $i => $item): ?>
                    <div class="form-section">
                        <h3 class="section-title">配置项 <?= $i + 1 ?></h3>
                        <div class="form-row">
                            <div class="form-group"><label>标题</label><input type="text" name="specs[items][<?= $i ?>][title]" value="<?= e($item['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>参数值</label><input type="text" name="specs[items][<?= $i ?>][value]" value="<?= e($item['value'] ?? '') ?>" class="form-input"></div>
                        </div>
                        <div class="form-group"><label>描述</label><textarea name="specs[items][<?= $i ?>][desc]" class="form-input" rows="2"><?= e($item['desc'] ?? '') ?></textarea></div>
                        <div class="form-group">
                            <label>图标</label>
                            <div class="image-upload-group">
                                <?php if (!empty($item['icon'])): ?><img <?= $imgAttr($item['icon'], 'specs') ?> class="preview-img small" alt=""><?php endif; ?>
                                <input type="file" name="specs_icon_<?= $i ?>" accept="image/*" class="form-file">
                                <input type="hidden" name="specs[items][<?= $i ?>][icon]" value="<?= e($item['icon'] ?? '') ?>">
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-specs" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-help" class="tab-pane" style="display: <?= $currentTab === 'help' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="help">
                    <div class="form-section">
                        <h3 class="section-title">加入指南板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="help[title]" value="<?= e($content['help']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="help[subtitle]" value="<?= e($content['help']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <?php foreach (($content['help']['steps'] ?? []) as $i => $step): ?>
                    <div class="form-section">
                        <h3 class="section-title">步骤 <?= $i + 1 ?></h3>
                        <div class="form-group"><label>标题</label><input type="text" name="help[steps][<?= $i ?>][title]" value="<?= e($step['title'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group"><label>描述</label><textarea name="help[steps][<?= $i ?>][desc]" class="form-input" rows="2"><?= e($step['desc'] ?? '') ?></textarea></div>
                        <?php if (isset($step['link_text'])): ?>
                        <div class="form-row">
                            <div class="form-group"><label>按钮文字</label><input type="text" name="help[steps][<?= $i ?>][link_text]" value="<?= e($step['link_text'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>按钮链接</label><input type="text" name="help[steps][<?= $i ?>][link_url]" value="<?= e($step['link_url'] ?? '') ?>" class="form-input"></div>
                        </div>
                        <?php endif; ?>
                        <?php if (isset($step['highlight'])): ?>
                        <div class="form-group"><label>高亮文字</label><input type="text" name="help[steps][<?= $i ?>][highlight]" value="<?= e($step['highlight'] ?? '') ?>" class="form-input"></div>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-help" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-features" class="tab-pane" style="display: <?= $currentTab === 'features' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="features">
                    <div class="form-section">
                        <h3 class="section-title">游戏特色板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="features[title]" value="<?= e($content['features']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="features[subtitle]" value="<?= e($content['features']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <?php foreach (($content['features']['items'] ?? []) as $i => $item): ?>
                    <div class="form-section">
                        <h3 class="section-title">特色 <?= $i + 1 ?></h3>
                        <div class="form-group"><label>标题</label><input type="text" name="features[items][<?= $i ?>][title]" value="<?= e($item['title'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group"><label>描述</label><textarea name="features[items][<?= $i ?>][desc]" class="form-input" rows="2"><?= e($item['desc'] ?? '') ?></textarea></div>
                        <div class="form-group">
                            <label>图标</label>
                            <div class="image-upload-group">
                                <?php if (!empty($item['icon'])): ?><img <?= $imgAttr($item['icon'], 'features') ?> class="preview-img small" alt=""><?php endif; ?>
                                <input type="file" name="features_icon_<?= $i ?>" accept="image/*" class="form-file">
                                <input type="hidden" name="features[items][<?= $i ?>][icon]" value="<?= e($item['icon'] ?? '') ?>">
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-features" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-gallery" class="tab-pane" style="display: <?= $currentTab === 'gallery' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="gallery">
                    <div class="form-section">
                        <h3 class="section-title">游戏截图板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="gallery[title]" value="<?= e($content['gallery']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="gallery[subtitle]" value="<?= e($content['gallery']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <?php foreach (($content['gallery']['items'] ?? []) as $i => $item): ?>
                    <div class="form-section" id="gallery-item-<?= $i ?>">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                            <h3 class="section-title" style="margin:0" id="gallery-title-<?= $i ?>">截图 <?= $i + 1 ?></h3>
                            <button type="button" onclick="markGalleryDelete(<?= $i ?>)" style="border:1px solid #fecaca;background:#fef2f2;color:#ef4444;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:0.85rem;">删除截图</button>
                        </div>
                        <input type="hidden" name="gallery[items][<?= $i ?>][_delete]" value="0" id="gallery-del-<?= $i ?>">
                        <div class="form-group"><label>图片说明</label><input type="text" name="gallery[items][<?= $i ?>][caption]" value="<?= e($item['caption'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group">
                            <label>图片</label>
                            <div class="image-upload-group">
                                <?php if (!empty($item['src'])): ?><img <?= $imgAttr($item['src'], 'gallery') ?> class="preview-img" alt=""><?php endif; ?>
                                <input type="file" name="gallery_img_<?= $i ?>" accept="image/*" class="form-file">
                                <input type="hidden" name="gallery[items][<?= $i ?>][src]" value="<?= e($item['src'] ?? '') ?>">
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-section">
                        <h3 class="section-title">添加新截图</h3>
                        <div class="form-group"><label>图片说明</label><input type="text" name="gallery_new_caption" class="form-input" placeholder="输入图片描述..."></div>
                        <div class="form-group">
                            <label>上传图片</label>
                            <div class="image-upload-group">
                                <input type="file" name="gallery_new_img" accept="image/*" class="form-file">
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-gallery" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-team" class="tab-pane" style="display: <?= $currentTab === 'team' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="team">
                    <div class="form-section">
                        <h3 class="section-title">管理团队板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="team[title]" value="<?= e($content['team']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="team[subtitle]" value="<?= e($content['team']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <?php foreach (($content['team']['members'] ?? []) as $i => $member): ?>
                    <div class="form-section">
                        <h3 class="section-title">成员 <?= $i + 1 ?>: <?= e($member['name'] ?? '') ?></h3>
                        <div class="form-row">
                            <div class="form-group"><label>名称</label><input type="text" name="team[members][<?= $i ?>][name]" value="<?= e($member['name'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>英文职位</label><input type="text" name="team[members][<?= $i ?>][role]" value="<?= e($member['role'] ?? '') ?>" class="form-input"></div>
                        </div>
                        <div class="form-group"><label>描述</label><textarea name="team[members][<?= $i ?>][desc]" class="form-input" rows="2"><?= e($member['desc'] ?? '') ?></textarea></div>
                        <div class="form-group"><label>联系链接</label><input type="text" name="team[members][<?= $i ?>][contact_link]" value="<?= e($member['contact_link'] ?? '') ?>" class="form-input" placeholder="如: https://example.com 或 #contact"></div>
                        <div class="form-group">
                            <label>头像</label>
                            <div class="image-upload-group">
                                <?php if (!empty($member['avatar'])): ?><img <?= $imgAttr($member['avatar'], 'team') ?> class="preview-img small round" alt=""><?php endif; ?>
                                <input type="file" name="team_avatar_<?= $i ?>" accept="image/*" class="form-file">
                                <input type="hidden" name="team[members][<?= $i ?>][avatar]" value="<?= e($member['avatar'] ?? '') ?>">
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-team" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <div id="tab-monitor" class="tab-pane" style="display: <?= $currentTab === 'monitor' ? 'block' : 'none' ?>">

                <div style="display:flex;align-items:center;gap:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:0.88rem;color:#92400e;line-height:1.5;">
                    <svg style="flex-shrink:0;color:#d97706;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span><strong>注意：</strong>服务器监控功能仅适用于雨云 <strong>游戏云（RGS）</strong> 实例，其他服务商或自建/网易山头服暂不支持。</span>
                </div>

                <div class="form-section">
                    <h3 class="section-title">
                        实时监控
                        <span id="monStatusBadge" class="mon-status-badge" style="display:none;"></span>
                        <span id="monRefreshHint" style="margin-left:auto;font-size:0.78rem;font-weight:400;color:var(--text-muted);display:none;">
                            <span style="width:7px;height:7px;background:var(--green);border-radius:50%;display:inline-block;animation:pulse-live 2s infinite;vertical-align:middle;"></span>
                            每 3 秒自动刷新
                        </span>
                    </h3>
                    <div id="monLiveWrap" class="mon-live-wrap">
                        <div class="mon-live-gauges">
                            <div class="mon-mini-gauge">
                                <div class="mon-mini-ring-wrap">
                                    <svg viewBox="0 0 110 110" class="mon-mini-svg">
                                        <circle class="mon-ring-bg" cx="55" cy="55" r="42" stroke-width="7"/>
                                        <circle class="mon-ring-fill" id="gaugeFilCpu" cx="55" cy="55" r="42" stroke="#10b981" stroke-width="7" stroke-dasharray="263.9" stroke-dashoffset="263.9"/>
                                    </svg>
                                    <div class="mon-mini-center"><span class="mon-mini-pct" id="gaugePctCpu">—</span></div>
                                </div>
                                <div class="mon-mini-label">CPU</div>
                            </div>
                            <div class="mon-mini-gauge">
                                <div class="mon-mini-ring-wrap">
                                    <svg viewBox="0 0 110 110" class="mon-mini-svg">
                                        <circle class="mon-ring-bg" cx="55" cy="55" r="42" stroke-width="7"/>
                                        <circle class="mon-ring-fill" id="gaugeFilMem" cx="55" cy="55" r="42" stroke="#10b981" stroke-width="7" stroke-dasharray="263.9" stroke-dashoffset="263.9"/>
                                    </svg>
                                    <div class="mon-mini-center"><span class="mon-mini-pct" id="gaugePctMem">—</span></div>
                                </div>
                                <div class="mon-mini-label">内存</div>
                            </div>
                        </div>
                        <div class="mon-live-right">
                            <div class="mon-bw-row">
                                <span class="mon-bw-up">↑ <span id="gaugeValUp">—</span></span>
                                <span class="mon-bw-dn">↓ <span id="gaugeValDown">—</span></span>
                            </div>
                            <div id="monDisksContainer"></div>
                        </div>
                    </div>
                    <div id="monNotConfigured" style="display:none;text-align:center;padding:24px 0;color:var(--text-muted);">
                        请在下方配置雨云 API 密钥和实例 ID 以启用监控
                    </div>
                    <div id="monError" class="mon-error-msg" style="display:none;"></div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">
                        服务器信息
                        <div class="mon-action-bar">
                            <button class="mon-action-btn sm start" id="monBtnStart" onclick="monAction('start')" title="开机"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>开机</button>
                            <button class="mon-action-btn sm restart" id="monBtnRestart" onclick="monAction('restart')" title="重启"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>重启</button>
                            <button class="mon-action-btn sm stop" id="monBtnStop" onclick="monAction('stop')" title="关机"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>关机</button>
                            <button class="mon-action-btn sm reset-pass" id="monBtnResetPass" onclick="monAction('reset_pass')" title="重置密码"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>重置密码</button>
                        </div>
                    </h3>
                    <div id="monActionMsg" class="mon-action-msg" style="display:none;"></div>
                    <div class="mon-rows">
                        <div class="mon-row"><span class="mon-rl">产品 ID</span><span class="mon-rv" id="monProductId">—</span></div>
                        <div class="mon-row"><span class="mon-rl">标签</span><span class="mon-rv" id="monTag">—</span></div>
                        <div class="mon-row"><span class="mon-rl">运行状态</span><span class="mon-rv" id="monStatus"><span class="mon-dot stopped"></span><strong style="color:var(--text-muted)">加载中…</strong></span></div>
                        <div class="mon-row"><span class="mon-rl">节点</span><span class="mon-rv" id="monNode">—</span></div>
                        <div class="mon-row"><span class="mon-rl">剩余可用 CPU 点数</span><span class="mon-rv mon-accent" id="monCpuPower">—</span></div>
                        <div class="mon-row"><span class="mon-rl">每日消耗积分</span><span class="mon-rv" id="monDailyCost">—</span></div>
                        <div class="mon-row"><span class="mon-rl">创建日期</span><span class="mon-rv" id="monCreateDate">—</span></div>
                        <div class="mon-row" style="border-bottom:none"><span class="mon-rl">到期日期</span><span class="mon-rv" id="monExpire">—</span></div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">远程连接</h3>
                    <div class="mon-rows">
                        <div class="mon-row">
                            <span class="mon-rl">远程连接地址 (RDP/SSH)</span>
                            <span class="mon-rv"><strong id="monRdpAddr">—</strong><button class="mon-copy-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('monRdpAddr').textContent)">复制</button></span>
                        </div>
                        <div class="mon-row">
                            <span class="mon-rl">远程用户名</span>
                            <span class="mon-rv"><strong id="monRdpUser">—</strong><button class="mon-copy-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('monRdpUser').textContent)">复制</button></span>
                        </div>
                        <div class="mon-row" style="border-bottom:none">
                            <span class="mon-rl">远程密码</span>
                            <span class="mon-rv" id="monPwRow">
                                <span id="monPwDots" style="font-family:monospace;letter-spacing:2px">••••••••••</span>
                                <button class="mon-copy-btn" id="monPwCopyBtn" onclick="monCopyPw()">复制</button>
                                <button class="mon-copy-btn" id="monPwToggleBtn" onclick="monTogglePw()">查看</button>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">配置信息</h3>
                    <div class="mon-rows">
                        <div class="mon-row"><span class="mon-rl">套餐</span><span class="mon-rv"><strong id="monPlan">—</strong></span></div>
                        <div class="mon-row"><span class="mon-rl">配置</span><span class="mon-rv" id="monSpecs">—</span></div>
                        <div class="mon-row"><span class="mon-rl">操作系统</span><span class="mon-rv" id="monOs">—</span></div>
                        <div class="mon-row"><span class="mon-rl">网络区域</span><span class="mon-rv" id="monZone">—</span></div>
                        <div class="mon-row" style="border-bottom:none"><span class="mon-rl">NAT 公网 IP</span><span class="mon-rv" id="monNatIp">—</span></div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">NAT 端口映射</h3>
                    <div class="mon-rows" id="monNatList">
                        <div class="mon-row" style="border-bottom:none"><span class="mon-rl" style="color:var(--text-muted);">加载中…</span></div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">雨云 API 配置</h3>
                    <form method="POST" action="save.php" data-ajax="true">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <input type="hidden" name="tab" value="monitor_settings">
                        <div class="form-group">
                            <label>雨云 API 密钥 (x-api-key)</label>
                            <div style="position:relative;">
                                <input type="password" id="rainyunApiKeyInput" name="rainyun_api_key" value="" class="form-input" autocomplete="new-password" style="padding-right:64px;" placeholder="<?= !empty($settings['rainyun_api_key']) ? '已保存，留空不改' : '在雨云用户中心 → API 管理中生成' ?>">
                                <button type="button" onclick="toggleSensitiveField('rainyunApiKeyInput')" title="显示/隐藏" style="position:absolute;right:30px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#64748b;font-size:14px;padding:4px;">👁</button>
                                <input type="hidden" name="rainyun_api_key_clear" id="rainyunApiKeyClear" value="">
                                <?php if (!empty($settings['rainyun_api_key'])): ?>
                                <button type="button" onclick="clearSensitiveField('rainyunApiKeyInput','rainyunApiKeyClear','rainyunApiKeyHint','清除已保存的 API Key 后监控功能将失效')" title="清除已保存的 API Key" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:4px;">✕</button>
                                <?php endif; ?>
                            </div>
                            <small id="rainyunApiKeyHint" style="display:none;color:#dc2626;margin-top:4px;font-size:0.78rem;">保存后将清除已保存的 API Key</small>
                        </div>
                        <div class="form-group">
                            <label>RGS 实例 ID</label>
                            <input type="text" name="rainyun_rgs_id" value="<?= e($settings['rainyun_rgs_id'] ?? '') ?>" class="form-input" placeholder="例如: 86524">
                        </div>
                        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">配置完成后，监控数据将自动从雨云 API 实时获取并展示。API 密钥仅存储在服务端，不会暴露到前端。</p>
                        <div class="form-actions">
                            <button type="submit" class="btn-save">保存配置</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="tab-messages" class="tab-pane" style="display: <?= $currentTab === 'messages' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <h3 class="section-title" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">收件箱 <span id="msgCountLabel" style="font-weight:400;font-size:0.85em;color:var(--text-muted);"></span></h3>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span id="msgLiveIndicator" style="display:inline-flex;align-items:center;gap:6px;font-size:0.8em;color:var(--green);">
                                <span style="width:7px;height:7px;background:var(--green);border-radius:50%;display:inline-block;animation:pulse-live 2s infinite;"></span>
                                实时刷新中
                            </span>
                        </div>
                    </div>
                    <div id="messagesList" class="messages-list"></div>
                    <div id="msgPagination" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:20px;flex-wrap:wrap;"></div>
                </div>

                <div class="form-section">
                    <details class="message-settings-panel">
                        <summary>
                            <span>消息通知设置</span>
                            <span>免打扰、邮件、清理和白名单</span>
                        </summary>
                    <form method="POST" action="save.php" data-ajax="true">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <input type="hidden" name="tab" value="messages_settings">
                        
                        <div class="message-toggle-grid">
                            <div class="message-toggle-card">
                                <div>
                                    <strong>免打扰模式</strong>
                                    <p>开启后不发送邮件通知</p>
                                </div>
                                <label class="switch">
                                    <input class="toggle" type="checkbox" name="dnd_mode" value="1" <?= !empty($settings['dnd_mode']) ? 'checked' : '' ?>>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="message-toggle-card">
                                <div>
                                    <strong>工单回复邮件</strong>
                                    <p>回复工单时同步发送邮件</p>
                                </div>
                                <label class="switch">
                                    <input class="toggle" type="checkbox" name="ticket_reply_mail_enabled" value="1" <?= !empty($settings['ticket_reply_mail_enabled']) ? 'checked' : '' ?>>
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>自动清理已读消息 (天)</label>
                                <input type="number" name="msg_auto_clean_days" value="<?= e($settings['msg_auto_clean_days'] ?? '0') ?>" class="form-input" min="0" max="3650" placeholder="0 表示不自动清理">
                                <p style="margin:4px 0 0;font-size:0.82em;color:var(--text-muted);">填 0 或留空则不清理；例如填 30 表示自动删除 30 天前的已读消息</p>
                            </div>
                            <div class="form-group">
                                <label>每页显示消息数</label>
                                <input type="number" name="msg_per_page" value="<?= e($settings['msg_per_page'] ?? '10') ?>" class="form-input" min="5" max="100" placeholder="默认 10">
                                <p style="margin:4px 0 0;font-size:0.82em;color:var(--text-muted);">每页展示多少条消息，范围 5~100</p>
                            </div>
                        </div>

                        <div class="form-section" style="margin:20px 0;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                                <div>
                                    <h4 style="margin:0;color:var(--text-primary);font-size:1em;">邮箱后缀白名单</h4>
                                    <p style="margin:4px 0 0;font-size:0.85em;color:var(--text-muted);">开启后，仅允许指定邮箱后缀的用户提交消息</p>
                                </div>
                                <label class="switch">
                                    <input class="toggle" type="checkbox" name="email_whitelist_enabled" value="1" <?= !empty($settings['email_whitelist_enabled']) ? 'checked' : '' ?>>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label>允许的邮箱后缀 (每行一个，例如 qq.com)</label>
                                <textarea name="email_whitelist_text" class="form-input" rows="4" placeholder="qq.com&#10;163.com&#10;gmail.com"><?= e(implode("\n", $settings['email_whitelist'] ?? [])) ?></textarea>
                            </div>
                        </div>

                        <details>
                            <summary style="cursor:pointer;margin:15px 0;color:var(--green-dark);font-weight:500;">配置 SMTP 邮件服务器 (点击展开)</summary>
                            <div style="background:#f8fafc;padding:20px;border-radius:10px;margin-bottom:20px;">
                                <div class="form-row">
                                    <div class="form-group"><label>SMTP 主机</label><input type="text" name="smtp_host" value="<?= e($settings['smtp_host'] ?? '') ?>" class="form-input" placeholder="例如: smtp.qq.com"></div>
                                    <div class="form-group"><label>SMTP 端口</label><input type="text" name="smtp_port" value="<?= e($settings['smtp_port'] ?? '587') ?>" class="form-input" placeholder="例如: 465 或 587"></div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group"><label>SMTP 用户名 (邮箱账号)</label><input type="text" name="smtp_user" value="<?= e($settings['smtp_user'] ?? '') ?>" class="form-input"></div>
                                    <div class="form-group">
                                        <label>SMTP 密码 (授权码)</label>
                                        <div style="position:relative;">
                                            <input type="password" id="smtpPassInput" name="smtp_pass" value="" class="form-input" autocomplete="new-password" style="padding-right:64px;" placeholder="<?= !empty($settings['smtp_pass']) ? '已保存，留空不改' : '邮箱授权码或 SMTP 密码' ?>">
                                            <button type="button" onclick="toggleSensitiveField('smtpPassInput')" title="显示/隐藏" style="position:absolute;right:30px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#64748b;font-size:14px;padding:4px;">👁</button>
                                            <input type="hidden" name="smtp_pass_clear" id="smtpPassClear" value="">
                                            <?php if (!empty($settings['smtp_pass'])): ?>
                                            <button type="button" onclick="clearSensitiveField('smtpPassInput','smtpPassClear','smtpPassHint','清除已保存的 SMTP 密码后所有邮件功能将失效')" title="清除已保存的密码" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:4px;">✕</button>
                                            <?php endif; ?>
                                        </div>
                                        <small id="smtpPassHint" style="display:none;color:#dc2626;margin-top:4px;font-size:0.78rem;">保存后将清除已保存的 SMTP 密码</small>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group"><label>发件人邮箱</label><input type="email" name="smtp_from_email" value="<?= e($settings['smtp_from_email'] ?? '') ?>" class="form-input"></div>
                                    <div class="form-group"><label>发件人名称</label><input type="text" name="smtp_from_name" value="<?= e($settings['smtp_from_name'] ?? 'FoxMC Admin') ?>" class="form-input"></div>
                                </div>
                                <div class="form-group"><label>通知接收邮箱 (留空则发给SMTP用户)</label><input type="email" name="notification_email" value="<?= e($settings['notification_email'] ?? '') ?>" class="form-input"></div>
                                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-bottom:14px;">
                                    <label style="display:block;font-weight:600;color:#15803d;margin-bottom:8px;">SMTP 测试发送</label>
                                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                        <input type="email" id="smtpTestEmailInput" class="form-input" value="<?= e($settings['notification_email'] ?? $settings['smtp_user'] ?? '') ?>" placeholder="测试收件邮箱" style="flex:1;min-width:220px;">
                                        <button type="button" onclick="sendSmtpTestMail()" style="border:none;padding:9px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">发送测试邮件</button>
                                    </div>
                                    <div style="font-size:.82em;color:#64748b;margin-top:8px;">请先保存 SMTP 配置，再发送测试邮件。</div>
                                </div>
                                <div class="form-group"><label>回复邮件模板 ({name}, {subject}, {reply_content}, {site} 为占位符)</label><textarea name="reply_email_template" class="form-input" rows="4"><?= e($settings['reply_email_template'] ?? ("亲爱的 {name}，</br>\n\n您好！</br>\n\n我们已收到您关于「{subject}」的反馈，以下是我们的回复：</br>\n\n{reply_content}</br>\n\n如有其他问题，欢迎随时联系我们。</br>\n\n此致</br>\n" . ((function_exists('getSiteTitle') && getSiteTitle() !== '') ? getSiteTitle() . ' 管理团队' : 'FoxMC 管理团队'))) ?></textarea></div>
                            </div>
                        </details>
                        <div class="message-settings-actions">
                            <button type="submit" class="btn-save">保存设置</button>
                        </div>
                    </form>
                    </details>
                </div>
            </div>

            <div id="tab-users" class="tab-pane" style="display: <?= $currentTab === 'users' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">
                        用户管理
                        <span style="margin-left:auto;font-size:0.8em;font-weight:400;color:var(--text-muted);">管理已注册的 Minecraft 用户</span>
                    </h3>

                    <?php if (!isUserSystemInstalled()): ?>
                    <div style="background:linear-gradient(135deg,rgba(56,189,248,0.1),rgba(139,92,246,0.1));border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
                        <div style="font-size:2em;margin-bottom:10px;">🔧</div>
                        <h4 style="margin-bottom:6px;">用户系统尚未安装</h4>
                        <p style="color:var(--text-muted);font-size:0.9em;margin-bottom:14px;">需要先连接 MySQL 数据库才能使用用户管理功能</p>
                        <a href="../install/" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95em;transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">一键安装</a>
                    </div>
                    <?php endif; ?>

                    <!-- 搜索 & 筛选栏 -->
                    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                        <div style="flex:1;min-width:200px;position:relative;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="userSearchInput" class="form-input" placeholder="搜索用户名 / 游戏ID / 邮箱..." style="padding-left:36px;">
                        </div>
                        <select id="userStatusFilter" class="form-input" style="width:auto;min-width:120px;">
                            <option value="">全部状态</option>
                            <option value="active">正常</option>
                            <option value="banned">已封禁</option>
                        </select>
                    </div>
                    <details class="batch-notice-panel">
                        <summary>
                            <span>批量通知</span>
                            <small>按当前搜索和状态筛选发送，单次最多 500 人</small>
                        </summary>
                        <div class="batch-notice-form">
                            <input type="text" id="batchNotifTitleInput" class="form-input" placeholder="通知标题">
                            <textarea id="batchNotifContentInput" class="form-input" rows="3" placeholder="通知内容"></textarea>
                            <div class="batch-notice-actions">
                                <button type="button" class="batch-notice-submit" onclick="sendBatchUserNotification()">发送批量通知</button>
                            </div>
                        </div>
                    </details>

                    <!-- 统计卡片 -->
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;"><div id="usersStatTotal" style="font-size:1.5em;font-weight:700;color:#334155;">-</div><div style="font-size:0.85em;color:#64748b;">总用户数</div></div>
                        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center;"><div id="usersStatPendingApps" style="font-size:1.5em;font-weight:700;color:#ca8a04;">-</div><div style="font-size:0.85em;color:#a16207;">待审核申请</div></div>
                        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;text-align:center;"><div id="usersStatBanned" style="font-size:1.5em;font-weight:700;color:#dc2626;">-</div><div style="font-size:0.85em;color:#b91c1c;">已封禁</div></div>
                        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;"><div id="usersStatNew" style="font-size:1.5em;font-weight:700;color:#2563eb;">-</div><div style="font-size:0.85em;color:#1d4ed8;">本周新增</div></div>
                    </div>

                    <!-- 用户列表表格 -->
                    <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                            <thead>
                                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                                    <th style="padding:12px 14px;text-align:left;font-weight:600;color:var(--text-primary);white-space:nowrap;">用户名</th>
                                    <th style="padding:12px 14px;text-align:left;font-weight:600;color:var(--text-primary);white-space:nowrap;">游戏ID</th>
                                    <th style="padding:12px 14px;text-align:left;font-weight:600;color:var(--text-primary);white-space:nowrap;">邮箱</th>
                                    <th style="padding:12px 14px;text-align:center;font-weight:600;color:var(--text-primary);white-space:nowrap;">账号状态</th>
                                    <th style="padding:12px 14px;text-align:center;font-weight:600;color:var(--text-primary);white-space:nowrap;">申请状态</th>
                                    <th style="padding:12px 14px;text-align:center;font-weight:600;color:var(--text-primary);white-space:nowrap;">资料完善度</th>
                                    <th style="padding:12px 14px;text-align:center;font-weight:600;color:var(--text-primary);white-space:nowrap;">注册时间</th>
                                    <th style="padding:12px 14px;text-align:center;font-weight:600;color:var(--text-primary);white-space:nowrap;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                <tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8;">加载中...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 分页 -->
                    <div id="usersPagination" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px;"></div>
                </div>
            </div>

            <div id="tab-applications" class="tab-pane" style="display: <?= $currentTab === 'applications' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">
                        入服申请管理
                        <span style="margin-left:auto;font-size:0.8em;font-weight:400;color:var(--text-muted);">集中审核、编辑和处理白名单申请</span>
                    </h3>
                    <?php if (!isUserSystemInstalled()): ?>
                    <div style="background:linear-gradient(135deg,rgba(56,189,248,0.1),rgba(139,92,246,0.1));border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
                        <div style="font-size:2em;margin-bottom:10px;">🔧</div>
                        <h4 style="margin-bottom:6px;">用户系统尚未安装</h4>
                        <p style="color:var(--text-muted);font-size:0.9em;margin-bottom:14px;">需要先连接 MySQL 数据库才能使用入服申请管理</p>
                        <a href="../install/" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95em;">一键安装</a>
                    </div>
                    <?php endif; ?>
                    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                        <div style="flex:1;min-width:200px;position:relative;">
                            <input type="text" id="appSearchInput" class="form-input" placeholder="搜索用户名 / 游戏ID / 邮箱...">
                        </div>
                        <select id="appStatusFilter" class="form-input" style="width:auto;min-width:140px;">
                            <option value="">全部申请</option>
                            <option value="pending">待审核</option>
                            <option value="need_more_info">需补充</option>
                            <option value="approved">已通过</option>
                            <option value="rejected">已拒绝</option>
                        </select>
                        <button type="button" onclick="loadApplicationsList(1)" style="border:none;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">刷新</button>
                        <button type="button" onclick="exportWhitelistCommands()" style="border:1px solid #bbf7d0;padding:10px 16px;border-radius:8px;background:#f0fdf4;color:#15803d;cursor:pointer;font-weight:700;">复制全部白名单命令</button>
                    </div>
                    <div id="applicationsBatchBar" style="display:none;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 14px;margin-bottom:16px;">
                        <strong style="color:#15803d;">已选择 <span id="applicationsSelectedCount">0</span> 个申请</strong>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button type="button" onclick="selectAllVisibleApplications()" style="border:1px solid #bbf7d0;padding:7px 12px;border-radius:8px;background:#fff;color:#15803d;cursor:pointer;">全选当前页</button>
                            <button type="button" onclick="clearSelectedApplications()" style="border:1px solid #e2e8f0;padding:7px 12px;border-radius:8px;background:#fff;color:#475569;cursor:pointer;">清空选择</button>
                            <button type="button" onclick="batchReviewSelectedApplications('approved')" style="border:none;padding:7px 12px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">批量通过</button>
                            <button type="button" onclick="batchReviewSelectedApplications('rejected')" style="border:none;padding:7px 12px;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;">批量拒绝</button>
                            <button type="button" onclick="batchReviewSelectedApplications('need_more_info')" style="border:none;padding:7px 12px;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;">批量需补充</button>
                            <button type="button" onclick="copySelectedWhitelistCommands()" style="border:none;padding:7px 12px;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">复制选中白名单</button>
                            <button type="button" onclick="batchMarkSelectedSynced(1)" style="border:none;padding:7px 12px;border-radius:8px;background:#0ea5e9;color:#fff;cursor:pointer;">批量标记同步</button>
                            <button type="button" onclick="batchMarkSelectedSynced(0)" style="border:none;padding:7px 12px;border-radius:8px;background:#64748b;color:#fff;cursor:pointer;">批量取消同步</button>
                            <button type="button" onclick="batchSyncSelectedApplications()" title="对选中的申请发起 RCON 自动同步，一次最多 50 条" style="border:none;padding:7px 12px;border-radius:8px;background:#7c3aed;color:#fff;cursor:pointer;">批量 RCON 同步</button>
                            <button type="button" onclick="retryAllFailedSyncs()" title="重试所有未同步成功的已审核申请" style="border:1px solid #ddd6fe;padding:7px 12px;border-radius:8px;background:#fff;color:#6d28d9;cursor:pointer;">重试全部失败</button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatTotal" style="font-size:1.5em;font-weight:700;color:#334155;">-</div><div style="font-size:0.85em;color:#64748b;">全部</div></div>
                        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatPending" style="font-size:1.5em;font-weight:700;color:#ca8a04;">-</div><div style="font-size:0.85em;color:#a16207;">待审核</div></div>
                        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatNeedInfo" style="font-size:1.5em;font-weight:700;color:#2563eb;">-</div><div style="font-size:0.85em;color:#1d4ed8;">需补充</div></div>
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatApproved" style="font-size:1.5em;font-weight:700;color:#16a34a;">-</div><div style="font-size:0.85em;color:#15803d;">已通过</div></div>
                        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatRejected" style="font-size:1.5em;font-weight:700;color:#dc2626;">-</div><div style="font-size:0.85em;color:#b91c1c;">已拒绝</div></div>
                        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;"><div id="appsStatUnsynced" style="font-size:1.5em;font-weight:700;color:#2563eb;">-</div><div style="font-size:0.85em;color:#1d4ed8;">未同步</div></div>
                    </div>
                    <div id="applicationsList" style="display:grid;gap:12px;"></div>
                    <div id="applicationsPagination" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px;"></div>
                </div>

                <div class="form-section">
                    <details class="application-settings-panel">
                        <summary class="application-settings-summary">
                            <span>申请与通知配置</span>
                            <span>低频设置，点击展开</span>
                        </summary>
                    <form method="POST" action="save.php" data-ajax="true" class="application-settings-form">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <input type="hidden" name="tab" value="application_settings">
                        <div class="settings-panel-head">
                            <div>
                                <h4>配置详情</h4>
                                <p>下方是低频配置项；0 表示不限制，通知邮箱使用消息通知里的 SMTP 接收邮箱</p>
                            </div>
                            <button type="submit" class="btn-save small">保存配置</button>
                        </div>
                        <div class="application-settings-grid">
                            <div class="settings-card settings-card-toggles">
                                <div class="settings-card-title">通知与自动化</div>
                                <label class="settings-toggle-row">
                                    <span>新申请邮件通知</span>
                                    <label class="switch"><input class="toggle" type="checkbox" name="application_notify_enabled" value="1" <?= array_key_exists('application_notify_enabled', $settings) ? (!empty($settings['application_notify_enabled']) ? 'checked' : '') : 'checked' ?>><span class="slider"></span></label>
                                </label>
                                <label class="settings-toggle-row">
                                    <span>入服申请免打扰</span>
                                    <label class="switch"><input class="toggle" type="checkbox" name="application_dnd_mode" value="1" <?= !empty($settings['application_dnd_mode']) ? 'checked' : '' ?>><span class="slider"></span></label>
                                </label>
                                <label class="settings-toggle-row">
                                    <span>通过后发送入服指南</span>
                                    <label class="switch"><input class="toggle" type="checkbox" name="join_guide_enabled" value="1" <?= array_key_exists('join_guide_enabled', $settings) ? (!empty($settings['join_guide_enabled']) ? 'checked' : '') : 'checked' ?>><span class="slider"></span></label>
                                </label>
                                <label class="settings-toggle-row">
                                    <span>审核结果发送邮件</span>
                                    <label class="switch"><input class="toggle" type="checkbox" name="application_review_mail_enabled" value="1" <?= !empty($settings['application_review_mail_enabled']) ? 'checked' : '' ?>><span class="slider"></span></label>
                                </label>
                            </div>
                            <div class="settings-card">
                                <div class="settings-card-title">提交限制</div>
                                <div class="compact-field-grid">
                                    <div class="form-group">
                                        <label>冷却时间（小时）</label>
                                        <input type="number" min="0" max="8760" name="application_cooldown_hours" value="<?= e((string)($settings['application_cooldown_hours'] ?? 0)) ?>" class="form-input" placeholder="例如 24">
                                    </div>
                                    <div class="form-group">
                                        <label>最多提交次数</label>
                                        <input type="number" min="0" max="999" name="application_max_submissions" value="<?= e((string)($settings['application_max_submissions'] ?? 0)) ?>" class="form-input" placeholder="例如 3">
                                    </div>
                                </div>
                            </div>
                            <div class="settings-card settings-card-wide">
                                <div class="settings-card-title">入服指南内容</div>
                                <div class="guide-field-grid">
                                    <div class="form-group"><label>服务器 IP</label><input type="text" name="join_guide_server_ip" value="<?= e((string)($settings['join_guide_server_ip'] ?? '')) ?>" class="form-input" placeholder="play.example.com"></div>
                                    <div class="form-group"><label>推荐版本</label><input type="text" name="join_guide_version" value="<?= e((string)($settings['join_guide_version'] ?? '')) ?>" class="form-input" placeholder="1.20.1"></div>
                                    <div class="form-group"><label>交流群</label><input type="text" name="join_guide_group" value="<?= e((string)($settings['join_guide_group'] ?? '')) ?>" class="form-input" placeholder="QQ群 / Discord 链接"></div>
                                    <div class="form-group"><label>资源包链接</label><input type="text" name="join_guide_resource_pack" value="<?= e((string)($settings['join_guide_resource_pack'] ?? '')) ?>" class="form-input"></div>
                                    <div class="form-group"><label>新人教程链接</label><input type="text" name="join_guide_tutorial" value="<?= e((string)($settings['join_guide_tutorial'] ?? '')) ?>" class="form-input"></div>
                                    <div class="form-group"><label>规则页面链接</label><input type="text" name="join_guide_rules" value="<?= e((string)($settings['join_guide_rules'] ?? '')) ?>" class="form-input"></div>
                                    <div class="form-group guide-contact-field"><label>管理员联系方式</label><input type="text" name="join_guide_contact" value="<?= e((string)($settings['join_guide_contact'] ?? '')) ?>" class="form-input"></div>
                                </div>
                            </div>
                            <div class="settings-card settings-card-wide rcon-settings-card">
                                <details class="rcon-guide">
                                    <summary style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;color:var(--text-main);">
                                        <span>白名单自动同步向导</span>
                                        <span style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">可选功能，点击展开</span>
                                    </summary>
                                    <div style="margin-top:12px;">
                                        <input type="hidden" name="whitelist_sync_mode" value="rcon">
                                        <div class="rcon-guide-main">
                                            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px;">
                                                <strong style="display:block;color:#c2410c;margin-bottom:8px;">服务器只要这样设置</strong>
                                                <div style="background:#fff;border:1px solid #ffedd5;border-radius:10px;padding:10px;font-family:Consolas,monospace;font-size:0.84rem;line-height:1.7;color:#7c2d12;">
                                                    enable-rcon=true<br>
                                                    rcon.port=25575<br>
                                                    rcon.password=自己设置一个密码
                                                </div>
                                                <p style="margin:8px 0 0;color:#9a3412;font-size:0.84rem;line-height:1.6;">保存后重启服务器，并确认防火墙放行这个端口。</p>
                                            </div>
                                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:12px;">
                                                <div class="settings-toggle-row" style="margin:0 0 10px;padding:0;border:none;">
                                                    <strong style="color:#15803d;">审核后自动执行命令</strong>
                                                    <label class="switch"><input class="toggle" type="checkbox" name="whitelist_sync_enabled" value="1" <?= !empty($settings['whitelist_sync_enabled']) ? 'checked' : '' ?>><span class="slider"></span></label>
                                                </div>
                                                <div class="rcon-connect-grid">
                                                    <div class="form-group" style="margin:0;"><label>服务器地址</label><input type="text" name="rcon_host" value="<?= e((string)($settings['rcon_host'] ?? '')) ?>" class="form-input" placeholder="IP 或域名"></div>
                                                    <div class="form-group" style="margin:0;"><label>端口</label><input type="number" min="1" max="65535" name="rcon_port" value="<?= e((string)($settings['rcon_port'] ?? 25575)) ?>" class="form-input"></div>
                                                    <div class="form-group" style="margin:0;">
                                                        <label>密码</label>
                                                        <div style="position:relative;">
                                                            <input type="password" id="rconPasswordInput" name="rcon_password" value="" class="form-input" autocomplete="new-password" style="padding-right:64px;" placeholder="<?= !empty($settings['rcon_password']) ? '已保存，留空不改' : 'RCON 密码' ?>">
                                                            <button type="button" onclick="toggleRconPasswordVisibility()" title="显示/隐藏" style="position:absolute;right:30px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#64748b;font-size:14px;padding:4px;">👁</button>
                                                            <input type="hidden" name="rcon_password_clear" id="rconPasswordClear" value="">
                                                            <?php if (!empty($settings['rcon_password'])): ?>
                                                            <button type="button" onclick="clearRconPassword()" title="清除已保存的密码" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:4px;">✕</button>
                                                            <?php endif; ?>
                                                        </div>
                                                        <small id="rconPasswordHint" style="display:none;color:#dc2626;margin-top:4px;font-size:0.78rem;">保存后将清除已保存的 RCON 密码</small>
                                                    </div>
                                                    <button type="button" onclick="testRconConnection()" class="btn-secondary" style="height:38px;white-space:nowrap;">测试</button>
                                                </div>
                                                <p style="margin:8px 0 0;color:#64748b;font-size:0.84rem;line-height:1.6;">不开自动同步也能用，审核后仍可一键复制命令。</p>
                                            </div>
                                        </div>
                                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;">
                                            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                                                <strong style="color:#334155;">自定义命令模板</strong>
                                                <span style="color:#94a3b8;font-size:0.82rem;">不同白名单插件改这里即可</span>
                                            </div>
                                            <div class="rcon-command-grid">
                                                <div class="form-group" style="margin:0;"><label>通过时执行</label><input type="text" id="whitelistCommandTemplateInput" name="whitelist_command_template" value="<?= e((string)($settings['whitelist_command_template'] ?? '/vmc approve {mc_name}')) ?>" class="form-input rcon-template-input" data-template-target="approve" placeholder="/whitelist add {mc_name}"></div>
                                                <div class="form-group" style="margin:0;"><label>拒绝时执行</label><input type="text" id="whitelistRejectTemplateInput" name="whitelist_reject_command_template" value="<?= e((string)($settings['whitelist_reject_command_template'] ?? '/vmc reject {mc_name} {reason}')) ?>" class="form-input rcon-template-input" data-template-target="reject" placeholder="/vmc reject {mc_name} {reason}"></div>
                                                <div class="form-group" style="margin:0;"><label>超时秒数</label><input type="number" min="1" max="60" name="rcon_timeout" value="<?= e((string)($settings['rcon_timeout'] ?? 5)) ?>" class="form-input"></div>
                                            </div>
                                            <div style="margin-top:8px;font-size:0.82rem;color:#64748b;">点击下方占位符插入到光标位置（在哪个模板里点上次聚焦哪条就插哪条）：</div>
                                            <div class="rcon-placeholder-grid" id="rconPlaceholderGrid" style="margin-top:6px;">
                                                <span data-placeholder="{mc_name}" style="cursor:pointer;"><code>{mc_name}</code> 游戏 ID</span>
                                                <span data-placeholder="{reason}" style="cursor:pointer;"><code>{reason}</code> 审核备注</span>
                                                <span data-placeholder="{username}" style="cursor:pointer;"><code>{username}</code> 网站用户名</span>
                                                <span data-placeholder="{email}" style="cursor:pointer;"><code>{email}</code> 用户邮箱</span>
                                                <span data-placeholder="{app_id}" style="cursor:pointer;"><code>{app_id}</code> 申请 ID</span>
                                                <span data-placeholder="{user_id}" style="cursor:pointer;"><code>{user_id}</code> 用户 ID</span>
                                                <span data-placeholder="{source}" style="cursor:pointer;"><code>{source}</code> 来源</span>
                                                <span data-placeholder="{age_range}" style="cursor:pointer;"><code>{age_range}</code> 年龄段</span>
                                            </div>
                                            <div style="margin-top:10px;background:#0f172a;border-radius:10px;padding:10px 12px;font-family:Consolas,monospace;font-size:0.84rem;color:#e2e8f0;line-height:1.7;">
                                                <div style="color:#94a3b8;font-size:0.78rem;margin-bottom:4px;">实时预览（用示例数据替换占位符）</div>
                                                <div>通过时：<span id="rconPreviewApprove" style="color:#86efac;">-</span></div>
                                                <div>拒绝时：<span id="rconPreviewReject" style="color:#fda4af;">-</span></div>
                                            </div>
                                            <p style="margin:8px 0 0;color:#94a3b8;font-size:0.82rem;">示例：<code>/whitelist add {mc_name}</code>、<code>/easywl approve {mc_name}</code>、<code>/lp user {mc_name} parent add default</code>、<code>/vmc reject {mc_name} {reason}</code></p>
                                            <!-- RCON 预览脚本已外提到 admin/js/rcon-preview.js -->
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </form>
                    </details>
                </div>
            </div>

            <!-- ===== 商城：收益概览 ===== -->
            <div id="tab-shop_revenue" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_revenue' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">收益概览
                        <span class="shop-title-actions">
                            <button type="button" onclick="shopLoadDashboard()" class="btn-secondary">刷新</button>
                        </span>
                    </h3>
                    <div id="shopDashboardStats" class="shop-metrics"></div>
                    <div class="shop-dashboard-grid">
                        <div class="shop-panel">
                            <h4 class="shop-panel-title">最近 14 天订单 / 收入趋势</h4>
                            <div id="shopTrendChart" class="shop-trend-chart"></div>
                        </div>
                        <div class="shop-panel">
                            <h4 class="shop-panel-title">销量 Top 商品</h4>
                            <div id="shopTopProducts" class="shop-list"></div>
                        </div>
                    </div>
                    <div class="shop-panel">
                        <h4 class="shop-panel-title">最近订单</h4>
                        <div id="shopRecentOrders" class="shop-list"></div>
                    </div>
                </div>
            </div>

            <!-- ===== 商城：商品管理 ===== -->
            <div id="tab-shop_products" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_products' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">商品管理
                        <span class="shop-title-actions">
                            <button type="button" onclick="shopOpenCategoryManager()" class="btn-secondary">分类管理</button>
                            <button type="button" onclick="shopOpenProductEditor()" class="btn-save">+ 新增商品</button>
                        </span>
                    </h3>
                    <div class="shop-toolbar">
                        <input type="text" id="shopProductSearch" class="form-input" placeholder="搜索商品名称 / 副标题...">
                        <select id="shopProductCategoryFilter" class="form-input"><option value="">全部分类</option></select>
                        <select id="shopProductActiveFilter" class="form-input">
                            <option value="">全部状态</option>
                            <option value="1">已上架</option>
                            <option value="0">已下架</option>
                        </select>
                        <label class="shop-check"><input type="checkbox" id="shopProductLowStockFilter"> 仅低库存</label>
                        <button type="button" onclick="shopLoadProducts(1)" class="btn-save">查询</button>
                    </div>
                    <div id="shopProductBatchBar" class="shop-batch-bar" style="display:none;">
                        <span class="shop-batch-count">已选 0 件</span>
                        <button type="button" onclick="shopBatchSelectAll()" class="shop-btn shop-btn--muted">全选/取消</button>
                        <button type="button" onclick="shopBatchAction('activate')" class="shop-btn shop-btn--primary">批量上架</button>
                        <button type="button" onclick="shopBatchAction('deactivate')" class="shop-btn shop-btn--danger">批量下架</button>
                    </div>
                    <div id="shopProductsList" class="shop-grid-list"></div>
                    <div id="shopProductsPagination" class="shop-pagination"></div>
                </div>
            </div>

            <!-- ===== 商城：订单管理 ===== -->
            <div id="tab-shop_orders" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_orders' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">订单管理</h3>
                    <div class="shop-toolbar" style="grid-template-columns: minmax(180px,1fr) minmax(120px,auto) auto auto auto;">
                        <input type="text" id="shopOrderSearch" class="form-input" placeholder="搜索订单号 / 用户名 / 邮箱 / MC ID...">
                        <select id="shopOrderStatusFilter" class="form-input">
                            <option value="">全部状态</option>
                            <option value="pending_payment">待支付</option>
                            <option value="paid">已支付</option>
                            <option value="shipped">已发货</option>
                            <option value="completed">已完成</option>
                            <option value="cancelled">已取消</option>
                            <option value="refunded">已退款</option>
                        </select>
                        <input type="date" id="shopOrderDateFrom" class="form-input" title="起始日期">
                        <input type="date" id="shopOrderDateTo" class="form-input" title="截止日期">
                        <button type="button" onclick="shopLoadOrders(1)" class="btn-save">查询</button>
                    </div>
                    <div id="shopOrdersList" class="shop-grid-list"></div>
                    <div id="shopOrdersPagination" class="shop-pagination"></div>
                </div>
            </div>

            <!-- ===== 商城：库存管理 ===== -->
            <div id="tab-shop_inventory" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_inventory' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">库存管理
                        <span style="margin-left:auto;font-size:.82em;font-weight:400;color:var(--text-muted);">库存 ≤ <?= SHOP_LOW_STOCK_THRESHOLD ?> 视为低库存</span>
                    </h3>
                    <div class="shop-toolbar shop-toolbar--compact">
                        <input type="text" id="shopInventorySearch" class="form-input" placeholder="搜索商品...">
                        <label class="shop-check"><input type="checkbox" id="shopInventoryLowOnly" checked> 仅显示低库存</label>
                        <button type="button" onclick="shopLoadInventory(1)" class="btn-save">查询</button>
                    </div>
                    <div id="shopInventoryList" class="shop-grid-list"></div>
                    <div id="shopInventoryPagination" class="shop-pagination"></div>
                </div>
            </div>

            <!-- ===== 商城：发货链路 ===== -->
            <div id="tab-shop_delivery" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_delivery' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <?php
                        // 推断 PHP CLI 二进制路径（宝塔典型路径 /www/server/php/<ver>/bin/php），失败则回退 php
                        $shopCronPhpBin = 'php';
                        $shopCronPhpVerKey = str_replace('.', '', PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION);
                        $shopCronBtPath = '/www/server/php/' . $shopCronPhpVerKey . '/bin/php';
                        if (@is_executable($shopCronBtPath)) {
                            $shopCronPhpBin = $shopCronBtPath;
                        } elseif (defined('PHP_BINDIR') && @is_executable(PHP_BINDIR . '/php')) {
                            $shopCronPhpBin = PHP_BINDIR . '/php';
                        }
                        $shopCronScript = __DIR__ . '/shop_delivery_cron.php';
                        $shopCronShell  = "#!/bin/bash\n" . $shopCronPhpBin . ' ' . $shopCronScript;
                    ?>
                    <h3 class="section-title">RCON 发货链路
                        <span class="shop-title-actions">
                            <button type="button" onclick="shopDeliveryTestRcon()" class="btn-secondary">测试 RCON</button>
                            <button type="button" onclick="shopDeliveryRunNow(this)" class="btn-save">立即处理队列</button>
                        </span>
                    </h3>

                    <!-- 概览 -->
                    <div id="shopDeliveryStats" class="shop-metrics"></div>

                    <!-- 待发队列（日常使用） -->
                    <div class="shop-toolbar shop-toolbar--compact">
                        <input type="text" id="shopDeliveryKeyword" class="form-input" placeholder="按 MC ID / 商品名 / 命令搜索...">
                        <select id="shopDeliveryStatusFilter" class="form-input">
                            <option value="pending">待发送</option>
                            <option value="">全部</option>
                            <option value="success">已发送</option>
                            <option value="failed">失败</option>
                            <option value="cancelled">已取消</option>
                        </select>
                        <button type="button" onclick="shopDeliveryLoadQueue(1)" class="btn-save">查询</button>
                    </div>
                    <div class="shop-batch-bar" style="margin-bottom:10px;">
                        <span style="font-size:.84rem;color:var(--text-secondary);">批量操作：</span>
                        <button type="button" onclick="shopDeliveryBatchRetryFailed()" class="shop-btn shop-btn--primary">重试全部失败</button>
                        <button type="button" onclick="shopDeliveryBatchCancelPending()" class="shop-btn shop-btn--danger">取消全部待发</button>
                    </div>
                    <div id="shopDeliveryQueueList" class="shop-grid-list"></div>
                    <div id="shopDeliveryQueuePagination" class="shop-pagination"></div>

                    <!-- 发货链路设置（折叠，设置一次即可） -->
                    <details class="shop-collapse">
                        <summary>发货链路设置 <span class="shop-summary-note">重试 / 自动发货 / 超时取消</span></summary>
                        <div class="shop-collapse-body">
                            <form id="shopDeliverySettingsForm" onsubmit="return shopDeliverySaveSettings(event)">
                                <div class="shop-toggle-row">
                                    <label class="shop-toggle-card">
                                        <input type="checkbox" name="shop_rcon_delivery_enabled" id="shopDeliveryEnabled">
                                        <span class="shop-toggle-switch"></span>
                                        <span class="shop-toggle-text">
                                            <b>启用 RCON 自动发货</b>
                                            <small>订单已支付后自动通过 RCON 执行发货命令</small>
                                        </span>
                                    </label>
                                    <label class="shop-toggle-card">
                                        <input type="checkbox" name="shop_delivery_auto_ship" id="shopDeliveryAutoShip" checked>
                                        <span class="shop-toggle-switch"></span>
                                        <span class="shop-toggle-text">
                                            <b>自动标记「已发货」</b>
                                            <small>全部命令执行成功后，把订单状态推进为已发货</small>
                                        </span>
                                    </label>
                                </div>
                                <div class="shop-form-grid" style="margin-top:14px;">
                                    <div class="shop-field"><label>最大重试次数</label><input type="number" name="shop_delivery_max_attempts" id="shopDeliveryMaxAttempts" class="form-input" min="1" max="999" value="30"></div>
                                    <div class="shop-field"><label>重试间隔（秒）</label><input type="number" name="shop_delivery_retry_seconds" id="shopDeliveryRetrySeconds" class="form-input" min="10" max="86400" value="60"></div>
                                    <div class="shop-field"><label>待支付订单超时取消（分钟）</label><input type="number" name="shop_order_expire_minutes" id="shopOrderExpireMinutes" class="form-input" min="0" max="44640" value="0" placeholder="0 = 不自动取消"><span class="shop-field-note">0 = 关闭；在线支付建议 30~60，手动对账 120~1440，需 Cron 已配置。</span></div>
                                    <div class="shop-field shop-field--full"><label>Cron Token <button type="button" onclick="shopDeliveryRegenToken()" class="shop-link-btn">生成新 Token</button></label><input type="text" name="shop_delivery_cron_token" id="shopDeliveryCronToken" class="form-input shop-mono" placeholder="留空 = 自动生成"></div>
                                </div>
                                <div class="shop-form-actions">
                                    <button type="submit" class="btn-save">保存设置</button>
                                </div>
                                <p class="shop-field-note">RCON 连接配置（host/port/password/timeout）在「入服申请」标签页的 <b>RCON 设置</b> 区域，所有 RCON 功能共用同一连接。</p>
                            </form>
                        </div>
                    </details>

                    <!-- 定时任务部署（折叠，部署一次即可） -->
                    <details class="shop-collapse">
                        <summary>定时任务部署 <span class="shop-summary-note">必须配置一次，否则无法自动补发</span></summary>
                        <div class="shop-collapse-body">
                            <p class="shop-note-text" style="margin:0 0 8px;">订单进入「已支付」后立即尝试 RCON 发货；失败或玩家不在线则进入队列，由 Cron 反复补发。</p>
                            <div class="shop-notice-head" style="margin-bottom:8px;">
                                <div>宝塔 → 计划任务 → Shell 脚本，执行周期每 <b>1 分钟</b></div>
                                <button type="button" onclick="shopDeliveryCopyCron(this)" class="btn-secondary">复制脚本</button>
                            </div>
                            <pre id="shopDeliveryCronScript" class="shop-code-box"><?= htmlspecialchars($shopCronShell) ?></pre>
                            <div class="shop-field-note" style="margin-top:8px;line-height:1.8;">
                                <div><b>Linux crontab</b>：<code>* * * * * <?= htmlspecialchars($shopCronPhpBin . ' ' . $shopCronScript) ?></code></div>
                                <div><b>Windows 计划任务</b>：每分钟运行 <code>php.exe shop_delivery_cron.php</code></div>
                                <div><b>HTTP 触发</b>（需带 Token）：<code>GET /admin/shop_delivery_cron.php?token=YOUR_TOKEN</code></div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            <!-- ===== 商城：支付设置 ===== -->
            <div id="tab-shop_payments" class="tab-pane shop-admin" style="display: <?= $currentTab === 'shop_payments' ? 'block' : 'none' ?>">
                <?php
                $payCfg    = function_exists('shopPaymentSettings') ? shopPaymentSettings(false) : [];
                $payEnabled = !empty($payCfg['enabled']);
                $payKeySet = !empty($payCfg['key_set']);
                $payType   = (string)($payCfg['type'] ?? 'alipay');
                ?>

                <!-- 接入配置 -->
                <form id="shopPaymentSettingsForm" onsubmit="return shopPaymentSaveSettings(event)" class="pay-card pay-config-form">
                    <div class="pay-card__header">
                        <div class="pay-card__header-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                        </div>
                        <div class="pay-card__header-text">
                            <div class="pay-card__title">支付设置</div>
                            <div class="pay-card__subtitle">配置易支付商户参数，启用后用户可在商城下单时在线付款。</div>
                        </div>
                    </div>
                    <div class="pay-card__body">

                        <!-- 安全提示 -->
                        <div class="pay-section">
                            <div class="pay-tip" style="display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:#b45309;font-size:13px;line-height:1.5;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px;"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                                <span>易支付平台跑路狗很多，推荐自己搭建平台使用！</span>
                            </div>
                        </div>

                        <!-- 启用开关 -->
                        <div class="pay-section">
                            <div class="pay-block--toggle">
                                <div class="pay-toggle-row">
                                    <div class="pay-toggle-text">
                                        <div class="pay-toggle-label">启用在线收款</div>
                                        <div class="pay-toggle-desc">启用后用户可在商城下单时选择在线支付</div>
                                    </div>
                                    <label class="pay-switch">
                                        <input type="checkbox" id="shopPaymentEnabled" <?= $payEnabled ? 'checked' : '' ?>>
                                        <span class="pay-switch-track"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- 凭证 -->
                        <div class="pay-section">
                            <div class="pay-section__label"><span class="pay-section__label-tag"></span>商户凭证</div>
                            <div class="pay-credentials-grid">
                                <div class="pay-field-group pay-full-width">
                                    <label class="pay-field-label" for="shopPaymentBaseUrl">支付网关地址</label>
                                    <input type="url" id="shopPaymentBaseUrl" class="form-input" value="<?= e((string)($payCfg['base_url'] ?? 'https://security.kuaizhifu.cn')) ?>" placeholder="https://security.kuaizhifu.cn">
                                    <div class="pay-field-hint">填写易支付服务商域名，无需带 /submit.php 后缀</div>
                                </div>
                                <div class="pay-field-group">
                                    <label class="pay-field-label" for="shopPaymentPid">商户 ID（PID）</label>
                                    <input type="text" id="shopPaymentPid" class="form-input" value="<?= e((string)($payCfg['pid'] ?? '')) ?>" placeholder="例如：1000">
                                </div>
                                <div class="pay-field-group">
                                    <div class="pay-key-header">
                                        <label class="pay-field-label" for="shopPaymentKey">
                                            商户密钥（KEY）
                                            <span class="pay-key-badge <?= $payKeySet ? 'pay-key-badge--set' : 'pay-key-badge--unset' ?>"><?= $payKeySet ? '已配置' : '未配置' ?></span>
                                        </label>
                                        <label class="pay-key-inline-actions">
                                            <input type="checkbox" id="shopPaymentClearKey">
                                            <span>清空密钥</span>
                                        </label>
                                    </div>
                                    <div class="pay-key-wrap">
                                        <input type="password" id="shopPaymentKey" class="form-input pay-key-input" value="" placeholder="<?= $payKeySet ? '留空保持不变' : '输入商户密钥' ?>" autocomplete="new-password">
                                        <button type="button" class="pay-eye-btn" onclick="shopPayToggleKeyVisible(this)" title="显示/隐藏密钥">
                                            <svg class="pay-eye-show" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            <svg class="pay-eye-hide" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        </button>
                                    </div>
                                    <div class="pay-field-hint">仅本次保存生效，留空则保留原密钥</div>
                                </div>
                                <div class="pay-field-group pay-full-width">
                                    <label class="pay-field-label" for="shopPaymentSitename">站点名称（显示在支付页）</label>
                                    <input type="text" id="shopPaymentSitename" class="form-input" maxlength="80" value="<?= e((string)($payCfg['sitename'] ?? 'FoxMC 商城')) ?>">
                                </div>
                            </div>
                        </div>

                        <!-- 支付方式 -->
                        <div class="pay-section">
                            <div class="pay-section__label"><span class="pay-section__label-tag"></span>默认支付方式</div>
                            <div class="pay-type-tabs">
                                <label class="pay-type-tab pay-default-option <?= $payType === 'alipay' ? 'is-active' : '' ?>">
                                    <input type="radio" name="_payTypeRadio" value="alipay" <?= $payType === 'alipay' ? 'checked' : '' ?> onchange="shopPayTypeChanged(this)">
                                    <span class="pay-option-dot pay-option-dot--alipay"></span>
                                    <span class="pay-option-main">支付宝</span>
                                </label>
                                <label class="pay-type-tab pay-default-option <?= $payType === 'wxpay' ? 'is-active' : '' ?>">
                                    <input type="radio" name="_payTypeRadio" value="wxpay" <?= $payType === 'wxpay' ? 'checked' : '' ?> onchange="shopPayTypeChanged(this)">
                                    <span class="pay-option-dot pay-option-dot--wxpay"></span>
                                    <span class="pay-option-main">微信支付</span>
                                </label>
                                <label class="pay-type-tab pay-default-option <?= $payType === 'qqpay' ? 'is-active' : '' ?>">
                                    <input type="radio" name="_payTypeRadio" value="qqpay" <?= $payType === 'qqpay' ? 'checked' : '' ?> onchange="shopPayTypeChanged(this)">
                                    <span class="pay-option-dot pay-option-dot--qqpay"></span>
                                    <span class="pay-option-main">QQ 支付</span>
                                </label>
                            </div>
                            <select id="shopPaymentType" style="display:none;">
                                <option value="alipay" <?= $payType === 'alipay' ? 'selected' : '' ?>>支付宝</option>
                                <option value="wxpay"  <?= $payType === 'wxpay'  ? 'selected' : '' ?>>微信支付</option>
                                <option value="qqpay"  <?= $payType === 'qqpay'  ? 'selected' : '' ?>>QQ支付</option>
                            </select>
                            <div class="pay-section__hint" style="margin-top:8px;">用户结算时默认勾选此方式</div>
                        </div>
                    </div>

                    <div class="pay-card__footer">
                        <button type="submit" class="btn-save pay-action-btn" id="shopPaySaveBtn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            保存设置
                        </button>
                    </div>
                </form>

                <!-- 回调地址 -->
                <div class="pay-card">
                    <div class="pay-card__header">
                        <div class="pay-card__header-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        </div>
                        <div class="pay-card__header-text">
                            <div class="pay-card__title">回调地址</div>
                            <div class="pay-card__subtitle">将下面两个地址填入易支付平台后台对应位置。</div>
                        </div>
                    </div>
                    <div class="pay-card__body">
                        <div class="pay-url-grid">
                            <div class="pay-url-card">
                                <div class="pay-url-card-head">
                                    <div class="pay-url-meta">
                                        <span class="pay-badge-method pay-badge-method--post">POST</span>
                                        <div>
                                            <div class="pay-url-name">异步通知地址</div>
                                            <div class="pay-url-key">notify_url</div>
                                        </div>
                                    </div>
                                    <button type="button" class="pay-copy-btn" onclick="shopPayCopyUrl('shopPaymentNotifyUrl', this)">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        复制
                                    </button>
                                </div>
                                <div id="shopPaymentNotifyUrl" class="pay-url-value"><?= e(function_exists('shopPaymentNotifyUrl') ? shopPaymentNotifyUrl() : '') ?></div>
                            </div>
                            <div class="pay-url-card">
                                <div class="pay-url-card-head">
                                    <div class="pay-url-meta">
                                        <span class="pay-badge-method pay-badge-method--get">GET</span>
                                        <div>
                                            <div class="pay-url-name">同步返回地址</div>
                                            <div class="pay-url-key">return_url</div>
                                        </div>
                                    </div>
                                    <button type="button" class="pay-copy-btn" onclick="shopPayCopyUrl('shopPaymentReturnUrl', this)">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        复制
                                    </button>
                                </div>
                                <div id="shopPaymentReturnUrl" class="pay-url-value"><?= e(function_exists('shopPaymentReturnUrl') ? shopPaymentReturnUrl() : '') ?></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>


            <!-- ===== 商城：商品编辑器弹窗 ===== -->
            <div id="shopProductModal" class="modal-overlay" style="display:none;">
                <div class="modal-content" style="max-width:680px;">
                    <div class="modal-header">
                        <h3 id="shopProductModalTitle">新增商品</h3>
                        <button type="button" class="close-modal" onclick="shopCloseProductEditor()">×</button>
                    </div>
                    <form id="shopProductForm" onsubmit="return shopSubmitProduct(event)">
                        <input type="hidden" name="id" id="shopProductId" value="">
                        <div class="form-grid-2">
                            <div class="form-group" style="grid-column:1/-1;margin:0;"><label>商品名称 *</label><input type="text" name="name" id="shopProductName" class="form-input" maxlength="120" required></div>
                            <div class="form-group" style="grid-column:1/-1;margin:0;"><label>副标题 / 卖点</label><input type="text" name="subtitle" id="shopProductSubtitle" class="form-input" maxlength="200" placeholder="例如：限时 7 折，专属称号"></div>
                            <div class="form-group" style="margin:0;"><label>分类</label><select name="category_id" id="shopProductCategory" class="form-input"><option value="">未分类</option></select></div>
                            <div class="form-group" style="margin:0;"><label>排序权重</label><input type="number" name="sort_order" id="shopProductSort" class="form-input" value="0"></div>
                            <div class="form-group" style="margin:0;"><label>售价（元）*</label><input type="number" name="price" id="shopProductPrice" class="form-input" step="0.01" min="0.01" required></div>
                            <div class="form-group" style="margin:0;"><label>原价（可选）</label><input type="number" name="original_price" id="shopProductOriginalPrice" class="form-input" step="0.01" min="0"></div>
                            <div class="form-group" style="margin:0;"><label>库存</label><input type="number" name="stock" id="shopProductStock" class="form-input" min="0" value="0"></div>
                            <div class="form-group" style="margin:0;"><label>最小购买数量</label><input type="number" name="min_qty" id="shopProductMinQty" class="form-input" min="1" step="1" value="1"></div>
                            <div class="form-group" style="margin:0;"><label>最大购买数量（0=不限）</label><input type="number" name="max_qty" id="shopProductMaxQty" class="form-input" min="0" step="1" value="0" placeholder="0 表示仅受库存限制"></div>
                            <div class="form-group" style="grid-column:1/-1;margin:0;">
                                <label>封面图（可选）</label>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <input type="text" name="cover_image" id="shopProductCover" class="form-input" placeholder="assets/images/foo.png 或 https://..." oninput="shopUpdateCoverPreview(this.value)" style="flex:1;min-width:0;">
                                    <button type="button" id="shopProductCoverUploadBtn" onclick="shopChooseProductCover()" style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:0 14px;height:40px;border:1.5px solid #16a34a;border-radius:8px;color:#16a34a;background:#fff;cursor:pointer;font-size:.88em;font-weight:500;white-space:nowrap;transition:background .15s;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        上传图片
                                    </button>
                                    <input type="file" id="shopProductCoverFile" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;" onchange="shopUploadProductCover(this)">
                                </div>
                                <div id="shopProductCoverPreviewWrap" style="display:none;margin-top:8px;">
                                    <img id="shopProductCoverPreview" src="" alt="封面预览" style="max-height:90px;max-width:180px;border-radius:6px;border:1px solid #e2e8f0;object-fit:cover;">
                                    <button type="button" onclick="shopClearCover()" style="margin-left:8px;border:none;background:none;color:#94a3b8;cursor:pointer;font-size:.82em;vertical-align:middle;">✕ 移除</button>
                                </div>
                                <div id="shopProductCoverUploadHint" style="font-size:.76em;color:#94a3b8;margin-top:4px;">JPG / PNG / GIF / WebP，上限 5 MB</div>
                            </div>
                            <div class="form-group" style="grid-column:1/-1;margin:0;"><label>商品介绍</label><textarea name="description" id="shopProductDescription" class="form-input" rows="3" maxlength="8000" placeholder="支持纯文本，可换行"></textarea></div>
                            <div class="form-group" style="grid-column:1/-1;margin:0;"><label>发货说明（可选）</label><textarea name="delivery_note" id="shopProductDeliveryNote" class="form-input" rows="2" maxlength="500" placeholder="例如：管理员审核后将于 24 小时内通过游戏指令发放"></textarea></div>
                            <div class="form-group" style="grid-column:1/-1;margin:0;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;"><input type="checkbox" name="is_active" id="shopProductActive" checked> 上架（用户可见可购买）</label></div>
                            <details style="grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;">
                                <summary style="cursor:pointer;font-weight:600;color:#0f172a;font-size:.92em;">⚙ 高级：RCON 自动发货（点击展开）</summary>
                                <div style="margin-top:10px;display:grid;gap:10px;">
                                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;font-size:.8em;color:#1e3a8a;line-height:1.7;">
                                        💡 <strong>新手提示</strong>：在下面填写玩家付款后服务器要执行的游戏指令，<strong>每行一条</strong>。不会写也没关系——点下面的<strong>常用模板</strong>一键填入，再把物品名 / 数量改成你要的即可。<strong>留空则不会自动发货</strong>（改为人工处理）。
                                    </div>
                                    <div class="form-group" style="margin:0;">
                                        <label style="display:block;margin-bottom:6px;">① 选一个常用模板（点击填入）</label>
                                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                            <button type="button" class="shop-cmd-tpl-btn" onclick="shopApplyDeliveryTemplate('give')" style="border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:5px 10px;font-size:.8em;cursor:pointer;color:#334155;">🎁 给物品（钻石）</button>
                                            <button type="button" class="shop-cmd-tpl-btn" onclick="shopApplyDeliveryTemplate('money')" style="border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:5px 10px;font-size:.8em;cursor:pointer;color:#334155;">💰 给游戏币</button>
                                            <button type="button" class="shop-cmd-tpl-btn" onclick="shopApplyDeliveryTemplate('lp')" style="border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:5px 10px;font-size:.8em;cursor:pointer;color:#334155;">👑 给会员组（LuckPerms）</button>
                                            <button type="button" class="shop-cmd-tpl-btn" onclick="shopApplyDeliveryTemplate('clear')" style="border:1px solid #fecaca;background:#fff;border-radius:6px;padding:5px 10px;font-size:.8em;cursor:pointer;color:#b91c1c;">🗑 清空</button>
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin:0;">
                                        <label style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                                            <span>② RCON 命令（每行一条，可自由修改）</span>
                                        </label>
                                        <textarea name="delivery_commands" id="shopProductDeliveryCommands" class="form-input" rows="3" maxlength="4000" placeholder="留空 = 不自动发货&#10;give {mc_name} minecraft:diamond {qty}" style="font-family:Consolas,monospace;font-size:.86em;" oninput="shopRenderDeliveryPreview()"></textarea>
                                    </div>
                                    <div class="form-group" style="margin:0;">
                                        <label style="display:block;margin-bottom:6px;font-size:.86em;">③ 点击下方标签，把玩家信息插入到光标处</label>
                                        <div id="shopDeliveryPlaceholderGrid" style="display:flex;flex-wrap:wrap;gap:6px;">
                                            <span class="shop-ph-chip" data-placeholder="{mc_name}" title="玩家的游戏 ID（最常用）" style="cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 9px;font-size:.78em;font-family:Consolas,monospace;">{mc_name} 游戏ID</span>
                                            <span class="shop-ph-chip" data-placeholder="{qty}" title="购买数量" style="cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 9px;font-size:.78em;font-family:Consolas,monospace;">{qty} 数量</span>
                                            <span class="shop-ph-chip" data-placeholder="{product}" title="商品名称" style="cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 9px;font-size:.78em;font-family:Consolas,monospace;">{product} 商品名</span>
                                            <span class="shop-ph-chip" data-placeholder="{user}" title="网站用户名" style="cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 9px;font-size:.78em;font-family:Consolas,monospace;">{user} 用户名</span>
                                            <span class="shop-ph-chip" data-placeholder="{order_no}" title="订单号" style="cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 9px;font-size:.78em;font-family:Consolas,monospace;">{order_no} 订单号</span>
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin:0;">
                                        <label style="display:block;margin-bottom:6px;font-size:.86em;">④ 实时预览（以玩家 <code>Steve</code>、数量 <code>2</code> 为例，实际发货时自动替换）</label>
                                        <pre id="shopDeliveryPreview" style="margin:0;background:#0f172a;color:#86efac;border-radius:8px;padding:10px 12px;font-size:.8em;line-height:1.7;white-space:pre-wrap;word-break:break-all;min-height:1.7em;">(留空 = 不自动发货)</pre>
                                    </div>
                                    <div style="font-size:.76em;color:#64748b;margin-top:2px;line-height:1.7;"><code>#</code> 开头的行作为注释忽略；订单「已支付」后自动通过 RCON 执行；失败 / 玩家不在线会自动入待发队列。</div>
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.9em;color:#475569;"><input type="checkbox" name="require_online" id="shopProductRequireOnline" checked> 玩家在线时才发放（物品 / 经验类建议勾选）</label>
                                </div>
                            </details>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="shopCloseProductEditor()">取消</button>
                            <button type="submit" class="btn-save">保存商品</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- ===== 商城：分类管理弹窗 ===== -->
            <div id="shopCategoryModal" class="modal-overlay" style="display:none;">
                <div class="modal-content" style="max-width:560px;">
                    <div class="modal-header">
                        <h3>分类管理</h3>
                        <button type="button" class="close-modal" onclick="shopCloseCategoryManager()">×</button>
                    </div>
                    <div id="shopCategoriesList" style="display:grid;gap:8px;margin-bottom:14px;"></div>
                    <form id="shopCategoryForm" onsubmit="return shopSubmitCategory(event)" style="display:grid;grid-template-columns:2fr 1fr auto auto;gap:8px;align-items:end;">
                        <input type="hidden" name="id" id="shopCategoryId" value="">
                        <div class="form-group" style="margin:0;"><label style="font-size:.84em;">分类名称</label><input type="text" name="name" id="shopCategoryName" class="form-input" maxlength="80" required></div>
                        <div class="form-group" style="margin:0;"><label style="font-size:.84em;">排序</label><input type="number" name="sort_order" id="shopCategorySort" class="form-input" value="0"></div>
                        <label style="display:flex;align-items:center;gap:4px;font-size:.86em;color:#475569;"><input type="checkbox" name="is_active" id="shopCategoryActive" checked> 启用</label>
                        <button type="submit" class="btn-save" style="padding:8px 14px;">保存</button>
                    </form>
                </div>
            </div>

            <!-- ===== 商城：订单详情弹窗 ===== -->
            <div id="shopOrderModal" class="modal-overlay" style="display:none;">
                <div class="modal-content" style="max-width:760px;">
                    <div class="modal-header">
                        <h3 id="shopOrderModalTitle">订单详情</h3>
                        <button type="button" class="close-modal" onclick="shopCloseOrderModal()">×</button>
                    </div>
                    <div id="shopOrderModalBody"></div>
                </div>
            </div>

            <!-- ===== 商城：库存调整弹窗 ===== -->
            <div id="shopStockModal" class="modal-overlay" style="display:none;">
                <div class="modal-content" style="max-width:480px;">
                    <div class="modal-header">
                        <h3>调整库存</h3>
                        <button type="button" class="close-modal" onclick="shopCloseStockModal()">×</button>
                    </div>
                    <form id="shopStockForm" onsubmit="return shopSubmitStock(event)">
                        <input type="hidden" name="id" id="shopStockProductId" value="">
                        <div class="form-group"><label>商品</label><div id="shopStockProductName" style="padding:8px 12px;background:#f8fafc;border-radius:8px;color:#0f172a;"></div></div>
                        <div class="form-group"><label>当前库存</label><div id="shopStockCurrent" style="padding:8px 12px;background:#f8fafc;border-radius:8px;color:#0f172a;font-weight:700;"></div></div>
                        <div class="form-group"><label>调整数量（正数为入库，负数为出库）*</label><input type="number" name="delta" id="shopStockDelta" class="form-input" required></div>
                        <div class="form-group"><label>备注（可选）</label><input type="text" name="reason" class="form-input" maxlength="200" placeholder="例如：补货 / 损耗 / 兑换码补发"></div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="shopCloseStockModal()">取消</button>
                            <button type="submit" class="btn-save">提交</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 用户详情弹窗 -->
            <div id="userDetailModal" class="user-detail-modal" onclick="if(event.target===this)closeUserDetail()">
                <div class="user-detail-modal-inner" onclick="event.stopPropagation()">
                    <div class="user-detail-modal-head">
                        <h3>用户详情</h3>
                        <button onclick="closeUserDetail()" aria-label="关闭" class="user-detail-modal-close">&times;</button>
                    </div>
                    <div id="userDetailContent" class="user-detail-modal-body"></div>
                </div>
            </div>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-community" class="tab-pane" style="display: <?= $currentTab === 'community' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="community">
                    <div class="form-section">
                        <h3 class="section-title">社区链接板块</h3>
                        <div class="form-row">
                            <div class="form-group"><label>板块标题</label><input type="text" name="community[title]" value="<?= e($content['community']['title'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>板块副标题</label><input type="text" name="community[subtitle]" value="<?= e($content['community']['subtitle'] ?? '') ?>" class="form-input"></div>
                        </div>
                    </div>
                    <div class="form-section">
                        <h3 class="section-title">QQ群</h3>
                        <div class="form-group"><label>标题</label><input type="text" name="community[qq_text]" value="<?= e($content['community']['qq_text'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group"><label>描述</label><input type="text" name="community[qq_desc]" value="<?= e($content['community']['qq_desc'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group">
                            <label>二维码图片</label>
                            <div class="image-upload-group">
                                <?php if (!empty($content['community']['qq_qr'])): ?>
                                    <img <?= $imgAttr($content['community']['qq_qr'], 'community') ?> class="preview-img small" alt="">
                                <?php endif; ?>
                                <input type="file" name="community_qq_qr" accept="image/*" class="form-file">
                                <input type="hidden" name="community[qq_qr]" value="<?= e($content['community']['qq_qr'] ?? '') ?>">
                            </div>
                        </div>
                        <div class="form-group"><label>加群链接</label><input type="text" name="community[qq_link]" value="<?= e($content['community']['qq_link'] ?? '') ?>" class="form-input"></div>
                    </div>
                    <div class="form-section">
                        <h3 class="section-title">微信群</h3>
                        <div class="form-group"><label>标题</label><input type="text" name="community[wechat_text]" value="<?= e($content['community']['wechat_text'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group"><label>描述</label><input type="text" name="community[wechat_desc]" value="<?= e($content['community']['wechat_desc'] ?? '') ?>" class="form-input"></div>
                        <div class="form-group">
                            <label>二维码图片</label>
                            <div class="image-upload-group">
                                <?php if (!empty($content['community']['wechat_qr'])): ?>
                                    <img <?= $imgAttr($content['community']['wechat_qr'], 'community') ?> class="preview-img small" alt="">
                                <?php endif; ?>
                                <input type="file" name="community_wechat_qr" accept="image/*" class="form-file">
                                <input type="hidden" name="community[wechat_qr]" value="<?= e($content['community']['wechat_qr'] ?? '') ?>">
                            </div>
                        </div>
                        <div class="form-group"><label>加群链接</label><input type="text" name="community[wechat_link]" value="<?= e($content['community']['wechat_link'] ?? '') ?>" class="form-input"></div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-community" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <div id="tab-backup" class="tab-pane" style="display: <?= $currentTab === 'backup' ? 'block' : 'none' ?>">
                <div class="form-section">
                    <h3 class="section-title">数据备份与恢复</h3>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:18px;color:#15803d;font-size:.92em;line-height:1.7;">
                        <div style="font-weight:600;margin-bottom:4px;">📦 备份说明</div>
                        <div>• 每份备份是一个 <code>foxmc-backup-*.zip</code>，含 <code>database.sql</code> + <code>meta.json</code> + <code>manifest.json</code>（含每条目 SHA-256）。</div>
                        <div>• 写入采用 <b>原子模式</b>（先写 <code>.tmp</code> 后重命名）+ <b>CRC 自检</b>，避免半文件污染列表。</div>
                        <div>• 恢复前会强制做 <b>逐条目 SHA-256 校验</b>，损坏或被篡改的文件将被拒绝以保护现有数据。</div>
                        <div>• 服务器仅保留最近 <?= (int)BACKUP_KEEP_LATEST ?> 份备份，旧备份将自动清理。建议同时下载到本地另存。</div>
                        <div>• 恢复操作会 <b style="color:#b91c1c;">覆盖当前数据</b>，恢复前系统会自动生成一份"恢复前快照"。</div>
                    </div>

                    <h3 class="section-title" style="margin-top:8px;">立即创建备份</h3>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:24px;">
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">
                            <input type="checkbox" id="backupIncludeUploads">
                            <span>同时打包 <code>admin/uploads/</code> 上传文件目录（备份体积会变大）</span>
                        </label>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <button type="button" id="backupCreateBtn" class="btn-save">创建备份并保存到服务器</button>
                            <button type="button" id="backupCreateAndDownloadBtn" class="btn-secondary">创建并下载到本地</button>
                            <span id="backupCreateHint" style="color:#64748b;font-size:.88em;align-self:center;"></span>
                        </div>
                    </div>

                    <h3 class="section-title">本地备份列表</h3>
                    <div style="overflow-x:auto;">
                        <table id="backupListTable" style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                            <thead style="background:#f8fafc;">
                                <tr style="text-align:left;color:#475569;font-size:.88em;">
                                    <th style="padding:10px 12px;">文件名</th>
                                    <th style="padding:10px 12px;">导出时间</th>
                                    <th style="padding:10px 12px;">大小</th>
                                    <th style="padding:10px 12px;">表 / 行数</th>
                                    <th style="padding:10px 12px;">状态</th>
                                    <th style="padding:10px 12px;text-align:right;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="backupListBody">
                                <tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">加载中...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 class="section-title" style="margin-top:24px;">从备份文件恢复（上传 zip）</h3>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
                        <div class="form-group">
                            <label>选择 .zip 备份文件</label>
                            <input type="file" id="backupUploadFile" accept=".zip,application/zip" class="form-input">
                        </div>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">
                            <input type="checkbox" id="backupUploadRestoreUploads">
                            <span>同时还原 <code>uploads/</code>（如果备份中包含）</span>
                        </label>
                        <button type="button" id="backupUploadRestoreBtn" class="btn-secondary" style="background:#dc2626;color:#fff;border-color:#dc2626;">上传并恢复</button>
                        <span style="color:#94a3b8;font-size:.85em;margin-left:10px;">将要求验证管理员密码</span>
                    </div>

                    <h3 class="section-title" style="margin-top:24px;">数据库修复 / 优化</h3>
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:14px;color:#92400e;font-size:.92em;line-height:1.7;">
                        <div style="font-weight:600;margin-bottom:4px;">🛠 适用场景</div>
                        <div>• 把<b>旧版本 / 老数据库</b>导入新站后出现的小问题（缺字段、缺表、缺索引、字符集乱码等），可一键自动排查修复。</div>
                        <div>• 修复过程会<b>逐项独立执行，单步出错自动跳过</b>不影响其它步骤，并返回详细报告。</div>
                        <div>• 执行前会自动生成一份 <code>pre-repair</code> 快照，可随时回滚。</div>
                    </div>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
                        <div style="font-weight:600;margin-bottom:10px;color:#334155;">修复项</div>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
                            <input type="checkbox" id="repairCheckRepair" checked>
                            <span>检查并修复损坏的表（CHECK / REPAIR）</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
                            <input type="checkbox" id="repairNormalizeCharset" checked>
                            <span>统一字符集为 <code>utf8mb4</code>（修复旧库 latin1 / utf8 乱码）</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
                            <input type="checkbox" id="repairOptimize" checked>
                            <span>优化表、整理碎片回收空间（OPTIMIZE）</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">
                            <input type="checkbox" id="repairCleanOrphans">
                            <span style="color:#b45309;">清理孤儿数据（删除引用了不存在父记录的脏数据，<b>具破坏性，谨慎勾选</b>）</span>
                        </label>
                        <div style="font-size:.85em;color:#64748b;margin-bottom:12px;">注：补全缺失的表 / 字段 / 索引会<b>始终执行</b>，这是旧库导入问题的核心修复。</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                            <button type="button" id="dbRepairBtn" class="btn-save">开始修复 / 优化</button>
                            <span style="color:#94a3b8;font-size:.85em;">将要求验证管理员密码</span>
                        </div>
                        <div id="dbRepairResult" style="margin-top:14px;"></div>
                    </div>
                </div>
            </div>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-footer" class="tab-pane" style="display: <?= $currentTab === 'footer' ? 'block' : 'none' ?>">
                <form method="POST" action="save.php" enctype="multipart/form-data" data-ajax="true">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="tab" value="footer">
                    <div class="form-section">
                        <h3 class="section-title">页脚设置</h3>
                        <div class="form-group"><label>页脚描述</label><textarea name="footer[desc]" class="form-input" rows="3"><?= e($content['footer']['desc'] ?? '') ?></textarea></div>
                        <div class="form-group"><label>版权信息</label><input type="text" name="footer[copyright]" value="<?= e($content['footer']['copyright'] ?? '') ?>" class="form-input"></div>
                    </div>
                    <?php foreach (($content['footer']['friend_links'] ?? []) as $i => $link): ?>
                    <div class="form-section">
                        <h3 class="section-title">友情链接 <?= $i + 1 ?></h3>
                        <div class="form-row">
                            <div class="form-group"><label>名称</label><input type="text" name="footer[friend_links][<?= $i ?>][name]" value="<?= e($link['name'] ?? '') ?>" class="form-input"></div>
                            <div class="form-group"><label>链接</label><input type="text" name="footer[friend_links][<?= $i ?>][url]" value="<?= e($link['url'] ?? '') ?>" class="form-input" placeholder="https://example.com"></div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <div class="form-section">
                        <h3 class="section-title">添加新友情链接</h3>
                        <div class="form-row">
                            <div class="form-group"><label>名称</label><input type="text" name="footer_new_link_name" class="form-input" placeholder="输入链接名称..."></div>
                            <div class="form-group"><label>链接</label><input type="text" name="footer_new_link_url" class="form-input" placeholder="https://example.com"></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-save">保存更改</button>
                    </div>
                </form>
            </div>
            <?php else: ?>
            <div id="tab-footer" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

            <?php if ($renderSettingsTabs): ?>
            <div id="tab-images" class="tab-pane" style="display: <?= $currentTab === 'images' ? 'block' : 'none' ?>">
                <div class="tab-header">
                    <h2 class="tab-title">图片管理</h2>
                    <p class="tab-subtitle">浏览、上传和管理站点所有图片资源，检测未被引用的孤儿图片</p>
                </div>

                <!-- 工具栏 -->
                <div class="img-toolbar">
                    <div class="img-toolbar-left">
                        <select id="imgDirFilter" class="form-select img-select">
                            <option value="">全部目录</option>
                        </select>
                        <div class="img-search-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="imgSearch" class="form-input img-search" placeholder="搜索文件名…">
                        </div>
                        <button type="button" id="imgOrphanBtn" class="btn-secondary img-orphan-btn" title="只显示未被任何内容引用的孤儿图片">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span id="imgOrphanFilterLabel">只看孤儿</span>
                            <span class="orphan-count"></span>
                        </button>
                        <span id="imgStats" class="img-stats"></span>
                    </div>
                    <div class="img-toolbar-right">
                        <button type="button" id="imgSelectAll" class="btn-secondary">全选当前页</button>
                        <select id="imgUploadDir" class="form-select img-select" title="上传到">
                            <option value="admin_uploads">后台上传 (admin/uploads/)</option>
                            <option value="png">资源图片 (png/)</option>
                            <option value="egg">角色图标 (egg/)</option>
                            <option value="assets_images">站点图标 (assets/images/)</option>
                        </select>
                        <input type="file" id="imgUploadInput" accept="image/jpeg,image/png,image/gif,image/webp" multiple style="display:none;">
                        <button type="button" id="imgUploadBtn" class="btn-save">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                            上传图片
                        </button>
                    </div>
                </div>

                <!-- 批量操作栏 -->
                <div id="imgSelBar" class="img-sel-bar">
                    <span id="imgSelCount">已选 0 张</span>
                    <button type="button" id="imgBatchDelete" class="btn-danger-sm" disabled>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        删除所选
                    </button>
                    <button type="button" onclick="imgClearSelection()" class="btn-secondary-sm">取消选择</button>
                </div>

                <!-- 拖拽上传区（空状态引导） -->
                <div id="imgDropzone" class="img-dropzone" style="display:none;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    <p>拖拽图片到此处上传，或点击选择文件</p>
                </div>

                <!-- 图片网格 -->
                <div id="imgGrid" class="img-grid"></div>
            </div>
            <?php else: ?>
            <div id="tab-images" class="tab-pane" data-lazy="1" style="display:none;"></div>
            <?php endif; ?>

        </div>
    </main>

    <!-- Lightbox (gallery) -->
    <div id="lightbox" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(4px);" onclick="closeLightbox()">
        <img id="lightboxImg" src="" alt="预览" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:slideUp 0.3s ease;">
        <button onclick="closeLightbox()" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">&times;</button>
    </div>

    <!-- 图片管理 Lightbox -->
    <div id="imgLightbox" class="img-lb-overlay" style="display:none;" onclick="if(event.target===this)imgCloseLightbox()">
        <div class="img-lb-box">
            <button class="img-lb-close" onclick="imgCloseLightbox()">&times;</button>
            <div class="img-lb-thumb">
                <img class="img-lb-img" src="" alt="预览">
            </div>
            <div class="img-lb-footer">
                <div class="img-lb-url-row">
                    <code class="img-lb-url"></code>
                </div>
                <div class="img-lb-info"></div>
                <div class="img-lb-btns">
                    <button class="img-lb-copy btn-secondary">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        复制 URL
                    </button>
                    <button class="img-lb-delete btn-danger-sm">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        删除
                    </button>
                </div>
            </div>
        </div>
    </div>

    <?php
        $iniToBytes = static function (string $val): int {
            $val  = trim($val);
            if ($val === '') return 0;
            $unit = strtolower(substr($val, -1));
            $num  = (int)$val;
            return match ($unit) {
                'g' => $num * 1024 * 1024 * 1024,
                'm' => $num * 1024 * 1024,
                'k' => $num * 1024,
                default => $num,
            };
        };
        $effectiveMax = (int)$MAX_UPLOAD_SIZE;
        foreach (['upload_max_filesize', 'post_max_size'] as $iniKey) {
            $b = $iniToBytes((string)ini_get($iniKey));
            if ($b > 0 && $b < $effectiveMax) $effectiveMax = $b;
        }
        $tipText = sprintf(
            '点击或拖拽图片到此处，支持 JPG / PNG / GIF / WebP，单文件 ≤ %s',
            $effectiveMax >= 1048576
                ? number_format($effectiveMax / 1048576, 1) . 'MB'
                : (number_format($effectiveMax / 1024, 1) . 'KB')
        );
        $panelInitData = [
            'csrf'         => $csrf,
            'tabLabels'    => array_map(fn($t) => $t['label'], $tabs),
            'lazyConfig'   => [
                'v' => [
                    'richtext' => filemtime(__DIR__ . '/js/richtext.js'),
                    'backup'   => filemtime(__DIR__ . '/js/backup.js'),
                    'rcon'     => filemtime(__DIR__ . '/js/rcon-preview.js'),
                ],
                'currentTab' => $currentTab,
            ],
            'uploadLimits' => [
                'max_bytes' => (int)$effectiveMax,
                'tip'       => $tipText,
            ],
        ];
    ?>
    <script id="panel-init-data" type="application/json"><?= json_encode($panelInitData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
    <script src="js/panel-data.js?v=<?= filemtime(__DIR__.'/js/panel-data.js') ?>"></script>
    <script src="js/lazy-loader.js?v=<?= filemtime(__DIR__.'/js/lazy-loader.js') ?>"></script>
    <script defer src="js/core.js?v=<?= filemtime(__DIR__.'/js/core.js') ?>"></script>
    <script defer src="js/messages.js?v=<?= filemtime(__DIR__.'/js/messages.js') ?>"></script>
    <script defer src="js/admin.js?v=<?= filemtime(__DIR__.'/js/admin.js') ?>"></script>
    <script defer src="js/panel-init.js?v=<?= filemtime(__DIR__.'/js/panel-init.js') ?>"></script>
    <script defer src="js/shop.js?v=<?= filemtime(__DIR__.'/js/shop.js') ?>"></script>
    <script defer src="js/images.js?v=<?= filemtime(__DIR__.'/js/images.js') ?>"></script>
</body>
</html>
<?php
// 最终输出广告完整性校验
$__html = ob_get_clean();
if (!verifyAdOutput($__html, $settings)) {
    lockAdmin('广告输出被篡改（注释/隐藏/节点丢失）');
    requireAdIntegrity();
    exit;
}
echo $__html;
?>
