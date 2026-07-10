<?php

$__userJsFiles = [
    'js/core.js', 'js/auth.js', 'js/richtext.js', 'js/scroll.js',
    'js/tickets.js', 'js/shop.js', 'js/interactions.js', 'js/bootstrap.js',
];
foreach ($__userJsFiles as $__f) {
    $__t = (int)@filemtime(__DIR__ . '/' . $__f);
    echo '    <script src="' . htmlspecialchars($__f, ENT_QUOTES, 'UTF-8') . '?v=' . $__t . '" defer></script>' . "\n";
}
unset($__userJsFiles, $__f, $__t);
