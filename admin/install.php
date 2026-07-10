<?php
/**
 * 用户系统一键安装器
 * 填入数据库信息 → 自动测试连接 → 创建数据库和表 → 生成配置文件
 */
require_once __DIR__ . '/config.php';

$rootInstallMode = defined('FOXMC_ROOT_INSTALLER') && FOXMC_ROOT_INSTALLER;
$rootPath = dirname(__DIR__);

if (!$rootInstallMode) {
    header('Location: ../install/');
    exit;
}

function removeInstallDirectory(string $dir): void {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    if ($items === false) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            removeInstallDirectory($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}

// 如果已安装，阻止重复安装（除非管理员登录后手动访问）
$alreadyInstalled = isUserSystemInstalled();

$step   = 'form';   // form | installing | done
$errors = [];
$results = [];

// ====== 安装入口防劫持（S1）======
// 系统已安装的情况下，未登录管理员一律不得调用安装流程；登录管理员则需在表单上勾选确认。
// 否则任何外部访客都能 POST 到 /install/ 把 db_config.php 改成自己的数据库，从而 100% 接管后台。
if ($alreadyInstalled && !isLoggedIn() && $_SERVER['REQUEST_METHOD'] === 'POST') {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>禁止访问</title>'
       . '<div style="max-width:520px;margin:80px auto;font-family:system-ui,sans-serif;padding:24px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:12px;line-height:1.7;">'
       . '<h2 style="margin:0 0 12px;">系统已安装，禁止重复初始化</h2>'
       . '<p>如确需重装，请先登录后台 <a href="../admin/index.php" style="color:#b91c1c;">管理员账号</a>，再返回此处操作。</p>'
       . '</div>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 已安装且为登录管理员重装时，要求显式勾选 reinstall_confirm，避免误操作
    if ($alreadyInstalled && empty($_POST['reinstall_confirm'])) {
        $errors[] = '系统已安装。如需重装，请勾选下方"我确认要覆盖现有数据库配置"。';
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($errors)) {
    $host    = trim($_POST['db_host'] ?? '127.0.0.1');
    $port    = trim($_POST['db_port'] ?? '3306');
    $dbname  = trim($_POST['db_name'] ?? 'foxmc_user_system');
    $user    = trim($_POST['db_user'] ?? '');
    $pass    = $_POST['db_pass'] ?? '';

    // 基本校验
    if ($host === '') $errors[] = '数据库地址不能为空';
    if ($dbname === '') $errors[] = '数据库名称不能为空';
    if ($user === '') $errors[] = '数据库用户名不能为空';

    if (empty($errors)) {
        $step = 'installing';

        // 步骤 1：测试连接（不指定数据库）
        try {
            $dsn = "mysql:host={$host};port={$port};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $results[] = ['ok', '数据库连接成功'];
        } catch (PDOException $e) {
            $errors[] = '无法连接数据库：' . $e->getMessage();
        }

        if (empty($errors)) {
            // 步骤 2：创建数据库（如果不存在）
            try {
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $results[] = ['ok', "数据库 [{$dbname}] 已就绪"];
            } catch (PDOException $e) {
                $errors[] = '创建数据库失败：' . $e->getMessage();
            }
        }

        if (empty($errors)) {
            // 步骤 3：切换到目标数据库并创建表
            try {
                $pdo->exec("USE `{$dbname}`");

                // users 表
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `users` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `username` VARCHAR(32) NOT NULL,
                        `email` VARCHAR(120) NOT NULL,
                        `password_hash` VARCHAR(255) NOT NULL,
                        `mc_name` VARCHAR(32) NOT NULL,
                        `avatar` VARCHAR(255) DEFAULT NULL,
                        `contact_qq` VARCHAR(32) DEFAULT NULL,
                        `contact_discord` VARCHAR(64) DEFAULT NULL,
                        `bio` VARCHAR(1000) DEFAULT NULL,
                        `status` ENUM('active','banned') NOT NULL DEFAULT 'active',
                        `role` ENUM('user','staff') NOT NULL DEFAULT 'user',
                        `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
                        `last_login_at` DATETIME DEFAULT NULL,
                        `last_login_ip` VARCHAR(45) DEFAULT NULL,
                        `admin_note` VARCHAR(1000) DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uk_users_username` (`username`),
                        UNIQUE KEY `uk_users_email` (`email`),
                        KEY `idx_users_status` (`status`),
                        KEY `idx_users_mc_name` (`mc_name`),
                        KEY `idx_users_created_at` (`created_at`),
                        KEY `idx_users_last_login_at` (`last_login_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'users 表创建成功'];

                // whitelist_applications 表
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `whitelist_applications` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `user_id` BIGINT UNSIGNED NOT NULL,
                        `mc_name` VARCHAR(32) NOT NULL,
                        `age_range` VARCHAR(32) DEFAULT NULL,
                        `source` VARCHAR(100) DEFAULT NULL,
                        `reason` TEXT NOT NULL,
                        `agreed_rules` TINYINT(1) NOT NULL DEFAULT 0,
                        `status` ENUM('pending','approved','rejected','need_more_info') NOT NULL DEFAULT 'pending',
                        `review_note` VARCHAR(1000) DEFAULT NULL,
                        `reviewed_by` VARCHAR(64) DEFAULT NULL,
                        `reviewed_at` DATETIME DEFAULT NULL,
                        `synced_to_server` TINYINT(1) NOT NULL DEFAULT 0,
                        `synced_at` DATETIME DEFAULT NULL,
                        `sync_error` TEXT DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uk_whitelist_user_id` (`user_id`),
                        KEY `idx_whitelist_status` (`status`),
                        KEY `idx_whitelist_status_sync` (`status`,`synced_to_server`),
                        KEY `idx_whitelist_reviewed_at` (`reviewed_at`),
                        KEY `idx_whitelist_created_at` (`created_at`),
                        CONSTRAINT `fk_whitelist_user_id`
                            FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
                            ON DELETE CASCADE ON UPDATE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'whitelist_applications 表创建成功'];

                // notifications 表
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `notifications` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `user_id` BIGINT UNSIGNED NOT NULL,
                        `type` ENUM('system','application','review') NOT NULL DEFAULT 'system',
                        `title` VARCHAR(120) NOT NULL,
                        `content` TEXT NOT NULL,
                        `is_read` TINYINT(1) NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_notifications_created_at` (`created_at`),
                        KEY `idx_notifications_user_read_created` (`user_id`,`is_read`,`created_at`),
                        CONSTRAINT `fk_notifications_user_id`
                            FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
                            ON DELETE CASCADE ON UPDATE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'notifications 表创建成功'];

                // user_logs 表
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `user_logs` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `user_id` BIGINT UNSIGNED DEFAULT NULL,
                        `action` VARCHAR(64) NOT NULL,
                        `detail` TEXT DEFAULT NULL,
                        `ip` VARCHAR(45) DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_user_logs_action` (`action`),
                        KEY `idx_user_logs_created_at` (`created_at`),
                        KEY `idx_user_logs_user_action_created` (`user_id`,`action`,`created_at`),
                        CONSTRAINT `fk_user_logs_user_id`
                            FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
                            ON DELETE SET NULL ON UPDATE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'user_logs 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `application_tags` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `application_id` BIGINT UNSIGNED NOT NULL,
                        `tag` VARCHAR(50) NOT NULL,
                        `created_by` VARCHAR(64) DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uk_application_tag` (`application_id`, `tag`),
                        KEY `idx_tag` (`tag`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'application_tags 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `whitelist_application_revisions` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `application_id` BIGINT UNSIGNED NOT NULL,
                        `user_id` BIGINT UNSIGNED NOT NULL,
                        `mc_name` VARCHAR(32) NOT NULL,
                        `age_range` VARCHAR(32) DEFAULT NULL,
                        `source` VARCHAR(100) DEFAULT NULL,
                        `reason` TEXT NOT NULL,
                        `status` VARCHAR(32) NOT NULL,
                        `review_note` VARCHAR(1000) DEFAULT NULL,
                        `snapshot_type` VARCHAR(20) NOT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_application_id` (`application_id`),
                        KEY `idx_user_id` (`user_id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'whitelist_application_revisions 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `announcements` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `title` VARCHAR(120) NOT NULL,
                        `content` TEXT NOT NULL,
                        `level` VARCHAR(20) NOT NULL DEFAULT 'info',
                        `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
                        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                        `show_in_home` TINYINT(1) NOT NULL DEFAULT 0,
                        `show_in_user_center` TINYINT(1) NOT NULL DEFAULT 1,
                        `show_as_popup` TINYINT(1) NOT NULL DEFAULT 0,
                        `publish_at` DATETIME DEFAULT NULL,
                        `start_at` DATETIME DEFAULT NULL,
                        `end_at` DATETIME DEFAULT NULL,
                        `created_by` VARCHAR(64) DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_active_publish` (`is_active`, `publish_at`),
                        KEY `idx_show_scope` (`show_in_home`, `show_in_user_center`, `show_as_popup`),
                        KEY `idx_active_window` (`is_active`, `start_at`, `end_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'announcements 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `support_tickets` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `user_id` BIGINT UNSIGNED NOT NULL,
                        `category` VARCHAR(32) NOT NULL DEFAULT 'other',
                        `subject` VARCHAR(120) NOT NULL,
                        `content` TEXT NOT NULL,
                        `status` VARCHAR(20) NOT NULL DEFAULT 'open',
                        `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
                        `last_reply_at` DATETIME DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_support_tickets_status_user` (`status`,`user_id`),
                        KEY `idx_support_tickets_user_status_reply_created` (`user_id`,`status`,`last_reply_at`,`created_at`),
                        KEY `idx_updated_at` (`updated_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'support_tickets 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `support_ticket_replies` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `ticket_id` BIGINT UNSIGNED NOT NULL,
                        `user_id` BIGINT UNSIGNED DEFAULT NULL,
                        `author_type` VARCHAR(20) NOT NULL DEFAULT 'user',
                        `content` TEXT NOT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_ticket_replies_ticket_created_id` (`ticket_id`,`created_at`,`id`),
                        KEY `idx_created_at` (`created_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'support_ticket_replies 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `support_ticket_attachments` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `ticket_id` BIGINT UNSIGNED NOT NULL,
                        `reply_id` BIGINT UNSIGNED DEFAULT NULL,
                        `user_id` BIGINT UNSIGNED DEFAULT NULL,
                        `author_type` VARCHAR(20) NOT NULL DEFAULT 'user',
                        `original_name` VARCHAR(255) NOT NULL,
                        `stored_path` VARCHAR(255) NOT NULL,
                        `mime_type` VARCHAR(120) NOT NULL DEFAULT '',
                        `size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_ticket_attachments_ticket_id_id` (`ticket_id`,`id`),
                        KEY `idx_ticket_attachments_reply_id_id` (`reply_id`,`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'support_ticket_attachments 表创建成功'];

                // ========== CMS 数据表（替代 JSON 文件存储） ==========

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `site_content` (
                        `id` INT UNSIGNED NOT NULL DEFAULT 1,
                        `content_json` MEDIUMTEXT NOT NULL,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'site_content 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `site_settings` (
                        `id` INT UNSIGNED NOT NULL DEFAULT 1,
                        `settings_json` MEDIUMTEXT NOT NULL,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'site_settings 表创建成功'];

                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `contact_messages` (
                        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `msg_uid` VARCHAR(64) NOT NULL,
                        `name` VARCHAR(100) NOT NULL,
                        `email` VARCHAR(200) NOT NULL,
                        `subject` VARCHAR(100) NOT NULL DEFAULT '',
                        `message` TEXT NOT NULL,
                        `images` VARCHAR(1000) DEFAULT NULL,
                        `is_read` TINYINT(1) NOT NULL DEFAULT 0,
                        `is_replied` TINYINT(1) NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uk_msg_uid` (`msg_uid`),
                        KEY `idx_is_read` (`is_read`),
                        KEY `idx_created_at` (`created_at`),
                        KEY `idx_contact_messages_read_created` (`is_read`,`created_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $results[] = ['ok', 'contact_messages 表创建成功'];

                $ins = $pdo->prepare('INSERT IGNORE INTO site_content (id, content_json) VALUES (1, ?)');
                $ins->execute([json_encode(getDefaultContent(), JSON_UNESCAPED_UNICODE)]);
                $results[] = ['ok', '默认站点内容初始化完成'];

                $ins = $pdo->prepare('INSERT IGNORE INTO site_settings (id, settings_json) VALUES (1, ?)');
                $ins->execute([json_encode(getDefaultSettings(), JSON_UNESCAPED_UNICODE)]);
                $results[] = ['ok', '默认系统设置初始化完成'];

            } catch (PDOException $e) {
                $errors[] = '创建数据表失败：' . $e->getMessage();
            }
        }

        if (empty($errors)) {
            // 步骤 4：写入配置文件
            $configContent = "<?php\n";
            $configContent .= "// 用户系统数据库配置 - 由安装器自动生成于 " . date('Y-m-d H:i:s') . "\n";
            $configContent .= "// 如需修改请直接编辑此文件或删除后重新运行安装器\n";
            $configContent .= "define('DB_HOST', " . var_export($host, true) . ");\n";
            $configContent .= "define('DB_PORT', " . var_export($port, true) . ");\n";
            $configContent .= "define('DB_NAME', " . var_export($dbname, true) . ");\n";
            $configContent .= "define('DB_USER', " . var_export($user, true) . ");\n";
            $configContent .= "define('DB_PASS', " . var_export($pass, true) . ");\n";
            $configContent .= "define('DB_CHARSET', 'utf8mb4');\n";

            $configPath = __DIR__ . '/data/db_config.php';
            if (!is_dir(dirname($configPath))) {
                @mkdir(dirname($configPath), 0755, true);
            }

            if (file_put_contents($configPath, $configContent) !== false) {
                $results[] = ['ok', '配置文件写入成功'];
                register_shutdown_function('removeInstallDirectory', $rootPath . '/install');
                $step = 'done';
            } else {
                $errors[] = '无法写入配置文件 admin/data/db_config.php，请检查目录写权限';
            }
        }
    }
}

// 回填表单值
$formHost   = $_POST['db_host'] ?? '127.0.0.1';
$formPort   = $_POST['db_port'] ?? '3306';
$formDbname = $_POST['db_name'] ?? 'foxmc_user_system';
$formUser   = $_POST['db_user'] ?? 'root';

function he(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户系统安装 - 小狐狸生存服</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif;
            background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 48%, #dcfce7 100%);
            color: #14532d;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            width: 100%;
            max-width: 520px;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(18px);
            border: 1px solid rgba(34, 197, 94, 0.18);
            border-radius: 22px;
            padding: 40px 32px;
            box-shadow: 0 24px 70px rgba(22, 101, 52, 0.14);
        }
        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 8px;
            color: #16a34a;
            font-weight: 700;
            font-size: 1.1em;
        }
        .logo svg { flex-shrink: 0; }
        h1 { text-align: center; font-size: 1.5em; margin-bottom: 4px; color: #14532d; }
        .subtitle { text-align: center; color: #4b5563; font-size: 0.9em; margin-bottom: 28px; }

        .form-group { margin-bottom: 16px; }
        label { display: block; font-size: 0.88em; font-weight: 600; color: #166534; margin-bottom: 5px; }
        input[type="text"], input[type="password"], input[type="number"] {
            width: 100%;
            padding: 10px 14px;
            background: #f8fafc;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            color: #14532d;
            font-size: 0.95em;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus {
            border-color: #22c55e;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.16);
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .form-hint { font-size: 0.78em; color: #6b7280; margin-top: 3px; }

        .btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            border: none;
            border-radius: 10px;
            color: #fff;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            margin-top: 8px;
            transition: transform 0.15s, box-shadow 0.2s;
        }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(34, 197, 94, 0.24); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-success { background: linear-gradient(135deg, #22c55e, #15803d); }
        .btn-warn { background: linear-gradient(135deg, #84cc16, #65a30d); }

        .error-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
        }
        .error-box p { color: #b91c1c; font-size: 0.88em; padding: 2px 0; }

        .result-list { list-style: none; margin-bottom: 16px; }
        .result-list li {
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .result-ok { background: #dcfce7; color: #166534; }
        .result-fail { background: #fef2f2; color: #b91c1c; }

        .done-box {
            text-align: center;
            padding: 20px 0;
        }
        .done-box .icon { font-size: 3em; margin-bottom: 12px; }
        .done-box h2 { color: #10b981; margin-bottom: 8px; }
        .done-box p { color: #4b5563; font-size: 0.9em; margin-bottom: 20px; }

        .link-row {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .link-row a {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.92em;
            transition: transform 0.15s;
        }
        .link-row a:hover { transform: translateY(-1px); }
        .link-primary { background: #16a34a; color: #fff; }
        .link-secondary { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

        .warn-box {
            background: #fefce8;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 16px;
            color: #854d0e;
            font-size: 0.88em;
        }

        .step-indicator {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 24px;
        }
        .step-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #bbf7d0;
        }
        .step-dot.active { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.45); }
        .step-dot.done { background: #15803d; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4H20V20H4V4Z"/><path d="M4 12H20"/><path d="M12 4V20"/></svg>
            <span>小狐狸生存服</span>
        </div>

        <?php if ($step === 'done'): ?>
        <!-- ==================== 安装完成 ==================== -->
        <div class="step-indicator">
            <span class="step-dot done"></span>
            <span class="step-dot done"></span>
            <span class="step-dot done"></span>
        </div>

        <ul class="result-list">
            <?php foreach ($results as $r): ?>
            <li class="result-ok">✅ <?= he($r[1]) ?></li>
            <?php endforeach; ?>
        </ul>

        <div class="done-box">
            <div class="icon">🎉</div>
            <h2>安装完成！</h2>
            <p>用户系统已成功安装，所有数据表已创建完毕。<br>现在可以开始使用了。</p>
            <div class="link-row">
                <a href="../admin/panel.php" class="link-primary">进入后台</a>
                <a href="../index.html" class="link-secondary">返回首页</a>
                <a href="../user/register.php" class="link-secondary">测试注册</a>
            </div>
        </div>

        <?php elseif ($step === 'installing' && !empty($errors)): ?>
        <!-- ==================== 安装出错 ==================== -->
        <div class="step-indicator">
            <span class="step-dot done"></span>
            <span class="step-dot active"></span>
            <span class="step-dot"></span>
        </div>

        <h1>安装出错</h1>
        <p class="subtitle">请检查以下错误后重试</p>

        <?php if ($results): ?>
        <ul class="result-list">
            <?php foreach ($results as $r): ?>
            <li class="result-ok">✅ <?= he($r[1]) ?></li>
            <?php endforeach; ?>
        </ul>
        <?php endif; ?>

        <div class="error-box">
            <?php foreach ($errors as $err): ?>
            <p>❌ <?= he($err) ?></p>
            <?php endforeach; ?>
        </div>

        <form method="POST">
            <input type="hidden" name="db_host" value="<?= he($formHost) ?>">
            <input type="hidden" name="db_port" value="<?= he($formPort) ?>">
            <input type="hidden" name="db_name" value="<?= he($formDbname) ?>">
            <input type="hidden" name="db_user" value="<?= he($formUser) ?>">
            <input type="hidden" name="db_pass" value="">
            <button type="button" class="btn btn-warn" onclick="history.back()">返回修改</button>
        </form>

        <?php else: ?>
        <!-- ==================== 安装表单 ==================== -->
        <div class="step-indicator">
            <span class="step-dot active"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
        </div>

        <h1>用户系统安装</h1>
        <p class="subtitle">填写 MySQL 数据库信息，一键完成安装</p>

        <?php if ($alreadyInstalled && !isLoggedIn()): ?>
        <div class="error-box">
            <p>🔒 系统已安装，禁止任何未登录访客再次执行安装。请先登录管理后台后再回到此页面操作。</p>
            <p style="margin-top:8px;"><a href="../admin/index.php" style="color:#b91c1c;text-decoration:underline;">前往登录</a></p>
        </div>
        <?php elseif ($alreadyInstalled): ?>
        <div class="warn-box">
            ⚠️ 检测到已有安装配置。重新安装将覆盖 <code>admin/data/db_config.php</code> 中的数据库连接信息（已有数据不会丢失，表使用 IF NOT EXISTS）。
        </div>
        <?php endif; ?>

        <?php if ($errors): ?>
        <div class="error-box">
            <?php foreach ($errors as $err): ?>
            <p>❌ <?= he($err) ?></p>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <form method="POST" id="installForm">
            <div class="form-row">
                <div class="form-group">
                    <label for="db_host">数据库地址</label>
                    <input type="text" id="db_host" name="db_host" value="<?= he($formHost) ?>" placeholder="127.0.0.1">
                    <div class="form-hint">通常为 127.0.0.1 或 localhost</div>
                </div>
                <div class="form-group">
                    <label for="db_port">端口</label>
                    <input type="text" id="db_port" name="db_port" value="<?= he($formPort) ?>" placeholder="3306">
                    <div class="form-hint">默认 3306</div>
                </div>
            </div>

            <div class="form-group">
                <label for="db_name">数据库名称</label>
                <input type="text" id="db_name" name="db_name" value="<?= he($formDbname) ?>" placeholder="foxmc_user_system">
                <div class="form-hint">不存在会自动创建</div>
            </div>

            <div class="form-group">
                <label for="db_user">数据库用户名</label>
                <input type="text" id="db_user" name="db_user" value="<?= he($formUser) ?>" placeholder="root">
            </div>

            <div class="form-group">
                <label for="db_pass">数据库密码</label>
                <input type="password" id="db_pass" name="db_pass" value="" placeholder="输入数据库密码">
                <div class="form-hint">如果没有密码可留空</div>
            </div>

            <?php if ($alreadyInstalled && isLoggedIn()): ?>
            <div class="form-group" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;">
                <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;color:#991b1b;font-weight:600;">
                    <input type="checkbox" name="reinstall_confirm" value="1" style="margin-top:3px;">
                    <span>我已了解：这将覆盖 <code>admin/data/db_config.php</code>，新数据库可能令现有管理员无法登录，请提前备份。</span>
                </label>
            </div>
            <?php endif; ?>

            <button type="submit" class="btn" id="installBtn"<?= ($alreadyInstalled && !isLoggedIn()) ? ' disabled style="opacity:.5;cursor:not-allowed;"' : '' ?>>
                🚀 开始安装
            </button>
        </form>

        <script>
        document.getElementById('installForm').addEventListener('submit', function() {
            var btn = document.getElementById('installBtn');
            btn.textContent = '⏳ 安装中...';
            btn.disabled = true;
        });
        </script>

        <?php endif; ?>
    </div>
</body>
</html>
