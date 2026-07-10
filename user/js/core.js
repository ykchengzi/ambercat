// ====================================================
// 用户中心前端交互 — AJAX + 滚动渐入动画
// ====================================================

// --- 侧边栏切换（移动端） ---
function userPrefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setUserSidebarOpen(open) {
    var sb = document.getElementById('userSidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.toggle('open', open);
    if (ov) ov.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', !!open);
}

function toggleSidebar() {
    var sb = document.getElementById('userSidebar');
    setUserSidebarOpen(!(sb && sb.classList.contains('open')));
}
function closeSidebar() {
    setUserSidebarOpen(false);
}

function showUserTabPane(target) {
    if (!target) return;
    document.querySelectorAll('.user-tab-pane').forEach(function(pane) {
        if (pane !== target) pane.style.display = 'none';
    });
    target.style.display = 'block';
    if (userPrefersReducedMotion()) {
        target.style.opacity = '';
        target.style.transform = '';
        target.style.transition = '';
    } else {
        target.style.transition = 'none';
        target.style.opacity = '0';
        target.style.transform = 'translateY(8px)';
        requestAnimationFrame(function() {
            target.style.transition = 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
            target.style.opacity = '1';
            target.style.transform = 'translateY(0)';
            // 动画结束后清除 inline transform，否则 transform:translateY(0) 会
            // 为 position:fixed 子元素创建 containing block，导致弹窗定位错误
            function onTransitionDone(e) {
                if (e.target !== target || e.propertyName !== 'transform') return;
                target.style.transform = '';
                target.style.transition = '';
                target.style.opacity = '';
                target.removeEventListener('transitionend', onTransitionDone);
            }
            target.addEventListener('transitionend', onTransitionDone);
        });
    }
    target.querySelectorAll('.fade-up').forEach(function(el) {
        el.classList.add('revealed');
        el.style.transitionDelay = '0s';
    });
}

window.switchUserTab = function(tabKey) {
    var target = document.getElementById('tab-' + tabKey);
    if (!target) return;

    showUserTabPane(target);

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    var nav = document.getElementById('nav-' + tabKey);
    if (nav) nav.classList.add('active');

    var title = document.getElementById('user-page-title');
    if (title && window.userTabLabels && window.userTabLabels[tabKey]) {
        title.textContent = window.userTabLabels[tabKey];
    }

    if (window.history && window.history.pushState) {
        var url = new URL(window.location.href);
        if (tabKey === 'panel') url.searchParams.delete('tab');
        else url.searchParams.set('tab', tabKey);
        window.history.pushState({ userTab: tabKey }, '', url);
    }

    closeSidebar();
    initUserPageInteractions(target);
    if (tabKey === 'tickets') {
        loadUserTickets(true);
        startUserTicketsPolling();
    } else {
        stopUserTicketsPolling();
    }
    if (tabKey === 'notifications' && typeof ensureUserNotificationsLoaded === 'function') {
        ensureUserNotificationsLoaded();
    }
    if (tabKey === 'announcements' && typeof ensureUserAnnouncementsLoaded === 'function') {
        ensureUserAnnouncementsLoaded();
    }
    // 即时回到顶部，避免 smooth 滚动阻塞视觉反馈
    window.scrollTo(0, 0);
};

window.showUserTabPane = showUserTabPane;

// ==================== Toast 通知 ====================
var _toastContainer;
function showToast(msg, type) {
    type = type || 'info';
    if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'toast-container';
        document.body.appendChild(_toastContainer);
    }
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    var icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    t.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-msg">' + escHtml(msg) + '</span>';
    _toastContainer.appendChild(t);
    requestAnimationFrame(function() { t.classList.add('show'); });
    setTimeout(function() {
        t.classList.remove('show');
        t.classList.add('hide');
        setTimeout(function() { t.remove(); }, 350);
    }, 3500);
}

function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function updateTicketBadge(count) {
    var badge = document.getElementById('navBadge-tickets');
    if (!badge) return;
    count = parseInt(count, 10) || 0;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = '';
    } else {
        badge.textContent = '';
        badge.style.display = 'none';
    }
}

function getUserCsrf(root) {
    root = root || document;
    var input = root.querySelector('input[name="csrf"]') || document.querySelector('input[name="csrf"]');
    return input ? input.value : (window.userCsrf || '');
}

// ==================== 按钮加载状态 ====================
function setBtnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.dataset.origText = btn.textContent;
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.innerHTML = '<span class="btn-spinner"></span>' + btn.dataset.origText;
    } else {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.textContent = btn.dataset.origText || btn.textContent;
    }
}

// ==================== AJAX 表单提交 ====================
function ajaxForm(form, apiUrl, opts) {
    opts = opts || {};
    if (form.dataset.ajaxBound === '1') return;
    form.dataset.ajaxBound = '1';
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (document.body.classList.contains('is-banned') && form.closest('.user-page')) {
            showToast('你的账号已被封禁，无法执行该操作', 'error');
            return;
        }
        var btn = form.querySelector('button[type="submit"], .auth-btn');
        if (btn && btn.disabled) return;
        setBtnLoading(btn, true);

        // 清除页面上旧的错误/成功提示
        form.closest('.user-container, .auth-card')?.querySelectorAll('.auth-errors, .auth-success').forEach(function(el) {
            el.style.transition = 'opacity .2s';
            el.style.opacity = '0';
            setTimeout(function() { el.remove(); }, 200);
        });

        syncRichTextEditors(form);
        var fd = new FormData(form);
        fetch(apiUrl, { method: 'POST', body: fd })
            .then(function(r) {
                return r.text().then(function(text) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(text ? text.slice(0, 160) : 'empty response');
                    }
                });
            })
            .then(function(res) {
                setBtnLoading(btn, false);
                if (res.status === 'success') {
                    showToast(res.message, 'success');
                    if (res.reset) form.reset();
                    if (res.reload) {
                        setTimeout(function() { location.reload(); }, 800);
                    }
                    if (res.redirect) {
                        setTimeout(function() { location.href = res.redirect; }, 600);
                    }
                    if (opts.onSuccess) opts.onSuccess(res);
                } else {
                    showToast(res.message || '操作失败', 'error');
                    if (opts.onError) opts.onError(res);
                }
            })
            .catch(function(err) {
                setBtnLoading(btn, false);
                console.error('API 请求失败:', err);
                showToast('服务器返回异常，请稍后重试或联系管理员', 'error');
            });
    });
}

function syncRichTextEditors(root) {
    root = root || document;
    root.querySelectorAll('textarea.rich-text-source').forEach(function(source) {
        var area = source.parentNode ? source.parentNode.querySelector('.rich-text-area') : null;
        if (area) source.value = area.innerHTML.trim();
    });
}

// ==================== 图片灯箱（全局共享） ====================
// 用法 1：编程式 window.openImageLightbox(url)
// 用法 2：任意元素加 data-lightbox="<url>"，整页面会自动委托点击
var _imgLightboxEl = null, _imgLightboxImg = null, _imgLightboxBound = false;
function _ensureImageLightbox() {
    if (_imgLightboxEl) return;
    _imgLightboxEl = document.createElement('div');
    _imgLightboxEl.className = 'img-lightbox';
    _imgLightboxEl.innerHTML =
        '<img alt="预览图">' +
        '<button type="button" class="img-lightbox-close" aria-label="关闭">&times;</button>';
    _imgLightboxEl.addEventListener('click', function(e) {
        if (e.target === _imgLightboxEl || e.target.classList.contains('img-lightbox-close')) {
            closeImageLightbox();
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _imgLightboxEl && _imgLightboxEl.classList.contains('open')) {
            closeImageLightbox();
        }
    });
    document.body.appendChild(_imgLightboxEl);
    _imgLightboxImg = _imgLightboxEl.querySelector('img');
}
function openImageLightbox(src) {
    if (!src) return;
    _ensureImageLightbox();
    _imgLightboxImg.src = src;
    _imgLightboxEl.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeImageLightbox() {
    if (!_imgLightboxEl) return;
    _imgLightboxEl.classList.remove('open');
    _imgLightboxImg.src = '';
    document.body.style.overflow = '';
}
// 全文档委托：任何带 [data-lightbox] 的元素都自动触发；阻止默认（链接/按钮）跳转
function _bindImageLightboxDelegation() {
    if (_imgLightboxBound) return;
    _imgLightboxBound = true;
    document.addEventListener('click', function(e) {
        var trig = e.target && e.target.closest ? e.target.closest('[data-lightbox]') : null;
        if (!trig) return;
        var url = trig.getAttribute('data-lightbox');
        if (!url) return;
        e.preventDefault();
        openImageLightbox(url);
    });
}
_bindImageLightboxDelegation();
// 兼容旧调用名
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
