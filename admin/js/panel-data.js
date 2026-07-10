/* ============================================================
 * panel-data.js
 * 从 <script id="panel-init-data" type="application/json"> 读取
 * PHP 注入的初始化数据，挂载到全局变量供各模块使用。
 * 注意：本文件必须作为同步脚本（无 defer）在 lazy-loader.js 之前加载，
 * 确保 window.__panelLazyConfig 在 lazy-loader.js 执行时已就绪。
 * ============================================================ */
(function () {
    var el = document.getElementById('panel-init-data');
    if (!el) return;
    var d;
    try {
        d = JSON.parse(el.textContent || el.innerHTML);
    } catch (e) {
        console.error('[panel-data] JSON parse error', e);
        return;
    }
    window.adminCsrf          = d.csrf || '';
    window.tabLabels          = d.tabLabels || {};
    window.__panelLazyConfig  = d.lazyConfig  || { v: {}, currentTab: '' };
    window.adminUploadLimits  = d.uploadLimits || {};
})();
