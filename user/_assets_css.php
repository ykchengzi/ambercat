<?php

$__userCssFiles = [
    'css/base.css', 'css/auth.css', 'css/layout.css', 'css/forms.css',
    'css/richtext.css', 'css/pages.css', 'css/effects.css', 'css/staff.css',
];
$__cssV = (int)@filemtime(__DIR__ . '/css.php');
foreach ($__userCssFiles as $__f) {
    $__t = (int)@filemtime(__DIR__ . '/' . $__f);
    if ($__t > $__cssV) $__cssV = $__t;
}
echo '    <link rel="stylesheet" href="css.php?v=' . $__cssV . '">' . "\n";
unset($__userCssFiles, $__cssV, $__f, $__t);
