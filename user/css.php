<?php

declare(strict_types=1);

$files = [
    'css/base.css',
    'css/auth.css',
    'css/layout.css',
    'css/forms.css',
    'css/richtext.css',
    'css/pages.css',
    'css/effects.css',
    'css/staff.css',
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

header('Content-Type: text/css; charset=utf-8');
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
    echo "/* === " . basename($path) . " === */\n";
    $content = (string)file_get_contents($path);
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }
    echo $content;
    echo "\n";
}
