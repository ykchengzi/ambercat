// ==================== RCON 命令模板预览 ====================
// 由 panel.php 的"入服申请"标签页 RCON 模板编辑区使用
// 依赖元素：whitelistCommandTemplateInput / whitelistRejectTemplateInput /
//          rconPreviewApprove / rconPreviewReject / rconPlaceholderGrid
(function () {
    function init() {
        var sample = {
            '{mc_name}': 'xiaohu_sever',
            '{reason}': '资料不完整',
            '{review_note}': '资料不完整',
            '{username}': '我要超市小狐务器',
            '{email}': 'demo@example.com',
            '{app_id}': '128',
            '{user_id}': '42',
            '{status}': 'approved',
            '{source}': 'B站',
            '{age_range}': '18-24'
        };
        var inputApprove   = document.getElementById('whitelistCommandTemplateInput');
        var inputReject    = document.getElementById('whitelistRejectTemplateInput');
        var previewApprove = document.getElementById('rconPreviewApprove');
        var previewReject  = document.getElementById('rconPreviewReject');
        var grid           = document.getElementById('rconPlaceholderGrid');
        if (!inputApprove || !inputReject || !grid) return;

        var lastFocused = inputApprove;
        [inputApprove, inputReject].forEach(function (el) {
            el.addEventListener('focus', function () { lastFocused = el; });
            el.addEventListener('input', renderPreview);
        });
        function renderPreview() {
            [[inputApprove, previewApprove], [inputReject, previewReject]].forEach(function (pair) {
                var t = pair[0].value || '';
                for (var k in sample) t = t.split(k).join(sample[k]);
                pair[1].textContent = t || '(空)';
            });
        }
        grid.querySelectorAll('span[data-placeholder]').forEach(function (span) {
            span.addEventListener('click', function () {
                var ph = span.getAttribute('data-placeholder');
                var input = lastFocused || inputApprove;
                var start = input.selectionStart, end = input.selectionEnd;
                if (typeof start !== 'number') start = end = input.value.length;
                input.value = input.value.slice(0, start) + ph + input.value.slice(end);
                var pos = start + ph.length;
                input.focus();
                try { input.setSelectionRange(pos, pos); } catch (e) {}
                renderPreview();
            });
        });
        renderPreview();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
