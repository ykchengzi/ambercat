<?php
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/tabs.php';
$user = requireUserLogin();
$app = findApplicationByUserId((int) $user['id']);
$csrf = generateUserCsrf();
$_isStaff = isUserStaff($user);
$allowedTabs = ['panel', 'announcements', 'tickets', 'shop', 'orders', 'profile', 'application', 'notifications', 'security', 'account_delete'];
if ($_isStaff) {
    $allowedTabs = array_merge($allowedTabs, ['staff_panel', 'staff_messages', 'staff_announcements', 'staff_tickets', 'staff_applications']);
}
$currentPage = $_GET['tab'] ?? 'panel';
if (!in_array($currentPage, $allowedTabs, true)) {
    $currentPage = 'panel';
}
$errors = [];
$success = '';

$appStatusMap = [
    'pending'        => ['待审核', 'status-pending', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'],
    'approved'       => ['已通过', 'status-approved', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'],
    'rejected'       => ['已拒绝', 'status-rejected', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'],
    'need_more_info' => ['需补充信息', 'status-info', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'],
];
$userStatusMap = [
    'active'  => ['正常', 'status-approved'],
    'banned'  => ['已封禁', 'status-rejected'],
];
$canSubmit = !$app || in_array($app['status'], ['rejected', 'need_more_info'], true);
$settings = loadSettings();
$applicationCooldownHours = max(0, (int)($settings['application_cooldown_hours'] ?? 0));
$applicationMaxSubmissions = max(0, (int)($settings['application_max_submissions'] ?? 0));
$applicationLimitMessage = '';

// ===== 单 SQL 合并 4 类聚合：notifications + user_logs + ticket stats + ticket 限流窗口计数 =====
$_ticketLimitInfo = getSupportTicketCreateLimit($settings);
$_ticketWindowStart = !empty($_ticketLimitInfo['enabled'])
    ? date('Y-m-d H:i:s', time() - (int)$_ticketLimitInfo['seconds'])
    : null;
$dashStats = getUserDashboardStats((int)$user['id'], $_ticketWindowStart);

$notificationStats = $dashStats['notifications'];
$unread = $notificationStats['unread'];
$applicationLogStats = $dashStats['application_logs'];
$applicationSubmittedCount = (int)$applicationLogStats['submitted_count'];
$ticketStats = $dashStats['tickets'];

if ($canSubmit && $applicationMaxSubmissions > 0 && $applicationSubmittedCount >= $applicationMaxSubmissions) {
    $canSubmit = false;
    $applicationLimitMessage = '你已达到入服申请提交次数上限（最多 ' . $applicationMaxSubmissions . ' 次）。';
}
if ($canSubmit && $applicationCooldownHours > 0) {
    $lastSubmittedAt = $applicationLogStats['last_submitted_at'] ?? null;
    if ($lastSubmittedAt) {
        $nextTime = strtotime($lastSubmittedAt) + ($applicationCooldownHours * 3600);
        if ($nextTime > time()) {
            $canSubmit = false;
            $applicationLimitMessage = '申请提交冷却中，请约 ' . (int)ceil(($nextTime - time()) / 3600) . ' 小时后再试。';
        }
    }
}
$notifPerPage = 20;
$notificationsTotal = $notificationStats['total'];
$_notificationsPreloaded = ($currentPage === 'notifications');
if ($_notificationsPreloaded) {
    $stmt = getDb()->prepare('SELECT id, user_id, type, title, content, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    $stmt->bindValue(1, (int)$user['id'], PDO::PARAM_INT);
    $stmt->bindValue(2, $notifPerPage, PDO::PARAM_INT);
    $stmt->execute();
    $notifications = $stmt->fetchAll();
} else {
    $notifications = [];
}
$_announcementsPreloaded = ($currentPage === 'announcements');
$announcements = $_announcementsPreloaded
    ? listAnnouncements(true, 10, ['user_center_only' => true])
    : ($currentPage === 'panel' ? listAnnouncements(true, 1, ['user_center_only' => true]) : []);
$ticketsPerPage = 5;
$_ticketsPreloaded = ($currentPage === 'tickets');
if ($_ticketsPreloaded) {
    $tickets = listSupportTicketsPaged((int)$user['id'], '', $ticketsPerPage, 0);
    $tickets = hydrateSupportTickets($tickets, 'user');
} else {
    $tickets = [];
}
$ticketsTotal = $ticketStats['total'];
$ticketRepliedCount = $ticketStats['replied'];
// 复用 dashStats 中已经查好的 in_window_count，避免 checkSupportTicketCreateLimit 内部再 COUNT 一次
$ticketCreateLimit = checkSupportTicketCreateLimit((int)$user['id'], $settings, $ticketStats['in_window_count']);
$canCreateTicket = empty($ticketCreateLimit['limited']);
$ticketLimitMessage = $ticketCreateLimit['message'] ?? '';
$profileChecks = [
    ['label' => '绑定邮箱', 'done' => !empty($user['email'])],
    ['label' => '填写 Minecraft ID', 'done' => !empty($user['mc_name'])],
    ['label' => '上传头像', 'done' => !empty($user['avatar'])],
    ['label' => '填写联系方式', 'done' => !empty($user['contact_qq']) || !empty($user['contact_discord'])],
    ['label' => '填写个人介绍', 'done' => !empty($user['bio'])],
];
$profileCompleted = 0;
foreach ($profileChecks as $check) {
    if (!empty($check['done'])) $profileCompleted++;
}
$profileCompleteness = (int)round(($profileCompleted / max(1, count($profileChecks))) * 100);
$newbieTasks = [
    ['label' => '完善个人资料', 'desc' => '补充头像、联系方式和个人介绍', 'done' => $profileCompleteness >= 80, 'href' => 'panel.php?tab=profile'],
    ['label' => '提交入服申请', 'desc' => '填写白名单申请并等待审核', 'done' => (bool)$app, 'href' => 'panel.php?tab=application'],
    ['label' => '通过入服审核', 'desc' => '审核通过后即可按指南进入服务器', 'done' => $app && ($app['status'] ?? '') === 'approved', 'href' => 'panel.php?tab=application'],
    ['label' => '查看服务器公告', 'desc' => '了解近期活动、维护和重要通知', 'done' => !empty($announcements), 'href' => 'panel.php?tab=announcements'],
    ['label' => '了解反馈入口', 'desc' => '遇到问题可通过工单联系管理员', 'done' => $ticketsTotal > 0, 'href' => 'panel.php?tab=tickets'],
    ['label' => '阅读站内通知', 'desc' => '及时查看审核结果和系统消息', 'done' => $unread === 0, 'href' => 'panel.php?tab=notifications'],
];
$newbieDone = 0;
foreach ($newbieTasks as $task) {
    if (!empty($task['done'])) $newbieDone++;
}
$typeLabels = [
    'system'      => ['系统通知', 'type-system'],
    'application' => ['申请相关', 'type-application'],
    'review'      => ['审核结果', 'type-review'],
];
$tabLabels = [
    'panel'         => '用户首页',
    'announcements' => '服务器公告',
    'tickets'       => '工单反馈',
    'shop'          => '商城服务',
    'orders'        => '我的订单',
    'profile'       => '个人资料',
    'application'   => '入服申请',
    'notifications' => '站内通知',
    'security'      => '安全中心',
    'account_delete' => '注销账号',
    'staff_panel'         => '工作台 · 概览',
    'staff_messages'      => '工作台 · 留言管理',
    'staff_announcements' => '工作台 · 公告管理',
    'staff_tickets'       => '工作台 · 工单管理',
    'staff_applications'  => '工作台 · 入服审核',
];
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户中心 - 控制面板</title>
<?php include __DIR__ . '/_assets_css.php'; ?>
</head>
<body class="user-page <?= isUserBanned($user) ? 'is-banned' : '' ?>">
    <?php include __DIR__ . '/_sidebar.php'; ?>

    <main class="user-main">
        <header class="user-topbar">
            <button class="mobile-menu-btn" onclick="toggleSidebar()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h2 id="user-page-title"><?= ue($tabLabels[$currentPage]) ?></h2>
            <div></div>
        </header>

        <div class="user-container">
            <?php foreach ($allowedTabs as $tabKey): ?>
            <div id="tab-<?= $tabKey ?>" class="user-tab-pane" style="display: <?= $currentPage === $tabKey ? 'block' : 'none' ?>">
                <?php renderUserTab($tabKey); ?>
            </div>
            <?php endforeach; ?>
        </div>
    </main>
    <script>
        window.userTabLabels = <?= json_encode($tabLabels, JSON_UNESCAPED_UNICODE) ?>;
        window.userCsrf = <?= json_encode($csrf, JSON_UNESCAPED_UNICODE) ?>;
        window.userIsStaff = <?= isUserStaff($user) ? 'true' : 'false' ?>;
    </script>
<?php include __DIR__ . '/_assets_js.php'; ?>
    <?php if ($_isStaff): ?>
    <script src="js/staff.js?v=<?= @filemtime(__DIR__ . '/js/staff.js') ?: 0 ?>" defer></script>
    <?php endif; ?>
</body>
</html>
