// ==================== 轻量富文本编辑器 ====================
// 设计：仅依赖 contentEditable + execCommand，无第三方库；服务端已有白名单清洗，
// 这里只做易用性 + 粘贴清洗 + 活动态高亮 + 快捷键 + 字符计数。
var RICH_TEXT_ALLOWED_TAGS = ['P','BR','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','CODE','A'];
var RICH_TEXT_MAX_CHARS = 5000;

function richTextSvg(name) {
    var paths = {
        bold:    '<path d="M7 5h5a3 3 0 0 1 0 6H7zM7 11h6a3 3 0 0 1 0 6H7z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
        italic:  '<path d="M14 5h-4M14 19h-4M13 5l-2 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        underline:'<path d="M7 5v8a5 5 0 0 0 10 0V5M5 21h14" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
        strike:  '<path d="M5 12h14M8 8a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3M16 16a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
        ul:      '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/>',
        ol:      '<path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><text x="2.2" y="8" font-size="6" fill="currentColor" font-family="ui-sans-serif">1</text><text x="2.2" y="14" font-size="6" fill="currentColor" font-family="ui-sans-serif">2</text><text x="2.2" y="20" font-size="6" fill="currentColor" font-family="ui-sans-serif">3</text>',
        quote:   '<path d="M7 7h4v4H7zm0 4c0 3-2 4-2 4M13 7h4v4h-4zm0 4c0 3-2 4-2 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
        code:    '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
        link:    '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
        unlink:  '<path d="M10 14a4 4 0 0 0 5.66 0l1.5-1.5M14 10a4 4 0 0 0-5.66 0l-1.5 1.5M4 4l16 16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
        clear:   '<path d="M5 5l14 14M9 4h11v3l-7 7M14 14l-3 6H7l3-6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        undo:    '<path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        redo:    '<path d="M15 14l4-4-4-4M19 10h-9a5 5 0 0 0 0 10h3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' + (paths[name] || '') + '</svg>';
}

function richTextSanitizeFragment(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT, null);
    var toUnwrap = [];
    var node;
    while ((node = walker.nextNode())) {
        if (RICH_TEXT_ALLOWED_TAGS.indexOf(node.tagName) === -1) {
            toUnwrap.push(node);
            continue;
        }
        // 清除危险/无用属性
        var attrs = Array.prototype.slice.call(node.attributes || []);
        for (var i = 0; i < attrs.length; i++) {
            var a = attrs[i];
            if (node.tagName === 'A' && a.name === 'href') {
                if (!/^(https?:|mailto:)/i.test(a.value)) node.removeAttribute('href');
                continue;
            }
            node.removeAttribute(a.name);
        }
        if (node.tagName === 'A' && node.getAttribute('href')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    }
    // 倒序展开非法标签
    for (var j = toUnwrap.length - 1; j >= 0; j--) {
        var el = toUnwrap[j];
        var parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    }
    return tpl.innerHTML;
}

function richTextWrapInlineCode(editor) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    // 已在 <code> 内则解包
    var anchor = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
    var existingCode = anchor && anchor.closest ? anchor.closest('code') : null;
    if (existingCode && editor.contains(existingCode)) {
        var p = existingCode.parentNode;
        while (existingCode.firstChild) p.insertBefore(existingCode.firstChild, existingCode);
        p.removeChild(existingCode);
        return;
    }
    if (range.collapsed) return;
    var code = document.createElement('code');
    try { range.surroundContents(code); }
    catch (e) {
        // 跨节点选区：退化为纯文本包裹
        var text = range.toString();
        if (!text) return;
        range.deleteContents();
        code.textContent = text;
        range.insertNode(code);
    }
    sel.removeAllRanges();
    var newRange = document.createRange();
    newRange.selectNodeContents(code);
    sel.addRange(newRange);
}

function richTextInsertLink(editor) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
        editor.focus();
        return;
    }
    var current = sel.anchorNode && sel.anchorNode.parentNode && sel.anchorNode.parentNode.closest
        ? sel.anchorNode.parentNode.closest('a') : null;
    var defaultUrl = current ? current.getAttribute('href') || '' : 'https://';
    var url = window.prompt('请输入链接地址（http(s):// 或 mailto:）', defaultUrl);
    if (url === null) return;
    url = url.trim();
    if (url === '') {
        document.execCommand('unlink');
        return;
    }
    if (!/^(https?:|mailto:)/i.test(url)) {
        if (window.showToast) window.showToast('链接格式无效', 'error');
        return;
    }
    document.execCommand('createLink', false, url);
    // 给新建/已有链接加上 target/rel
    var anchorEl = sel.anchorNode && sel.anchorNode.parentNode && sel.anchorNode.parentNode.closest
        ? sel.anchorNode.parentNode.closest('a') : null;
    if (anchorEl) {
        anchorEl.setAttribute('target', '_blank');
        anchorEl.setAttribute('rel', 'noopener noreferrer');
    }
}

function initRichTextEditors(root) {
    root = root || document;
    var TOOLBAR_ITEMS = [
        { cmd: 'bold',                icon: 'bold',      title: '加粗 (Ctrl+B)',   key: 'b', state: 'bold' },
        { cmd: 'italic',              icon: 'italic',    title: '斜体 (Ctrl+I)',   key: 'i', state: 'italic' },
        { cmd: 'underline',           icon: 'underline', title: '下划线 (Ctrl+U)', key: 'u', state: 'underline' },
        { cmd: 'strikeThrough',       icon: 'strike',    title: '删除线',                    state: 'strikeThrough' },
        { sep: true },
        { cmd: 'insertUnorderedList', icon: 'ul',        title: '无序列表',                  state: 'insertUnorderedList' },
        { cmd: 'insertOrderedList',   icon: 'ol',        title: '有序列表',                  state: 'insertOrderedList' },
        { cmd: 'formatBlock',         arg: 'blockquote', icon: 'quote', title: '引用' },
        { cmd: '__code',              icon: 'code',      title: '行内代码' },
        { sep: true },
        { cmd: '__link',              icon: 'link',      title: '插入链接 (Ctrl+K)', key: 'k' },
        { cmd: 'unlink',              icon: 'unlink',    title: '取消链接' },
        { sep: true },
        { cmd: 'removeFormat',        icon: 'clear',     title: '清除格式' },
        { cmd: 'undo',                icon: 'undo',      title: '撤销 (Ctrl+Z)' },
        { cmd: 'redo',                icon: 'redo',      title: '重做 (Ctrl+Shift+Z)' }
    ];

    root.querySelectorAll('textarea.rich-text-source').forEach(function(textarea) {
        if (textarea.dataset.richBound === '1') return;
        textarea.dataset.richBound = '1';

        var wrap = document.createElement('div');
        wrap.className = 'rich-text-editor';
        var toolbar = document.createElement('div');
        toolbar.className = 'rich-text-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        var editor = document.createElement('div');
        editor.className = 'rich-text-area';
        editor.contentEditable = 'true';
        editor.spellcheck = true;
        editor.dataset.placeholder = textarea.getAttribute('placeholder') || '';
        editor.innerHTML = textarea.value || '';

        var status = document.createElement('div');
        status.className = 'rich-text-status';
        var counter = document.createElement('span');
        counter.className = 'rich-text-counter';
        status.appendChild(counter);

        var syncTimer = null;
        function sync() {
            // 编辑器内容仅剩占位 <br> / 空段时，清空让 placeholder 恢复
            var rawHtml = editor.innerHTML.trim();
            if (/^(<br\s*\/?>|<p>\s*(<br\s*\/?>)?\s*<\/p>)$/i.test(rawHtml)) {
                editor.innerHTML = '';
                rawHtml = '';
            }
            textarea.value = rawHtml;
            var len = (editor.innerText || '').replace(/\u00a0/g, ' ').replace(/\s+$/g, '').length;
            counter.textContent = len + ' / ' + RICH_TEXT_MAX_CHARS;
            counter.classList.toggle('over-limit', len > RICH_TEXT_MAX_CHARS);
        }
        function syncDebounced() {
            if (syncTimer) return;
            syncTimer = requestAnimationFrame(function() { syncTimer = null; sync(); });
        }

        var btnByCmd = {};
        TOOLBAR_ITEMS.forEach(function(item) {
            if (item.sep) {
                var sep = document.createElement('span');
                sep.className = 'rich-text-sep';
                toolbar.appendChild(sep);
                return;
            }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rich-text-btn';
            btn.title = item.title;
            btn.setAttribute('aria-label', item.title);
            btn.innerHTML = richTextSvg(item.icon);
            btn.addEventListener('mousedown', function(e) { e.preventDefault(); }); // 防止失焦
            btn.addEventListener('click', function() {
                editor.focus();
                if (item.cmd === '__code') richTextWrapInlineCode(editor);
                else if (item.cmd === '__link') richTextInsertLink(editor);
                else document.execCommand(item.cmd, false, item.arg || null);
                sync();
                updateActiveStates();
            });
            toolbar.appendChild(btn);
            if (item.state) btnByCmd[item.state] = btn;
        });

        function updateActiveStates() {
            if (!editor.contains(document.activeElement) && document.activeElement !== editor) return;
            Object.keys(btnByCmd).forEach(function(cmd) {
                var on = false;
                try { on = document.queryCommandState(cmd); } catch (e) {}
                btnByCmd[cmd].classList.toggle('is-active', !!on);
            });
        }

        // 输入：清洗粘贴 + 同步
        editor.addEventListener('input', syncDebounced);
        editor.addEventListener('blur', sync);
        editor.addEventListener('keyup', updateActiveStates);
        editor.addEventListener('mouseup', updateActiveStates);

        // 快捷键
        editor.addEventListener('keydown', function(e) {
            if (!(e.ctrlKey || e.metaKey)) return;
            var key = (e.key || '').toLowerCase();
            if (key === 'b' || key === 'i' || key === 'u') {
                // 浏览器原生处理；事件后再同步
                setTimeout(function() { sync(); updateActiveStates(); }, 0);
                return;
            }
            if (key === 'k') {
                e.preventDefault();
                richTextInsertLink(editor);
                sync();
                return;
            }
            if (key === 'z') {
                // 浏览器原生处理；事件后再同步
                setTimeout(function() { sync(); updateActiveStates(); }, 0);
            }
        });

        // 粘贴清洗：保留允许标签 + 链接
        editor.addEventListener('paste', function(e) {
            if (!e.clipboardData) return;
            e.preventDefault();
            var html = e.clipboardData.getData('text/html');
            var text = e.clipboardData.getData('text/plain');
            var insert;
            if (html) {
                insert = richTextSanitizeFragment(html);
            } else {
                // 纯文本：转义 + 换行
                insert = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
            }
            document.execCommand('insertHTML', false, insert);
            sync();
        });

        // 拖拽进文件 → 阻止默认（避免直接渲染图片 dataURL 导致体积爆炸；附件请用上传按钮）
        editor.addEventListener('drop', function(e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                e.preventDefault();
                if (window.showToast) window.showToast('请使用下方"添加附件"按钮上传文件', 'info');
            }
        });

        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(wrap, textarea);
        wrap.appendChild(toolbar);
        wrap.appendChild(editor);
        wrap.appendChild(status);
        wrap.appendChild(textarea);

        sync();

        var form = textarea.closest('form');
        if (form && form.dataset.richSubmitBound !== '1') {
            form.dataset.richSubmitBound = '1';
            form.addEventListener('submit', function() {
                syncRichTextEditors(form);
            }, true);
        }
    });
}
