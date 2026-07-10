<?php

declare(strict_types=1);

const ADMIN_CSS_BUNDLES = [
    'panel' => [
        'css/variables.css',
        'css/layout.css',
        'css/forms.css',
        'css/components.css',
        'css/shop.css',
        'css/login.css',
        'css/monitor.css',
        'css/modals.css',
        'css/utilities.css',
    ],
    'login' => [
        'css/variables.css',
        'css/layout.css',
        'css/forms.css',
        'css/components.css',
        'css/login.css',
        'css/utilities.css',
    ],
];

$bundle = $_GET['b'] ?? 'panel';
if (!isset(ADMIN_CSS_BUNDLES[$bundle])) $bundle = 'panel';

$base = __DIR__;
$files = ADMIN_CSS_BUNDLES[$bundle];

// 计算合并 mtime / 大小，作为 ETag 来源
$sig = $bundle;
$exists = [];
foreach ($files as $rel) {
    $path = $base . '/' . $rel;
    if (is_file($path)) {
        $exists[] = $path;
        $sig .= '|' . $rel . '|' . filemtime($path) . '|' . filesize($path);
    }
}
$etag = '"' . md5($sig) . '"';

header('Content-Type: text/css; charset=utf-8');
header('Cache-Control: public, max-age=31536000, immutable');
header('ETag: ' . $etag);
header('X-Content-Type-Options: nosniff');

$ifNoneMatch = trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
if ($ifNoneMatch !== '' && $ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

// 启用 gzip（如果 Apache 已开 mod_deflate，会再压一次；ob_gzhandler 兜底）
if (!ob_start('ob_gzhandler')) ob_start();

foreach ($exists as $path) {
    echo "/* === " . basename($path) . " === */\n";
    readfile($path);
    echo "\n";
}
