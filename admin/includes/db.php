<?php
/**
 * 数据库连接与模式管理
 * PDO 连接、表结构迁移、默认数据初始化
 */

define('DB_CONFIG_FILE', ADMIN_DIR . '/data/db_config.php');

if (file_exists(DB_CONFIG_FILE)) {
    require_once DB_CONFIG_FILE;
}
if (!defined('DB_HOST'))    define('DB_HOST', '127.0.0.1');
if (!defined('DB_PORT'))    define('DB_PORT', '3306');
if (!defined('DB_NAME'))    define('DB_NAME', 'foxmc_user_system');
if (!defined('DB_USER'))    define('DB_USER', 'root');
if (!defined('DB_PASS'))    define('DB_PASS', '');
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

function isUserSystemInstalled(): bool {
    return file_exists(DB_CONFIG_FILE);
}

function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function columnExists(string $table, string $column): bool {
    $stmt = getDb()->prepare('SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function addColumnIfMissing(string $table, string $column, string $definition): void {
    if (!columnExists($table, $column)) {
        getDb()->exec("ALTER TABLE `$table` ADD COLUMN $definition");
    }
}

function indexExists(string $table, string $indexName): bool {
    $stmt = getDb()->prepare('SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?');
    $stmt->execute([$table, $indexName]);
    return (int)$stmt->fetchColumn() > 0;
}

function addIndexIfMissing(string $table, string $indexName, string $columns): void {
    if (!indexExists($table, $indexName)) {
        try {
            getDb()->exec("ALTER TABLE `$table` ADD INDEX `$indexName` ($columns)");
        } catch (Throwable $e) {
            @error_log('[FoxMC] addIndexIfMissing failed: ' . $e->getMessage());
        }
    }
}

function dropIndexIfExists(string $table, string $indexName): void {
    if (indexExists($table, $indexName)) {
        try {
            getDb()->exec("ALTER TABLE `$table` DROP INDEX `$indexName`");
        } catch (Throwable $e) {
            @error_log('[FoxMC] dropIndexIfExists failed: ' . $e->getMessage());
        }
    }
}

function modifyColumnIfDifferent(string $table, string $column, string $expectedTypePrefix, string $newDefinition): void {
    try {
        $stmt = getDb()->prepare('SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
        $stmt->execute([$table, $column]);
        $colType = strtolower((string)$stmt->fetchColumn());
        if ($colType !== '' && stripos($colType, strtolower($expectedTypePrefix)) === 0) {
            getDb()->exec("ALTER TABLE `$table` MODIFY COLUMN `$column` $newDefinition");
        }
    } catch (Throwable $e) {
        @error_log('[FoxMC] modifyColumnIfDifferent failed: ' . $e->getMessage());
    }
}

/**
 * 改这个版本号即可强制重跑一次表结构迁移（新增列 / 新增索引 / 新建表时）。
 * 否则正常请求会通过文件标记跳过整段 information_schema 探测 + ALTER TABLE，
 * 显著降低弱服务器上每次请求的固定开销。
 */
const SCHEMA_VERSION = '2026-05-18-1-performance';

function ensureUserSystemSchema(): void {
    static $done = false;
    if ($done || !isUserSystemInstalled()) return;
    $done = true;

    // 已经按当前 SCHEMA_VERSION 跑过迁移：直接跳过，省掉所有 INFORMATION_SCHEMA 查询和 CREATE/ALTER 探测
    $marker = ADMIN_DIR . '/data/.schema_v_' . SCHEMA_VERSION;
    if (is_file($marker)) return;

    $db = getDb();

    $userColumns = [
        'avatar' => '`avatar` VARCHAR(255) DEFAULT NULL',
        'contact_qq' => '`contact_qq` VARCHAR(32) DEFAULT NULL',
        'contact_discord' => '`contact_discord` VARCHAR(64) DEFAULT NULL',
        'bio' => '`bio` VARCHAR(1000) DEFAULT NULL',
        'status' => "`status` ENUM('active','banned') NOT NULL DEFAULT 'active'",
        'role' => "`role` ENUM('user','staff') NOT NULL DEFAULT 'user'",
        'email_verified' => '`email_verified` TINYINT(1) NOT NULL DEFAULT 0',
        'last_login_at' => '`last_login_at` DATETIME DEFAULT NULL',
        'last_login_ip' => '`last_login_ip` VARCHAR(45) DEFAULT NULL',
        'admin_note' => '`admin_note` VARCHAR(1000) DEFAULT NULL',
        'updated_at' => '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];
    foreach ($userColumns as $column => $definition) {
        addColumnIfMissing('users', $column, $definition);
    }
    // role enum 历史上只有 'user'，需要升级到 'user','staff'
    try {
        $stmt = $db->prepare('SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
        $stmt->execute(['users', 'role']);
        $colType = (string)$stmt->fetchColumn();
        if ($colType !== '' && stripos($colType, "'staff'") === false) {
            $db->exec("ALTER TABLE users MODIFY COLUMN `role` ENUM('user','staff') NOT NULL DEFAULT 'user'");
        }
    } catch (Throwable $e) {
        error_log('[FoxMC] migrate users.role enum failed: ' . $e->getMessage());
    }

    $applicationColumns = [
        'age_range' => '`age_range` VARCHAR(32) DEFAULT NULL',
        'source' => '`source` VARCHAR(100) DEFAULT NULL',
        'agreed_rules' => '`agreed_rules` TINYINT(1) NOT NULL DEFAULT 0',
        'status' => "`status` ENUM('pending','approved','rejected','need_more_info') NOT NULL DEFAULT 'pending'",
        'review_note' => '`review_note` VARCHAR(1000) DEFAULT NULL',
        'reviewed_by' => '`reviewed_by` VARCHAR(64) DEFAULT NULL',
        'reviewed_at' => '`reviewed_at` DATETIME DEFAULT NULL',
        'synced_to_server' => '`synced_to_server` TINYINT(1) NOT NULL DEFAULT 0',
        'synced_at' => '`synced_at` DATETIME DEFAULT NULL',
        'updated_at' => '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];
    foreach ($applicationColumns as $column => $definition) {
        addColumnIfMissing('whitelist_applications', $column, $definition);
    }

    $db->exec("CREATE TABLE IF NOT EXISTS application_tags (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        application_id BIGINT UNSIGNED NOT NULL,
        tag VARCHAR(50) NOT NULL,
        created_by VARCHAR(64) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_tag (tag),
        UNIQUE KEY uk_application_tag (application_id, tag)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS whitelist_application_revisions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        application_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        mc_name VARCHAR(32) NOT NULL,
        age_range VARCHAR(32) DEFAULT NULL,
        source VARCHAR(100) DEFAULT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(32) NOT NULL,
        review_note TEXT DEFAULT NULL,
        snapshot_type VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_application_id (application_id),
        KEY idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS announcements (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(120) NOT NULL,
        content TEXT NOT NULL,
        level VARCHAR(20) NOT NULL DEFAULT 'info',
        is_pinned TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        publish_at DATETIME DEFAULT NULL,
        show_in_home TINYINT(1) NOT NULL DEFAULT 0,
        show_in_user_center TINYINT(1) NOT NULL DEFAULT 1,
        show_as_popup TINYINT(1) NOT NULL DEFAULT 0,
        start_at DATETIME DEFAULT NULL,
        end_at DATETIME DEFAULT NULL,
        created_by VARCHAR(64) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_active_publish (is_active, publish_at),
        KEY idx_show_scope (show_in_home, show_in_user_center, show_as_popup),
        KEY idx_active_window (is_active, start_at, end_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!columnExists('announcements', 'show_in_home')) {
        $db->exec('ALTER TABLE announcements ADD COLUMN show_in_home TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    }
    if (!columnExists('announcements', 'show_in_user_center')) {
        $db->exec('ALTER TABLE announcements ADD COLUMN show_in_user_center TINYINT(1) NOT NULL DEFAULT 1 AFTER show_in_home');
    }
    if (!columnExists('announcements', 'show_as_popup')) {
        $db->exec('ALTER TABLE announcements ADD COLUMN show_as_popup TINYINT(1) NOT NULL DEFAULT 0 AFTER show_in_user_center');
    }
    if (!columnExists('announcements', 'start_at')) {
        $db->exec('ALTER TABLE announcements ADD COLUMN start_at DATETIME DEFAULT NULL AFTER publish_at');
    }
    if (!columnExists('announcements', 'end_at')) {
        $db->exec('ALTER TABLE announcements ADD COLUMN end_at DATETIME DEFAULT NULL AFTER start_at');
    }
    $db->exec("CREATE TABLE IF NOT EXISTS support_tickets (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'other',
        subject VARCHAR(120) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        last_reply_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_support_tickets_status_user (status, user_id),
        KEY idx_support_tickets_user_status_reply_created (user_id, status, last_reply_at, created_at),
        KEY idx_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS support_ticket_replies (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        ticket_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        author_type VARCHAR(20) NOT NULL DEFAULT 'user',
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ticket_replies_ticket_created_id (ticket_id, created_at, id),
        KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS support_ticket_attachments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        ticket_id BIGINT UNSIGNED NOT NULL,
        reply_id BIGINT UNSIGNED DEFAULT NULL,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        author_type VARCHAR(20) NOT NULL DEFAULT 'user',
        original_name VARCHAR(255) NOT NULL,
        stored_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT '',
        size BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ticket_attachments_ticket_id_id (ticket_id, id),
        KEY idx_ticket_attachments_reply_id_id (reply_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // CMS 数据表（替代 JSON 文件存储）
    $db->exec("CREATE TABLE IF NOT EXISTS site_content (
        id INT UNSIGNED NOT NULL DEFAULT 1,
        content_json MEDIUMTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS site_settings (
        id INT UNSIGNED NOT NULL DEFAULT 1,
        settings_json MEDIUMTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS contact_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        msg_uid VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200) NOT NULL,
        subject VARCHAR(100) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        images TEXT DEFAULT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        is_replied TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_msg_uid (msg_uid),
        KEY idx_is_read (is_read),
        KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // U9: 补 user_logs 索引以加速 risk_summary 等高频聚合查询
    addIndexIfMissing('user_logs', 'idx_user_logs_ip', '`ip`');
    addIndexIfMissing('user_logs', 'idx_user_logs_created_ip', '`created_at`, `ip`');
    addIndexIfMissing('user_logs', 'idx_user_logs_user_action_created', '`user_id`, `action`, `created_at`');
    addIndexIfMissing('users', 'idx_users_created_at', '`created_at`');
    addIndexIfMissing('users', 'idx_users_status_created', '`status`, `created_at`');
    addIndexIfMissing('support_tickets', 'idx_support_tickets_status_user', '`status`, `user_id`');
    addIndexIfMissing('support_tickets', 'idx_support_tickets_user_status_reply_created', '`user_id`, `status`, `last_reply_at`, `created_at`');
    addIndexIfMissing('support_tickets', 'idx_support_tickets_user_created', '`user_id`, `created_at`');
    addIndexIfMissing('support_ticket_replies', 'idx_ticket_replies_ticket_created_id', '`ticket_id`, `created_at`, `id`');
    addIndexIfMissing('support_ticket_attachments', 'idx_ticket_attachments_ticket_id_id', '`ticket_id`, `id`');
    addIndexIfMissing('support_ticket_attachments', 'idx_ticket_attachments_reply_id_id', '`reply_id`, `id`');
    addIndexIfMissing('whitelist_applications', 'idx_whitelist_status_sync', '`status`, `synced_to_server`');
    addIndexIfMissing('whitelist_applications', 'idx_whitelist_user_id', '`user_id`');
    addIndexIfMissing('whitelist_applications', 'idx_whitelist_created_at', '`created_at`');
    addIndexIfMissing('contact_messages', 'idx_contact_messages_read_created', '`is_read`, `created_at`');
    addIndexIfMissing('notifications', 'idx_notifications_user_read_created', '`user_id`, `is_read`, `created_at`');
    addIndexIfMissing('notifications', 'idx_notifications_user_created', '`user_id`, `created_at`');
    addIndexIfMissing('announcements', 'idx_announcements_user_active_window', '`show_in_user_center`, `is_active`, `start_at`, `end_at`');
    addIndexIfMissing('announcements', 'idx_announcements_home_active_window', '`show_in_home`, `is_active`, `start_at`, `end_at`');

    // ===== Slim 优化：删除被复合索引覆盖的冗余二级索引，降低写入与内存开销 =====
    // support_tickets：四列复合索引 idx_support_tickets_user_status_reply_created 已经覆盖前缀 (user_id)、(user_id,status)
    dropIndexIfExists('support_tickets', 'idx_user_id');
    dropIndexIfExists('support_tickets', 'idx_status'); // 被 idx_support_tickets_status_user 覆盖
    dropIndexIfExists('support_tickets', 'idx_support_tickets_user_status');
    // support_ticket_replies：idx_ticket_replies_ticket_created_id 已覆盖 (ticket_id)
    dropIndexIfExists('support_ticket_replies', 'idx_ticket_id');
    // support_ticket_attachments
    dropIndexIfExists('support_ticket_attachments', 'idx_ticket_id');
    dropIndexIfExists('support_ticket_attachments', 'idx_reply_id');
    // application_tags：UNIQUE (application_id, tag) 已覆盖 (application_id)
    dropIndexIfExists('application_tags', 'idx_application_id');
    // notifications：复合索引 (user_id,is_read,created_at) 已覆盖 (user_id)；is_read 单列选择性太差
    dropIndexIfExists('notifications', 'idx_notifications_user_id');
    dropIndexIfExists('notifications', 'idx_notifications_is_read');
    // user_logs：(user_id,action,created_at) 已覆盖 (user_id)
    dropIndexIfExists('user_logs', 'idx_user_logs_user_id');
    // announcements：is_pinned 仅 0/1 两值，没有任何用
    dropIndexIfExists('announcements', 'idx_pinned');

    // ===== Slim 优化：TEXT → VARCHAR 收紧，避免 InnoDB off-page 存储，弱服务器随机 IO 显著下降 =====
    // 注意：仅当字段当前是 TEXT 时才改，且改后长度对实际数据足够大
    modifyColumnIfDifferent('users', 'bio', 'text', 'VARCHAR(1000) DEFAULT NULL');
    modifyColumnIfDifferent('users', 'admin_note', 'text', 'VARCHAR(1000) DEFAULT NULL');
    modifyColumnIfDifferent('whitelist_applications', 'review_note', 'text', 'VARCHAR(1000) DEFAULT NULL');
    modifyColumnIfDifferent('whitelist_application_revisions', 'review_note', 'text', 'VARCHAR(1000) DEFAULT NULL');
    modifyColumnIfDifferent('contact_messages', 'images', 'text', 'VARCHAR(1000) DEFAULT NULL');

    // ===== Slim 优化：LONGTEXT → MEDIUMTEXT（16MB 上限远超 CMS 实际数据，元数据更轻） =====
    modifyColumnIfDifferent('site_content', 'content_json', 'longtext', 'MEDIUMTEXT NOT NULL');
    modifyColumnIfDifferent('site_settings', 'settings_json', 'longtext', 'MEDIUMTEXT NOT NULL');

    initializeDefaultSiteData($db);

    // 标记当前 SCHEMA_VERSION 已迁移完成，后续请求直接跳过整个函数
    @file_put_contents($marker, date('c'));
}

function initializeDefaultSiteData(PDO $db): void {
    if (function_exists('getDefaultContent')) {
        $stmt = $db->prepare('INSERT IGNORE INTO site_content (id, content_json) VALUES (1, ?)');
        $stmt->execute([json_encode(getDefaultContent(), JSON_UNESCAPED_UNICODE)]);
    }
    if (function_exists('getDefaultSettings')) {
        $stmt = $db->prepare('INSERT IGNORE INTO site_settings (id, settings_json) VALUES (1, ?)');
        $stmt->execute([json_encode(getDefaultSettings(), JSON_UNESCAPED_UNICODE)]);
    }
}
