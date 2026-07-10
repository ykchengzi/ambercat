// ==== 按需加载脚本缓存 / stub ====
// 依赖 window.__panelLazyConfig = { v: {richtext, backup, rcon}, currentTab: '...' }
(function() {
    var cfg = window.__panelLazyConfig || { v: {}, currentTab: '' };
    var V = cfg.v || {};
    var cache = {};

    function loadScript(url) {
        if (cache[url]) return cache[url];
        cache[url] = new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = url; s.async = false;
            s.onload = function() { resolve(); };
            s.onerror = function() { reject(new Error('加载失败: ' + url)); };
            document.head.appendChild(s);
        });
        return cache[url];
    }
    window.loadScript = loadScript;

    // 富文本：stub 形式存在，第一次被调用（工单回复 / 公告编辑器渲染等）时才加载真正的 richtext.js
    var richtextStub = function(root) {
        return loadScript('js/richtext.js?v=' + V.richtext).then(function() {
            if (typeof window.initAdminRichTextEditors === 'function'
                && window.initAdminRichTextEditors !== richtextStub) {
                return window.initAdminRichTextEditors(root);
            }
        });
    };
    window.initAdminRichTextEditors = richtextStub;

    function ensureTabScripts(key) {
        if (key === 'backup') loadScript('js/backup.js?v=' + V.backup);
        else if (key === 'applications') loadScript('js/rcon-preview.js?v=' + V.rcon);
    }

    // 首次加载就在目标 tab：立刻拉相应脚本（rcon-preview / backup 内部自检 DOM 后初始化）
    ensureTabScripts(cfg.currentTab);

    // core.js 加载后包一层 switchTab，切换到对应 tab 时按需载入
    document.addEventListener('DOMContentLoaded', function() {
        var orig = window.switchTab;
        if (typeof orig !== 'function') return;
        window.switchTab = function(key) {
            ensureTabScripts(key);
            return orig.apply(this, arguments);
        };
    });
})();
