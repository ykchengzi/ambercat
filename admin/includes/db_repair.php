<?php

if (!defined('ADMIN_DIR')) {
    // 兜底，正常由 config.php 定义
    define('ADMIN_DIR', dirname(__DIR__));
}

/**
 * 统一的步骤结果结构
 */
function dbrepair_step(string $name, string $status, string $message = '', array $details = []): array
{
    // status: ok | warn | error | skip
    return [
        'name'    => $name,
        'status'  => $status,
        'message' => $message,
        'details' => $details,
    ];
}

/**
 * 删除所有 schema 迁移标记，强制下次（本次）重跑结构迁移
 * 这是"旧库导入"问题的核心修复点
 */
function dbrepair_clearSchemaMarkers(): array
{
    $dir = ADMIN_DIR . '/data';
    $removed = [];
    try {
        foreach ((array)@glob($dir . '/.schema_v_*') as $f) {
            if (is_file($f) && @unlink($f)) {
                $removed[] = basename($f);
            }
        }
        return dbrepair_step('清除结构迁移标记', 'ok',
            $removed ? ('已清除 ' . count($removed) . ' 个标记，将强制重跑结构迁移') : '无历史标记，将执行结构迁移',
            ['removed' => $removed]);
    } catch (Throwable $e) {
        return dbrepair_step('清除结构迁移标记', 'error', $e->getMessage());
    }
}

/**
 * 强制重跑结构迁移：补全缺失的表 / 列 / 索引
 */
function dbrepair_runSchemaMigration(): array
{
    try {
        if (!function_exists('ensureUserSystemSchema')) {
            return dbrepair_step('补全表结构', 'skip', '未找到 ensureUserSystemSchema()，跳过');
        }
        // ensureUserSystemSchema 内部用 static $done 防重入；本进程内若已执行过需绕开。
        // 由于本请求是独立进程，static 默认未触发，直接调用即可。
        ensureUserSystemSchema();
        return dbrepair_step('补全表结构', 'ok', '已按当前版本补全缺失的表、字段与索引');
    } catch (Throwable $e) {
        return dbrepair_step('补全表结构', 'error', $e->getMessage());
    }
}

/**
 * 列出当前库内所有基础表（排除视图）
 */
function dbrepair_listTables(): array
{
    $db = getDb();
    $rows = $db->query(
        "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, DATA_FREE
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
    )->fetchAll(PDO::FETCH_ASSOC);
    return is_array($rows) ? $rows : [];
}

/**
 * CHECK / REPAIR：检查并修复损坏的表
 * REPAIR TABLE 仅对 MyISAM / ARCHIVE 等有效；InnoDB 不支持，会被自动跳过（记为 skip）。
 */
function dbrepair_checkAndRepair(): array
{
    $db = getDb();
    $checked = 0; $repaired = 0; $problems = [];
    try {
        $tables = dbrepair_listTables();
        foreach ($tables as $t) {
            $table = $t['TABLE_NAME'];
            $engine = strtolower((string)($t['ENGINE'] ?? ''));
            try {
                $row = $db->query("CHECK TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
                $checked++;
                $msgText = strtolower((string)($row['Msg_text'] ?? ''));
                $msgType = strtolower((string)($row['Msg_type'] ?? ''));
                $healthy = ($msgText === 'ok' || $msgText === 'table is already up to date');
                if (!$healthy && $msgType !== 'status' && $msgType !== 'note') {
                    // 表异常，尝试修复（仅 MyISAM 类引擎支持 REPAIR）
                    if (in_array($engine, ['myisam', 'archive', 'csv'], true)) {
                        try {
                            $db->query("REPAIR TABLE `$table`")->fetchAll();
                            $repaired++;
                            $problems[] = "$table：检测到异常，已尝试 REPAIR";
                        } catch (Throwable $re) {
                            $problems[] = "$table：REPAIR 失败 - " . $re->getMessage();
                        }
                    } else {
                        $problems[] = "$table（$engine）：检测到 \"" . ($row['Msg_text'] ?? '') . "\"，该引擎不支持 REPAIR，建议人工核查";
                    }
                }
            } catch (Throwable $te) {
                // 单表失败不影响其余表
                $problems[] = "$table：CHECK 失败 - " . $te->getMessage();
            }
        }
        $status = $problems ? 'warn' : 'ok';
        $msg = "已检查 $checked 张表";
        if ($repaired) $msg .= "，修复 $repaired 张";
        if (!$problems) $msg .= "，全部正常";
        return dbrepair_step('检查并修复损坏表', $status, $msg, ['problems' => $problems]);
    } catch (Throwable $e) {
        return dbrepair_step('检查并修复损坏表', 'error', $e->getMessage());
    }
}

/**
 * 统一字符集 / 排序规则到 utf8mb4，避免旧库 latin1/utf8 导致的乱码与排序错误
 */
function dbrepair_normalizeCharset(string $targetCharset = 'utf8mb4', string $targetCollation = 'utf8mb4_unicode_ci'): array
{
    $db = getDb();
    $converted = []; $problems = [];
    try {
        $tables = dbrepair_listTables();
        foreach ($tables as $t) {
            $table = $t['TABLE_NAME'];
            $collation = strtolower((string)($t['TABLE_COLLATION'] ?? ''));
            // 已经是 utf8mb4_* 的跳过
            if (strpos($collation, $targetCharset) === 0) continue;
            try {
                $db->exec("ALTER TABLE `$table` CONVERT TO CHARACTER SET $targetCharset COLLATE $targetCollation");
                $converted[] = "$table（{$collation} → {$targetCollation}）";
            } catch (Throwable $ce) {
                $problems[] = "$table：字符集转换失败 - " . $ce->getMessage();
            }
        }
        if (!$converted && !$problems) {
            return dbrepair_step('统一字符集为 utf8mb4', 'ok', '所有表均已是 utf8mb4，无需转换');
        }
        $status = $problems ? 'warn' : 'ok';
        return dbrepair_step('统一字符集为 utf8mb4', $status,
            '已转换 ' . count($converted) . ' 张表' . ($problems ? '，' . count($problems) . ' 张失败' : ''),
            ['converted' => $converted, 'problems' => $problems]);
    } catch (Throwable $e) {
        return dbrepair_step('统一字符集为 utf8mb4', 'error', $e->getMessage());
    }
}

/**
 * 优化（整理碎片 / 回收空间）：仅对有碎片的表执行，避免无谓锁表
 */
function dbrepair_optimize(): array
{
    $db = getDb();
    $optimized = []; $problems = [];
    try {
        $tables = dbrepair_listTables();
        foreach ($tables as $t) {
            $table = $t['TABLE_NAME'];
            $dataFree = (int)($t['DATA_FREE'] ?? 0);
            // 只对碎片 > 256KB 的表做 OPTIMIZE，减少不必要的重建开销
            if ($dataFree < 256 * 1024) continue;
            try {
                $db->query("OPTIMIZE TABLE `$table`")->fetchAll();
                $optimized[] = $table . '（回收约 ' . round($dataFree / 1024) . ' KB）';
            } catch (Throwable $oe) {
                $problems[] = "$table：OPTIMIZE 失败 - " . $oe->getMessage();
            }
        }
        if (!$optimized && !$problems) {
            return dbrepair_step('优化表（整理碎片）', 'ok', '没有需要整理碎片的表');
        }
        $status = $problems ? 'warn' : 'ok';
        return dbrepair_step('优化表（整理碎片）', $status,
            '已优化 ' . count($optimized) . ' 张表',
            ['optimized' => $optimized, 'problems' => $problems]);
    } catch (Throwable $e) {
        return dbrepair_step('优化表（整理碎片）', 'error', $e->getMessage());
    }
}

/**
 * 清理孤儿数据（可选）：删除引用了不存在父记录的子记录
 * 旧库导入后这类脏数据会让新版逻辑（JOIN / 详情页）报错。
 * 仅清理"有明确父子关系"且"安全删除"的关联表。
 */
function dbrepair_cleanOrphans(): array
{
    $db = getDb();
    $cleaned = []; $problems = [];

    // 子表 => [子表外键列, 父表, 父表主键]
    $relations = [
        'support_ticket_replies'        => ['ticket_id', 'support_tickets', 'id'],
        'support_ticket_attachments'    => ['ticket_id', 'support_tickets', 'id'],
        'application_tags'              => ['application_id', 'whitelist_applications', 'id'],
        'whitelist_application_revisions' => ['application_id', 'whitelist_applications', 'id'],
        'notifications'                 => ['user_id', 'users', 'id'],
        'whitelist_applications'        => ['user_id', 'users', 'id'],
    ];

    try {
        // 只处理两张表都存在的关系
        $existing = [];
        foreach (dbrepair_listTables() as $t) $existing[$t['TABLE_NAME']] = true;

        foreach ($relations as $childTable => $rel) {
            [$fk, $parentTable, $pk] = $rel;
            if (empty($existing[$childTable]) || empty($existing[$parentTable])) continue;
            // 该外键列允许为 NULL 时，NULL 不算孤儿
            try {
                $sql = "DELETE c FROM `$childTable` c
                        LEFT JOIN `$parentTable` p ON c.`$fk` = p.`$pk`
                        WHERE c.`$fk` IS NOT NULL AND p.`$pk` IS NULL";
                $n = $db->exec($sql);
                if ($n > 0) {
                    $cleaned[] = "$childTable：删除 $n 条孤儿记录（无对应 $parentTable）";
                }
            } catch (Throwable $de) {
                $problems[] = "$childTable：清理失败 - " . $de->getMessage();
            }
        }
        if (!$cleaned && !$problems) {
            return dbrepair_step('清理孤儿数据', 'ok', '未发现孤儿数据');
        }
        $status = $problems ? 'warn' : 'ok';
        return dbrepair_step('清理孤儿数据', $status,
            $cleaned ? ('共清理 ' . count($cleaned) . ' 类关联') : '部分清理失败',
            ['cleaned' => $cleaned, 'problems' => $problems]);
    } catch (Throwable $e) {
        return dbrepair_step('清理孤儿数据', 'error', $e->getMessage());
    }
}

/**
 * 主入口：执行一轮修复 / 优化
 *
 * @param array $opts
 *   - clean_orphans   bool  是否清理孤儿数据（默认 false，破坏性更高）
 *   - normalize_charset bool 是否统一字符集（默认 true）
 *   - optimize        bool  是否整理碎片（默认 true）
 *   - check_repair    bool  是否检查并修复损坏表（默认 true）
 * @return array { ok:bool, steps:[], summary:{} }
 */
function dbrepairRun(array $opts = []): array
{
    @set_time_limit(600);

    $cleanOrphans      = !empty($opts['clean_orphans']);
    $normalizeCharset  = !isset($opts['normalize_charset']) || $opts['normalize_charset'];
    $doOptimize        = !isset($opts['optimize']) || $opts['optimize'];
    $doCheckRepair     = !isset($opts['check_repair']) || $opts['check_repair'];

    $steps = [];

    // 0) 关闭外键检查，避免修复期间因依赖顺序报错
    try { getDb()->exec('SET FOREIGN_KEY_CHECKS=0'); } catch (Throwable $e) { /* ignore */ }

    // 1) 补全结构（旧库导入问题核心）
    $steps[] = dbrepair_clearSchemaMarkers();
    $steps[] = dbrepair_runSchemaMigration();

    // 2) 检查 / 修复损坏表
    if ($doCheckRepair) {
        $steps[] = dbrepair_checkAndRepair();
    }

    // 3) 统一字符集
    if ($normalizeCharset) {
        $steps[] = dbrepair_normalizeCharset();
    }

    // 4) 清理孤儿数据（可选）
    if ($cleanOrphans) {
        $steps[] = dbrepair_cleanOrphans();
    }

    // 5) 优化碎片
    if ($doOptimize) {
        $steps[] = dbrepair_optimize();
    }

    try { getDb()->exec('SET FOREIGN_KEY_CHECKS=1'); } catch (Throwable $e) { /* ignore */ }

    // 汇总
    $counts = ['ok' => 0, 'warn' => 0, 'error' => 0, 'skip' => 0];
    foreach ($steps as $s) {
        $st = $s['status'] ?? 'ok';
        if (isset($counts[$st])) $counts[$st]++;
    }
    // 没有 error 即视为整体成功（warn 表示部分跳过 / 局部失败但已排除）
    $ok = $counts['error'] === 0;

    return [
        'ok'      => $ok,
        'steps'   => $steps,
        'summary' => $counts,
    ];
}
