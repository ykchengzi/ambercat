<?php

declare(strict_types=1);

$files = [
    'js/core.js',
    'js/auth.js',
    'js/richtext.js',
    'js/scroll.js',
    'js/tickets.js',
    'js/interactions.js',
    'js/shop.js',
    'js/bootstrap.js',
];

$base = __DIR__;
$sig = '';
$exists = [];
foreach ($files as $rel) {
    $path = $base . '/' . $rel;
    if (is_file($path)) {
        $exists[] = $path;
        $sig .= '|' . $rel . '|' . filemtime($path) . '|' . filesize($path);
    }
}
$etag = '"' . md5($sig) . '"';

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: public, max-age=31536000, immutable');
header('ETag: ' . $etag);
header('X-Content-Type-Options: nosniff');

$ifNoneMatch = trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
if ($ifNoneMatch !== '' && $ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

if (!ob_start('ob_gzhandler')) ob_start();

foreach ($exists as $path) {
    echo "// === " . basename($path) . " ===\n";
    readfile($path);
    echo "\n;\n";
}
