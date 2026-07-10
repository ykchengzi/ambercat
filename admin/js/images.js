/* ==================== 图片管理模块 ==================== */
(function () {
    'use strict';

    var _allImages   = [];
    var _dirLabels   = {};
    var _selected    = new Set();
    var _orphanPaths = new Set();
    var _filterDir   = '';
    var _filterQ     = '';
    var _showOrphans = false;
    var _initialized = false;
    var _csrf        = '';

    /* -------- 入口 -------- */
    window.initImageManager = function () {
        if (_initialized) { refreshImageList(); return; }
        _initialized = true;
        _csrf = (typeof window.adminCsrf !== 'undefined') ? window.adminCsrf : '';

        var tab = document.getElementById('tab-images');
        if (!tab) return;

        _bindToolbar();
        refreshImageList();
    };

    /* -------- 绑定工具栏事件 -------- */
    function _bindToolbar() {
        var dirSel   = document.getElementById('imgDirFilter');
        var searchEl = document.getElementById('imgSearch');
        var orphanBtn= document.getElementById('imgOrphanBtn');
        var delBtn   = document.getElementById('imgBatchDelete');
        var selAllBtn= document.getElementById('imgSelectAll');
        var uploadBtn= document.getElementById('imgUploadBtn');
        var uploadInput = document.getElementById('imgUploadInput');
        var uploadDir= document.getElementById('imgUploadDir');

        if (dirSel)    dirSel.addEventListener('change',   function () { _filterDir = this.value; _render(); });
        if (searchEl)  searchEl.addEventListener('input',   function () { _filterQ = this.value.trim().toLowerCase(); _render(); });
        if (orphanBtn) orphanBtn.addEventListener('click',  _toggleOrphanFilter);
        if (delBtn)    delBtn.addEventListener('click',     _batchDelete);
        if (selAllBtn) selAllBtn.addEventListener('click',  _toggleSelectAll);
        if (uploadBtn) uploadBtn.addEventListener('click',  function () { if (uploadInput) uploadInput.click(); });
        if (uploadInput) uploadInput.addEventListener('change', function () { _doUpload(this, uploadDir); });

        /* 拖拽上传 */
        var dropzone = document.getElementById('imgDropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover',  function (e) { e.preventDefault(); dropzone.classList.add('drag-over'); });
            dropzone.addEventListener('dragleave', function ()  { dropzone.classList.remove('drag-over'); });
            dropzone.addEventListener('drop',      function (e) {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                var files = e.dataTransfer.files;
                if (files.length) _doUpload({ files: files }, uploadDir);
            });
            dropzone.addEventListener('click', function () { if (uploadInput) uploadInput.click(); });
        }
    }

    /* -------- 拉取图片列表 -------- */
    function refreshImageList() {
        var grid = document.getElementById('imgGrid');
        if (grid) grid.innerHTML = '<div class="img-loading"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg> 正在扫描图片…</div>';

        fetch('api.php?act=images&op=list', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.code !== 200) { _showError(res.message || '加载失败'); return; }
                _allImages   = res.data || [];
                _dirLabels   = {};
                var dirs = res.dirs || {};
                Object.keys(dirs).forEach(function (k) { _dirLabels[k] = dirs[k].label; });

                _orphanPaths.clear();
                _allImages.forEach(function (img) { if (img.orphan) _orphanPaths.add(img.path); });

                _selected.clear();
                _updateDirSelect();
                _updateStats();
                _render();
            })
            .catch(function (e) { _showError('网络错误: ' + e.message); });
    }

    /* -------- 更新目录筛选下拉框 -------- */
    function _updateDirSelect() {
        var sel = document.getElementById('imgDirFilter');
        if (!sel) return;
        var current = sel.value;
        sel.innerHTML = '<option value="">全部目录</option>';
        var seen = {};
        _allImages.forEach(function (img) {
            if (!seen[img.dir_key]) {
                seen[img.dir_key] = true;
                var opt = document.createElement('option');
                opt.value = img.dir_key;
                opt.textContent = img.dir_label || img.dir_key;
                sel.appendChild(opt);
            }
        });
        if (current) sel.value = current;
    }

    /* -------- 更新统计栏 -------- */
    function _updateStats() {
        var total    = _allImages.length;
        var orphans  = _orphanPaths.size;
        var totalSz  = _allImages.reduce(function (s, i) { return s + (i.size || 0); }, 0);
        var statsEl  = document.getElementById('imgStats');
        if (statsEl) {
            statsEl.textContent = '共 ' + total + ' 张 · ' + _fmtSize(totalSz) + (orphans > 0 ? ' · ⚠ ' + orphans + ' 张孤儿' : '');
        }
        var orphanBtn = document.getElementById('imgOrphanBtn');
        if (orphanBtn) {
            var badge = orphanBtn.querySelector('.orphan-count');
            if (badge) badge.textContent = orphans > 0 ? orphans : '';
            orphanBtn.classList.toggle('has-orphans', orphans > 0);
        }
    }

    /* -------- 渲染网格 -------- */
    function _render() {
        var grid = document.getElementById('imgGrid');
        if (!grid) return;

        var filtered = _allImages.filter(function (img) {
            if (_filterDir && img.dir_key !== _filterDir) return false;
            if (_showOrphans && !img.orphan) return false;
            if (_filterQ && img.name.toLowerCase().indexOf(_filterQ) === -1 &&
                img.path.toLowerCase().indexOf(_filterQ) === -1) return false;
            return true;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="img-empty">没有符合条件的图片</div>';
            _updateSelectionBar();
            return;
        }

        var html = '';
        filtered.forEach(function (img) {
            var isOrphan  = img.orphan;
            var isSel     = _selected.has(img.path);
            var sizeStr   = _fmtSize(img.size);
            var dimStr    = img.w && img.h ? img.w + '×' + img.h : '';
            var timeStr   = img.mtime ? new Date(img.mtime * 1000).toLocaleDateString('zh-CN') : '';
            var urlRoot   = '../';
            var imgSrc    = urlRoot + _escHtml(img.path);

            html += '<div class="img-card' + (isOrphan ? ' orphan' : '') + (isSel ? ' selected' : '') + '" data-path="' + _escAttr(img.path) + '">';
            html += '<div class="img-card__check"><input type="checkbox" class="img-cb" data-path="' + _escAttr(img.path) + '"' + (isSel ? ' checked' : '') + '></div>';
            if (isOrphan) {
                html += '<div class="img-card__orphan-badge" title="孤儿图片：未被任何内容引用">孤儿</div>';
            }
            html += '<div class="img-card__thumb" onclick="imgPreview(' + JSON.stringify(img.path) + ')">';
            html += '<img loading="lazy" src="' + imgSrc + '" alt="' + _escAttr(img.name) + '" onerror="this.parentNode.classList.add(\'img-error\')">';
            html += '</div>';
            html += '<div class="img-card__info">';
            html += '<div class="img-card__name" title="' + _escAttr(img.path) + '">' + _escHtml(img.name) + '</div>';
            html += '<div class="img-card__meta">';
            if (dimStr) html += '<span>' + dimStr + '</span>';
            html += '<span>' + sizeStr + '</span>';
            if (timeStr) html += '<span>' + timeStr + '</span>';
            html += '</div>';
            html += '<div class="img-card__dir">' + _escHtml(img.dir_label || img.dir_key) + '</div>';
            html += '</div>';
            html += '<div class="img-card__actions">';
            html += '<button class="img-action-btn" onclick="imgCopyUrl(' + JSON.stringify(img.path) + ')" title="复制URL"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
            html += '<button class="img-action-btn danger" onclick="imgDeleteOne(' + JSON.stringify(img.path) + ')" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
            html += '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;

        /* 绑定 checkbox */
        grid.querySelectorAll('.img-cb').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var p = this.dataset.path;
                if (this.checked) _selected.add(p); else _selected.delete(p);
                var card = this.closest('.img-card');
                if (card) card.classList.toggle('selected', this.checked);
                _updateSelectionBar();
            });
        });

        _updateSelectionBar();
    }

    /* -------- 选择操作 -------- */
    function _toggleSelectAll() {
        var cards = document.querySelectorAll('#imgGrid .img-card');
        var allChecked = cards.length > 0 && Array.from(cards).every(function (c) {
            return _selected.has(c.dataset.path);
        });
        cards.forEach(function (card) {
            var p  = card.dataset.path;
            var cb = card.querySelector('.img-cb');
            if (allChecked) {
                _selected.delete(p);
                card.classList.remove('selected');
                if (cb) cb.checked = false;
            } else {
                _selected.add(p);
                card.classList.add('selected');
                if (cb) cb.checked = true;
            }
        });
        _updateSelectionBar();
    }

    window.imgClearSelection = function () {
        _selected.clear();
        document.querySelectorAll('#imgGrid .img-cb').forEach(function (c) { c.checked = false; });
        document.querySelectorAll('#imgGrid .img-card').forEach(function (c) { c.classList.remove('selected'); });
        _updateSelectionBar();
    };

    function _updateSelectionBar() {
        var bar    = document.getElementById('imgSelBar');
        var countEl= document.getElementById('imgSelCount');
        var delBtn = document.getElementById('imgBatchDelete');
        var n      = _selected.size;
        if (bar)    bar.classList.toggle('visible', n > 0);
        if (countEl) countEl.textContent = '已选 ' + n + ' 张';
        if (delBtn)  delBtn.disabled = n === 0;
        var selAllBtn = document.getElementById('imgSelectAll');
        if (selAllBtn) {
            var cards = document.querySelectorAll('#imgGrid .img-card');
            var allSel = cards.length > 0 && Array.from(cards).every(function (c) { return _selected.has(c.dataset.path); });
            selAllBtn.textContent = allSel ? '取消全选' : '全选当前页';
        }
    }

    /* -------- 孤儿筛选 -------- */
    function _toggleOrphanFilter() {
        _showOrphans = !_showOrphans;
        var btn = document.getElementById('imgOrphanBtn');
        if (btn) btn.classList.toggle('active', _showOrphans);
        var label = document.getElementById('imgOrphanFilterLabel');
        if (label) label.textContent = _showOrphans ? '显示全部' : '只看孤儿';
        _render();
    }

    /* -------- 删除 -------- */
    window.imgDeleteOne = function (path) {
        if (!confirm('确认删除图片：' + path + '？\n\n此操作不可撤销。')) return;
        _doDelete([path]);
    };

    function _batchDelete() {
        if (_selected.size === 0) return;
        var orphanCount = 0;
        _selected.forEach(function (p) { if (_orphanPaths.has(p)) orphanCount++; });
        var msg = '确认删除选中的 ' + _selected.size + ' 张图片？\n';
        if (orphanCount > 0) msg += '（其中 ' + orphanCount + ' 张为孤儿图片）\n';
        msg += '\n此操作不可撤销。';
        if (!confirm(msg)) return;
        _doDelete(Array.from(_selected));
    }

    function _doDelete(paths) {
        var csrf = _csrf || (typeof window.adminCsrf !== 'undefined' ? window.adminCsrf : '');
        fetch('api.php?act=images&op=delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: csrf, paths: paths })
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.code === 200 || res.code === 207) {
                var ok   = paths.filter(function (p) { return res.results && res.results[p] && res.results[p].ok; });
                var fail = paths.filter(function (p) { return !res.results || !res.results[p] || !res.results[p].ok; });
                ok.forEach(function (p) {
                    _allImages = _allImages.filter(function (i) { return i.path !== p; });
                    _selected.delete(p);
                    _orphanPaths.delete(p);
                });
                _updateStats();
                _render();
                if (fail.length > 0) {
                    alert('部分删除失败：\n' + fail.map(function (p) {
                        return p + '：' + (res.results[p] ? res.results[p].message : '未知错误');
                    }).join('\n'));
                } else if (typeof window.showToast === 'function') {
                    window.showToast('已删除 ' + ok.length + ' 张图片', 'success');
                }
            } else {
                alert('删除失败：' + (res.message || '未知错误'));
            }
        })
        .catch(function (e) { alert('网络错误：' + e.message); });
    }

    /* -------- 上传 -------- */
    function _doUpload(inputEl, dirSelect) {
        var files   = inputEl.files;
        var dirKey  = dirSelect ? dirSelect.value : 'admin_uploads';
        var csrf    = _csrf || (typeof window.adminCsrf !== 'undefined' ? window.adminCsrf : '');

        if (!files || files.length === 0) return;

        var pending = files.length;
        var successes = 0;

        Array.from(files).forEach(function (file) {
            var fd = new FormData();
            fd.append('csrf',    csrf);
            fd.append('dir_key', dirKey);
            fd.append('image',   file);

            fetch('api.php?act=images&op=upload', {
                method: 'POST',
                credentials: 'same-origin',
                body: fd
            })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                pending--;
                if (res.code === 200) {
                    successes++;
                } else {
                    alert('上传失败：' + (res.message || '未知错误'));
                }
                if (pending === 0) {
                    if (successes > 0) {
                        if (typeof window.showToast === 'function') {
                            window.showToast('已上传 ' + successes + ' 张图片', 'success');
                        }
                        refreshImageList();
                    }
                    if (inputEl.value !== undefined) inputEl.value = '';
                }
            })
            .catch(function (e) {
                pending--;
                alert('网络错误：' + e.message);
            });
        });
    }

    /* -------- 预览 Lightbox -------- */
    window.imgPreview = function (path) {
        var lb = document.getElementById('imgLightbox');
        if (!lb) return;
        var img  = lb.querySelector('.img-lb-img');
        var info = lb.querySelector('.img-lb-info');
        var urlEl= lb.querySelector('.img-lb-url');

        if (img)   img.src = '../' + path;
        if (urlEl) urlEl.textContent = path;

        var meta = _allImages.find(function (i) { return i.path === path; });
        if (meta && info) {
            var parts = [];
            if (meta.w && meta.h) parts.push(meta.w + '×' + meta.h + 'px');
            parts.push(_fmtSize(meta.size));
            if (meta.mtime) parts.push(new Date(meta.mtime * 1000).toLocaleString('zh-CN'));
            if (meta.orphan) parts.push('⚠ 孤儿图片');
            info.textContent = parts.join(' · ');
        }

        var copyBtn = lb.querySelector('.img-lb-copy');
        if (copyBtn) copyBtn.onclick = function () { imgCopyUrl(path); };
        var delBtn  = lb.querySelector('.img-lb-delete');
        if (delBtn) delBtn.onclick = function () {
            imgCloseLightbox();
            window.imgDeleteOne(path);
        };

        lb.style.display = 'flex';
        document.addEventListener('keydown', _lbKeydown);
    };

    window.imgCloseLightbox = function () {
        var lb = document.getElementById('imgLightbox');
        if (lb) lb.style.display = 'none';
        var img = lb && lb.querySelector('.img-lb-img');
        if (img) img.src = '';
        document.removeEventListener('keydown', _lbKeydown);
    };

    function _lbKeydown(e) {
        if (e.key === 'Escape') imgCloseLightbox();
    }

    /* -------- 复制 URL -------- */
    window.imgCopyUrl = function (path) {
        var url = window.location.origin + '/' + path;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                if (typeof window.showToast === 'function') window.showToast('已复制：' + url, 'success');
                else alert('已复制：' + url);
            });
        } else {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (typeof window.showToast === 'function') window.showToast('已复制', 'success');
        }
    };

    /* -------- 工具函数 -------- */
    function _fmtSize(bytes) {
        if (!bytes) return '0B';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1048576).toFixed(1) + 'MB';
    }

    function _escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _escAttr(s) {
        return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function _showError(msg) {
        var grid = document.getElementById('imgGrid');
        if (grid) grid.innerHTML = '<div class="img-empty img-error-msg">' + _escHtml(msg) + '</div>';
    }

    /* -------- 监听 switchTab 激活 -------- */
    var _origSwitch = window.switchTab;
    window.switchTab = function (tabKey) {
        if (typeof _origSwitch === 'function') _origSwitch(tabKey);
        if (tabKey === 'images') window.initImageManager();
    };

    /* -------- 初次页面加载：若 tab-images 已可见则直接初始化 -------- */
    var _tabEl = document.getElementById('tab-images');
    if (_tabEl && _tabEl.style.display !== 'none' && _tabEl.dataset.lazy !== '1') {
        setTimeout(window.initImageManager, 100);
    }
})();
