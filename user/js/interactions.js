function initUserPageInteractions(root) {
    root = root || document;
    initRichTextEditors(root);

    var avatarInput = root.querySelector('#avatarInput');
    var avatarPreview = root.querySelector('#avatarPreview');
    if (avatarInput && avatarPreview && avatarInput.dataset.previewBound !== '1') {
        avatarInput.dataset.previewBound = '1';
        avatarInput.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showToast('头像文件不能超过 2MB', 'error');
                this.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function(e) {
                avatarPreview.innerHTML = '<img src="' + e.target.result + '" alt="预览" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;">';
            };
            reader.readAsDataURL(file);
        });
    }

    var profileForm = root.querySelector('.profile-form[data-ajax="profile"]');
    if (profileForm) ajaxForm(profileForm, 'api/index.php?action=profile', {
        onSuccess: function(res) {
            if (res.avatar_url) {
                document.querySelectorAll('#avatarImg, .welcome-avatar img').forEach(function(img) {
                    img.src = res.avatar_url;
                });
            }
        }
    });

    var securityForm = root.querySelector('.profile-form[data-ajax="security"]');
    if (securityForm) ajaxForm(securityForm, 'api/index.php?action=security');

    var accountDeleteForm = root.querySelector('.account-delete-form[data-ajax="account-delete"]');
    if (accountDeleteForm) bindDeleteAccountForm(accountDeleteForm);

    var appForm = root.querySelector('.profile-form[data-ajax="application"]');
    if (appForm) ajaxForm(appForm, 'api/index.php?action=apply');

    var ticketCreateForm = root.querySelector('.profile-form[data-ajax="ticket-create"]');
    if (ticketCreateForm) ajaxForm(ticketCreateForm, 'api/index.php?action=ticket_create', {
        onSuccess: function() { loadUserTickets(true, 1); refreshTicketBadge(); }
    });

    root.querySelectorAll('.profile-form[data-ajax="ticket-reply"]').forEach(function(ticketReplyForm) {
        ajaxForm(ticketReplyForm, 'api/index.php?action=ticket_reply', {
            onSuccess: function() { loadUserTickets(true); refreshTicketBadge(); }
        });
    });
    // 工单附件 file input 的"已选数量"提示（含服务端首次渲染的表单）
    if (typeof bindTicketAttachInputs === 'function') bindTicketAttachInputs(root);

    var loginForm = root.querySelector('.auth-form[data-ajax="login"]');
    if (loginForm) ajaxForm(loginForm, 'api/index.php?action=login', {
        onError: function(res) {
            // 当后端要求刷新（如需要新增验证码、CSRF 失效）时刷新页面
            if (res && res.reload) {
                setTimeout(function() { location.reload(); }, 800);
            }
        }
    });

    var regForm = root.querySelector('.auth-form[data-ajax="register"]');
    if (regForm) {
        bindRegisterEmailCode(regForm);
        ajaxForm(regForm, 'api/index.php?action=register');
    }

    var resetForm = root.querySelector('.auth-form[data-ajax="reset-password"]');
    if (resetForm) {
        bindResetEmailCode(resetForm);
        ajaxForm(resetForm, 'api/index.php?action=reset_password');
    }

    var notifItems = root.querySelectorAll('.notification-item');
    notifItems.forEach(function(item) {
        if (item.dataset.clickBound === '1') return;
        item.dataset.clickBound = '1';
        item.addEventListener('click', function() {
            var wasExpanded = this.classList.contains('expanded');
            this.classList.toggle('expanded');

            if (!wasExpanded && this.classList.contains('unread')) {
                var notifId = this.getAttribute('data-id');
                if (notifId) {
                    var csrf = getUserCsrf();
                    fetch('api/index.php?action=notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'notif_action=mark_read&id=' + encodeURIComponent(notifId) + '&csrf=' + encodeURIComponent(csrf)
                    }).then(function(r) { return r.json(); })
                      .then(function(res) {
                          if (res.status === 'success') {
                              item.classList.remove('unread');
                              var badge = document.getElementById('navBadge-notifications');
                              if (badge) {
                                  var count = parseInt(badge.textContent, 10) - 1;
                                  if (count <= 0) badge.style.display = 'none';
                                  else badge.textContent = count;
                              }
                          }
                      }).catch(function() {});
                }
            }
        });
    });

    bindNotificationLoadMore(root);

    initScrollReveal();
}

function bindNotificationLoadMore(root) {
    var btn = root.querySelector('#notificationLoadMore');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function() {
        var list = document.getElementById('notificationList');
        if (!list) return;
        var page = parseInt(list.dataset.page || '1', 10) + 1;
        btn.disabled = true;
        btn.textContent = '加载中...';
        fetch('api/index.php?action=notifications&notif_action=list&page=' + page, { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.status !== 'success') {
                    btn.disabled = false;
                    btn.textContent = '加载失败，点击重试';
                    return;
                }
                var typeMap = {
                    'system':      ['系统通知', 'type-system'],
                    'application': ['申请相关', 'type-application'],
                    'review':      ['审核结果', 'type-review']
                };
                var html = '';
                (res.data || []).forEach(function(n) {
                    var t = typeMap[n.type] || ['通知', 'type-system'];
                    var unread = !parseInt(n.is_read, 10);
                    var content = (n.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
                    var title = (n.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    html += '<div class="notification-item' + (unread ? ' unread' : '') + '" data-id="' + parseInt(n.id, 10) + '">';
                    html +=   '<div class="notification-header"><div style="display:flex;align-items:center;gap:8px;">';
                    html +=     '<span class="notification-type ' + t[1] + '">' + t[0] + '</span>';
                    html +=     '<span class="notification-title">' + title + '</span></div>';
                    html +=     '<span class="notification-time">' + (n.created_at || '') + '</span></div>';
                    html +=   '<div class="notification-body">' + content + '</div></div>';
                });
                list.insertAdjacentHTML('beforeend', html);
                list.dataset.page = String(page);
                list.dataset.hasMore = res.has_more ? '1' : '0';
                if (res.has_more) {
                    btn.disabled = false;
                    btn.textContent = '加载更多通知（共 ' + (res.total || 0) + ' 条）';
                } else {
                    var wrap = btn.parentElement;
                    if (wrap) wrap.outerHTML = '<p class="notification-loadmore-end">已显示全部 ' + (res.total || 0) + ' 条通知</p>';
                }
                // 重新绑定新加载条目的点击事件
                initUserPageInteractions(list);
            })
            .catch(function() {
                btn.disabled = false;
                btn.textContent = '加载失败，点击重试';
            });
    });
}

function renderSoftLoading(label, count) {
    count = count || 3;
    var html = '<div class="soft-loading" aria-label="' + escHtml(label || 'Loading') + '">';
    for (var i = 0; i < count; i++) {
        html += '<div class="soft-loading-card">';
        html += '<span class="soft-loading-line short"></span>';
        html += '<span class="soft-loading-line long"></span>';
        html += '<span class="soft-loading-line medium"></span>';
        html += '</div>';
    }
    html += '</div>';
    return html;
}

function renderNotificationList(res) {
    var wrap = document.getElementById('userNotificationsWrap');
    if (!wrap) return;
    var items = res.data || [];
    if (!items.length) {
        wrap.innerHTML = '<div class="empty-state fade-up"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><p>暂无通知</p></div>';
        initUserPageInteractions(wrap);
        return;
    }
    var typeMap = {
        'system':      ['系统通知', 'type-system'],
        'application': ['申请相关', 'type-application'],
        'review':      ['审核结果', 'type-review']
    };
    var html = '<div class="notification-list fade-up" id="notificationList" data-page="' + (res.page || 1) + '" data-has-more="' + (res.has_more ? '1' : '0') + '">';
    items.forEach(function(n) {
        var t = typeMap[n.type] || ['通知', 'type-system'];
        var unread = !parseInt(n.is_read, 10);
        var content = escHtml(n.content || '').replace(/\n/g, '<br>');
        html += '<div class="notification-item' + (unread ? ' unread' : '') + '" data-id="' + parseInt(n.id, 10) + '">';
        html +=   '<div class="notification-header"><div style="display:flex;align-items:center;gap:8px;">';
        html +=     '<span class="notification-type ' + t[1] + '">' + t[0] + '</span>';
        html +=     '<span class="notification-title">' + escHtml(n.title || '') + '</span></div>';
        html +=     '<span class="notification-time">' + escHtml(n.created_at || '') + '</span></div>';
        html +=   '<div class="notification-body">' + content + '</div></div>';
    });
    html += '</div>';
    if (res.has_more) {
        html += '<div class="notification-loadmore-wrap fade-up"><button type="button" id="notificationLoadMore" class="btn-outline">加载更多通知（共 ' + (parseInt(res.total, 10) || 0) + ' 条）</button></div>';
    } else {
        html += '<p class="notification-loadmore-end fade-up">已显示全部 ' + (parseInt(res.total, 10) || 0) + ' 条通知</p>';
    }
    wrap.innerHTML = html;
    initUserPageInteractions(wrap);
}

function ensureUserNotificationsLoaded(force) {
    var wrap = document.getElementById('userNotificationsWrap');
    if (!wrap || (wrap.dataset.loaded === '1' && !force)) return;
    if (!force && wrap.querySelector('#notificationList')) {
        wrap.dataset.loaded = '1';
        return;
    }
    wrap.dataset.loaded = '1';
    if (!wrap.querySelector('#notificationList')) {
        wrap.innerHTML = renderSoftLoading('Loading notifications', 3);
    }
    fetch('api/index.php?action=notifications&notif_action=list&page=1', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.status !== 'success') {
                wrap.dataset.loaded = '';
                wrap.innerHTML = '<div class="empty-state fade-up"><p>通知加载失败</p></div>';
                return;
            }
            renderNotificationList(res);
        })
        .catch(function() {
            wrap.dataset.loaded = '';
            wrap.innerHTML = '<div class="empty-state fade-up"><p>通知加载失败</p></div>';
        });
}

function renderUserAnnouncements(items) {
    var list = document.getElementById('userAnnouncementsList');
    if (!list) return;
    items = items || [];
    if (!items.length) {
        list.innerHTML = '<div class="empty-state">暂无公告</div>';
        return;
    }
    var levelLabels = { info: '公告', success: '活动', warning: '维护', danger: '紧急' };
    var html = '<div class="announcement-list">';
    items.forEach(function(notice) {
        var level = notice.level || 'info';
        html += '<article class="announcement-card announcement-' + escHtml(level) + '">';
        html += '<div class="announcement-head"><div><h3>' + escHtml(notice.title || '') + '</h3><p>' + escHtml(notice.publish_at || notice.created_at || '') + '</p></div>';
        html += '<span>' + escHtml(levelLabels[level] || '公告') + '</span></div>';
        html += '<div class="announcement-content">' + escHtml(notice.content || '').replace(/\n/g, '<br>') + '</div>';
        html += '</article>';
    });
    list.innerHTML = html + '</div>';
}

function ensureUserAnnouncementsLoaded(force) {
    var list = document.getElementById('userAnnouncementsList');
    if (!list || (list.dataset.loaded === '1' && !force)) return;
    if (!force && list.querySelector('.announcement-list')) {
        list.dataset.loaded = '1';
        return;
    }
    list.dataset.loaded = '1';
    if (!list.querySelector('.announcement-list')) {
        list.innerHTML = renderSoftLoading('Loading announcements', 2);
    }
    fetch('api/index.php?action=announcements', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.status !== 'success') {
                list.dataset.loaded = '';
                list.innerHTML = '<div class="empty-state">公告加载失败</div>';
                return;
            }
            renderUserAnnouncements(res.items || []);
        })
        .catch(function() {
            list.dataset.loaded = '';
            list.innerHTML = '<div class="empty-state">公告加载失败</div>';
        });
}
