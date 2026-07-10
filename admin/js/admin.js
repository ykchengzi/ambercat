// ==================== 用户管理模块 ====================
(function() {
    var _usersPage = 1;
    var _appsPage = 1;
    var _usersSearchTimer = null;
    var _appsPollTimer = null;
    var _appsPollInterval = 15000;
    var _appsLastFp = '';
    var _ticketsPollTimer = null;
    var _ticketsPollInterval = 15000;
    var _ticketsLastFp = '';
    var _applicationsCache = [];
    var _selectedApplicationIds = {};
    var _ticketCollapsedState = {};
    var _csrfToken = '';

    // 获取 CSRF token（从页面表单提取）
    function getCsrf() {
        if (_csrfToken) return _csrfToken;
        var inp = document.querySelector('input[name="csrf"]');
        if (inp) _csrfToken = inp.value;
        return _csrfToken;
    }

    var statusLabels = { active: '正常', banned: '已封禁' };
    var statusColors = { active: '#16a34a', banned: '#dc2626' };
    var appStatusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝', need_more_info: '需补充' };
    var appStatusColors = { pending: '#ca8a04', approved: '#16a34a', rejected: '#dc2626', need_more_info: '#3b82f6' };

    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // 富文本编辑器实现已迁移至 admin/js/richtext.js（统一编辑器，支持 SVG 工具栏 / 粘贴清洗 / 字符计数 / 快捷键）
    // 此处保留闭包内别名，便于本文件内部直接调用 window 上挂载的全局方法。
    var initAdminRichTextEditors = function(root) { return window.initAdminRichTextEditors(root); };

    window.loadUsersList = function(page) {
        _usersPage = page || 1;
        var search = (document.getElementById('userSearchInput') || {}).value || '';
        var status = (document.getElementById('userStatusFilter') || {}).value || '';
        var url = 'user_actions.php?action=list_users&csrf=' + encodeURIComponent(getCsrf())
            + '&page=' + _usersPage
            + '&search=' + encodeURIComponent(search)
            + '&status=' + encodeURIComponent(status);

        fetch(url).then(function(r) { return r.json(); }).then(function(res) {
            if (res.status !== 'success') return;

            // 更新统计
            var s = res.stats || {};
            var el;
            el = document.getElementById('usersStatTotal'); if (el) el.textContent = s.total || 0;
            el = document.getElementById('usersStatPendingApps'); if (el) el.textContent = s.pending_apps || 0;
            el = document.getElementById('usersStatNew'); if (el) el.textContent = s.new_this_week || 0;
            el = document.getElementById('usersStatBanned'); if (el) el.textContent = s.banned || 0;

            // 渲染表格
            var tbody = document.getElementById('usersTableBody');
            if (!tbody) return;

            if (!res.users || res.users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8;">暂无用户数据</td></tr>';
            } else {
                var html = '';
                res.users.forEach(function(u) {
                    var sColor = statusColors[u.status] || '#94a3b8';
                    var sLabel = statusLabels[u.status] || u.status;
                    var asColor = appStatusColors[u.application_status] || '#94a3b8';
                    var asLabel = u.application_status ? (appStatusLabels[u.application_status] || u.application_status) : '未提交';
                    var pc = u.profile_completeness || {};
                    var pcScore = parseInt(pc.score || 0, 10);
                    var pcColor = pcScore >= 80 ? '#16a34a' : (pcScore >= 50 ? '#ca8a04' : '#dc2626');
                    var roleBadge = (u.role === 'staff')
                        ? ' <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:0.72em;font-weight:600;vertical-align:middle;">工作人员</span>'
                        : '';
                    html += '<tr style="border-bottom:1px solid #f1f5f9;">'
                        + '<td style="padding:10px 14px;">' + esc(u.username) + roleBadge + '</td>'
                        + '<td style="padding:10px 14px;">' + esc(u.mc_name) + '</td>'
                        + '<td style="padding:10px 14px;">' + esc(u.email) + '</td>'
                        + '<td style="padding:10px 14px;text-align:center;"><span style="color:' + sColor + ';font-weight:500;">' + sLabel + '</span></td>'
                        + '<td style="padding:10px 14px;text-align:center;"><span style="color:' + asColor + ';font-weight:500;">' + asLabel + '</span></td>'
                        + '<td style="padding:10px 14px;text-align:center;"><div style="min-width:92px;"><div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;"><span style="display:block;height:100%;width:' + pcScore + '%;background:' + pcColor + ';"></span></div><div style="margin-top:4px;color:' + pcColor + ';font-weight:700;font-size:.82em;">' + pcScore + '%</div></div></td>'
                        + '<td style="padding:10px 14px;text-align:center;font-size:0.85em;color:#64748b;">' + (u.created_at || '-').substring(0, 10) + '</td>'
                        + '<td style="padding:10px 14px;text-align:center;"><button onclick="openUserDetail(' + u.id + ')" style="background:#3b82f6;color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;">详情</button></td>'
                        + '</tr>';
                });
                tbody.innerHTML = html;
            }

            // 分页
            var pgEl = document.getElementById('usersPagination');
            if (pgEl) {
                if (res.pages <= 1) { pgEl.innerHTML = ''; return; }
                var pgHtml = '';
                for (var i = 1; i <= res.pages; i++) {
                    var active = i === res.page ? 'background:#3b82f6;color:#fff;' : 'background:#f1f5f9;color:#334155;';
                    pgHtml += '<button onclick="loadUsersList(' + i + ')" style="border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;' + active + '">' + i + '</button>';
                }
                pgEl.innerHTML = pgHtml;
            }
        }).catch(function(err) { console.error('用户列表加载失败', err); });
    };

    window.openUserDetail = function(userId) {
        var modal = document.getElementById('userDetailModal');
        var content = document.getElementById('userDetailContent');
        if (!modal || !content) return;
        content.innerHTML = '<p style="text-align:center;color:#94a3b8;">加载中...</p>';
        modal.style.display = 'block';

        var fd = new FormData();
        fd.append('action', 'get_user');
        fd.append('user_id', userId);
        fd.append('csrf', getCsrf());

        fetch('user_actions.php', { method: 'POST', body: fd })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.status !== 'success') { content.innerHTML = '<p style="color:#ef4444;">' + esc(res.message) + '</p>'; return; }
                renderUserDetail(res, content);
            })
            .catch(function() { content.innerHTML = '<p style="color:#ef4444;">加载失败</p>'; });
    };

    window.closeUserDetail = function() {
        var modal = document.getElementById('userDetailModal');
        if (modal) modal.style.display = 'none';
    };

    function renderUserDetail(res, container) {
        var u = res.user;
        var app = res.application;
        var sColor = statusColors[u.status] || '#94a3b8';
        var sLabel = statusLabels[u.status] || u.status;
        var pc = u.profile_completeness || {};
        var pcScore = parseInt(pc.score || 0, 10);
        var pcColor = pcScore >= 80 ? '#16a34a' : (pcScore >= 50 ? '#ca8a04' : '#f97316');
        var pcMissing = Array.isArray(pc.missing) ? pc.missing : [];

        var appLabel = app ? (appStatusLabels[app.status] || app.status) : '未提交';
        var appColor = app ? (appStatusColors[app.status] || '#94a3b8') : '#94a3b8';
        var html = '';

        html += '<div class="user-detail-grid">';
        html += '<aside class="user-detail-aside">';
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
        html += '<div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ecfdf5,#10b981);color:#047857;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.15em;border:1px solid #a7f3d0;">' + esc((u.username || '?').substring(0, 1).toUpperCase()) + '</div>';
        html += '<div><div style="font-weight:700;color:#0f172a;">' + esc(u.username) + '</div><div style="font-size:.84em;color:#64748b;">' + esc(u.email || '-') + '</div></div>';
        html += '</div>';
        html += '<div class="user-detail-aside-grid">';
        html += '<span style="color:#94a3b8;">游戏ID</span><span>' + esc(u.mc_name || '-') + '</span>';
        html += '<span style="color:#94a3b8;">账号状态</span><span style="color:' + sColor + ';font-weight:700;">' + sLabel + '</span>';
        html += '<span style="color:#94a3b8;">申请状态</span><span style="color:' + appColor + ';font-weight:700;">' + appLabel + '</span>';
        html += '<span style="color:#94a3b8;">QQ</span><span>' + esc(u.contact_qq || '-') + '</span>';
        html += '<span style="color:#94a3b8;">Discord</span><span>' + esc(u.contact_discord || '-') + '</span>';
        html += '<span style="color:#94a3b8;">注册时间</span><span>' + esc(u.created_at || '-') + '</span>';
        html += '<span style="color:#94a3b8;">最后登录</span><span>' + esc(u.last_login_at || '从未登录') + '</span>';
        html += '</div>';
        html += '<div class="user-detail-pc">';
        html += '<div class="user-detail-pc-head"><strong>资料完善度</strong><span style="color:' + pcColor + ';font-weight:700;">' + pcScore + '%</span></div>';
        html += '<div class="user-detail-pc-bar"><span style="width:' + pcScore + '%;background:' + pcColor + ';"></span></div>';
        html += '<div class="user-detail-pc-tip">' + (pcMissing.length ? '待完善：' + pcMissing.map(esc).join('、') : '资料已较完整') + '</div>';
        html += '</div>';
        html += '</aside>';

        var currentRole = u.role || 'user';
        var roleOptions = [
            { key: 'user', label: '普通用户', color: '#64748b' },
            { key: 'staff', label: '工作人员', color: '#16a34a' }
        ];

        html += '<section class="user-detail-section">';
        html += '<div class="user-detail-tabs">';
        html += '<button class="user-detail-tab-btn active" onclick="switchUserDetailPane(&quot;app&quot;, this)">入服申请</button>';
        html += '<button class="user-detail-tab-btn" onclick="switchUserDetailPane(&quot;account&quot;, this)">账号编辑</button>';
        html += '<button class="user-detail-tab-btn" onclick="switchUserDetailPane(&quot;note&quot;, this)">备注</button>';
        html += '<button class="user-detail-tab-btn" onclick="switchUserDetailPane(&quot;notify&quot;, this)">通知</button>';
        html += '<button class="user-detail-tab-btn" onclick="switchUserDetailPane(&quot;logs&quot;, this)">日志</button>';
        html += '<button class="user-detail-tab-btn user-detail-tab-btn-danger" onclick="switchUserDetailPane(&quot;settings&quot;, this)">账号设置</button>';
        html += '</div>';
        html += '<div class="user-detail-pane" data-pane="app" style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<h4 style="margin:0 0 12px;font-size:0.95em;color:#64748b;">入服申请</h4>';
        if (app) {
            var aColor = appStatusColors[app.status] || '#94a3b8';
            var aLabel = appStatusLabels[app.status] || app.status;
            html += '<div style="display:grid;grid-template-columns:90px 1fr;gap:8px 12px;font-size:0.9em;margin-bottom:12px;">';
            html += '<span style="color:#94a3b8;">状态</span><span style="color:' + aColor + ';font-weight:600;">' + aLabel + '</span>';
            html += '<span style="color:#94a3b8;">游戏ID</span><span>' + esc(app.mc_name) + '</span>';
            html += '<span style="color:#94a3b8;">年龄段</span><span>' + esc(app.age_range || '-') + '</span>';
            html += '<span style="color:#94a3b8;">来源</span><span>' + esc(app.source || '-') + '</span>';
            html += '<span style="color:#94a3b8;">原因</span><span>' + esc(app.reason) + '</span>';
            html += '<span style="color:#94a3b8;">提交时间</span><span>' + esc(app.created_at) + '</span>';
            html += '</div>';

            if (app.status === 'pending' || app.status === 'need_more_info') {
                html += '<div style="margin-top:10px;">';
                html += '<textarea id="reviewNoteInput" placeholder="审核备注（选填）" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9em;resize:vertical;min-height:60px;margin-bottom:8px;"></textarea>';
                html += renderReviewTemplateButtons('reviewNoteInput');
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
                html += '<button onclick="reviewApp(' + u.id + ',\'approved\')" style="padding:6px 14px;border:none;border-radius:6px;cursor:pointer;background:#16a34a;color:#fff;font-size:0.85em;">通过</button>';
                html += '<button onclick="reviewApp(' + u.id + ',\'rejected\')" style="padding:6px 14px;border:none;border-radius:6px;cursor:pointer;background:#dc2626;color:#fff;font-size:0.85em;">拒绝</button>';
                html += '<button onclick="reviewApp(' + u.id + ',\'need_more_info\')" style="padding:6px 14px;border:none;border-radius:6px;cursor:pointer;background:#3b82f6;color:#fff;font-size:0.85em;">需补充</button>';
                html += '</div></div>';
            }
            if (app.review_note) {
                html += '<div style="margin-top:10px;padding:10px;background:#eff6ff;border-radius:6px;font-size:0.88em;"><strong>审核备注：</strong>' + esc(app.review_note) + '</div>';
            }
        } else {
            html += '<p style="color:#94a3b8;font-size:0.9em;">该用户尚未提交入服申请</p>';
        }
        html += '</div>';

        html += '<div class="user-detail-pane" data-pane="account" style="display:none;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<h4 style="margin:0 0 12px;font-size:0.95em;color:#64748b;">账号资料编辑</h4>';
        html += '<div class="user-detail-account-grid">';
        html += '<input id="editUsernameInput" value="' + esc(u.username || '') + '" placeholder="用户名" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '<input id="editEmailInput" value="' + esc(u.email || '') + '" placeholder="邮箱" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '<input id="editMcNameInput" value="' + esc(u.mc_name || '') + '" placeholder="Minecraft ID" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '<input id="editQqInput" value="' + esc(u.contact_qq || '') + '" placeholder="QQ" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '<input id="editDiscordInput" value="' + esc(u.contact_discord || '') + '" placeholder="Discord" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '<input id="editPasswordInput" type="password" placeholder="新密码（留空不修改）" style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;">';
        html += '</div>';
        html += '<textarea id="editBioInput" placeholder="个人介绍" style="width:100%;margin-top:10px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:0.9em;resize:vertical;min-height:90px;">' + esc(u.bio || '') + '</textarea>';
        html += '<button onclick="saveUserAccount(' + u.id + ')" style="margin-top:10px;padding:7px 16px;border:none;border-radius:8px;cursor:pointer;background:#16a34a;color:#fff;font-size:0.88em;">保存账号资料</button>';
        html += '</div>';

        html += '<div class="user-detail-pane" data-pane="note" style="display:none;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<h4 style="margin:0 0 10px;font-size:0.95em;color:#64748b;">管理员备注</h4>';
        html += '<textarea id="adminNoteInput" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:0.9em;resize:vertical;min-height:140px;margin-bottom:10px;">' + esc(u.admin_note || '') + '</textarea>';
        html += '<button onclick="saveAdminNote(' + u.id + ')" style="padding:6px 14px;border:none;border-radius:6px;cursor:pointer;background:#6366f1;color:#fff;font-size:0.85em;">保存备注</button>';
        html += '</div>';

        html += '<div class="user-detail-pane" data-pane="notify" style="display:none;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<h4 style="margin:0 0 10px;font-size:0.95em;color:#64748b;">发送通知</h4>';
        html += '<input type="text" id="notifTitleInput" placeholder="通知标题" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:0.9em;margin-bottom:10px;">';
        html += '<textarea id="notifContentInput" placeholder="通知内容" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:0.9em;resize:vertical;min-height:140px;margin-bottom:10px;"></textarea>';
        html += '<button onclick="sendUserNotif(' + u.id + ')" style="padding:6px 14px;border:none;border-radius:6px;cursor:pointer;background:#f59e0b;color:#fff;font-size:0.85em;">发送通知</button>';
        html += '</div>';

        html += '<div class="user-detail-pane" data-pane="logs" style="display:none;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<h4 style="margin:0 0 10px;font-size:0.95em;color:#64748b;">最近操作日志</h4>';
        if (res.logs && res.logs.length > 0) {
            html += '<div style="font-size:0.85em;max-height:360px;overflow-y:auto;">';
            res.logs.forEach(function(log) {
                html += '<div style="padding:4px 0;border-bottom:1px solid #f1f5f9;">';
                html += '<span style="color:#94a3b8;">' + esc((log.created_at || '').substring(0, 16)) + '</span> ';
                html += '<span style="color:#334155;">' + esc(log.action) + '</span> ';
                if (log.detail) html += '<span style="color:#64748b;">- ' + esc(log.detail) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<p style="color:#94a3b8;font-size:0.9em;">暂无操作日志</p>';
        }
        html += '</div>';

        // 账号设置 pane（账号状态 / 角色权限 / 危险操作）
        html += '<div class="user-detail-pane" data-pane="settings" style="display:none;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">';
        html += '<div class="user-detail-setting-block">';
        html += '<h4>账号状态</h4>';
        html += '<p class="user-detail-setting-desc">封禁后用户将无法登录，已发布的内容会被隐藏。</p>';
        html += '<div class="user-detail-btn-row">';
        ['active', 'banned'].forEach(function(st) {
            var isActive = u.status === st;
            var bg = isActive ? sColor : '#e2e8f0';
            var clr = isActive ? '#fff' : '#334155';
            html += '<button onclick="changeUserStatus(' + u.id + ',\'' + st + '\')" style="background:' + bg + ';color:' + clr + ';">' + statusLabels[st] + '</button>';
        });
        html += '</div></div>';

        html += '<div class="user-detail-setting-block">';
        html += '<h4>角色权限</h4>';
        html += '<p class="user-detail-setting-desc">工作人员可在用户中心使用工作台管理留言、公告、工单与入服申请，但无法登录后台。</p>';
        html += '<div class="user-detail-btn-row">';
        roleOptions.forEach(function(r) {
            var isCur = currentRole === r.key;
            var bg = isCur ? r.color : '#e2e8f0';
            var clr = isCur ? '#fff' : '#334155';
            html += '<button onclick="changeUserRole(' + u.id + ',\'' + r.key + '\')" style="background:' + bg + ';color:' + clr + ';">' + r.label + '</button>';
        });
        html += '</div></div>';

        html += '<div class="user-detail-setting-block user-detail-danger">';
        html += '<h4>危险操作</h4>';
        html += '<p class="user-detail-setting-desc">注销将<strong>彻底删除</strong>该账号及申请、通知、工单等数据，无法恢复。若申请状态为「已通过」，会先尝试通过 RCON 自动从服务器白名单移除。</p>';
        html += '<button class="user-detail-danger-btn" onclick="deleteUserAccount(' + u.id + ',\'' + esc(u.username || '') + '\')">注销账号</button>';
        html += '</div>';
        html += '</div>';

        html += '</section></div>';

        container.innerHTML = html;
    }

    window.switchUserDetailPane = function(pane, btn) {
        var modal = document.getElementById('userDetailModal');
        if (!modal) return;
        modal.querySelectorAll('.user-detail-pane').forEach(function(el) {
            el.style.display = el.getAttribute('data-pane') === pane ? 'block' : 'none';
        });
        modal.querySelectorAll('.user-detail-tab-btn').forEach(function(el) {
            el.classList.toggle('active', el === btn);
        });
    };

    function doUserAction(action, data, callback, options) {
        // options.allowFailure=true: 失败时也调用 callback（callback 自行根据 res.status 决定如何展示）
        var opts = options || {};
        var fd = new FormData();
        fd.append('action', action);
        fd.append('csrf', getCsrf());
        for (var k in data) {
            var v = data[k];
            if (typeof FileList !== 'undefined' && v instanceof FileList) {
                Array.prototype.forEach.call(v, function(file) { fd.append(k + '[]', file); });
            } else if (Array.isArray(v)) {
                v.forEach(function(item) { fd.append(k + '[]', item); });
            } else if (typeof File !== 'undefined' && v instanceof File) {
                fd.append(k + '[]', v);
            } else {
                fd.append(k, v);
            }
        }

        fetch('user_actions.php', { method: 'POST', body: fd })
            .then(function(r) {
                return r.text().then(function(text) {
                    var res;
                    try {
                        res = JSON.parse(text);
                    } catch (e) {
                        throw new Error(r.ok ? '服务器返回异常，请刷新页面后重试' : ('请求失败：HTTP ' + r.status));
                    }
                    if (!r.ok) {
                        throw new Error(res.message || ('请求失败：HTTP ' + r.status));
                    }
                    return res;
                });
            })
            .then(function(res) {
                if (res.status === 'success') {
                    if (callback) callback(res);
                } else if (opts.allowFailure && callback) {
                    callback(res);
                } else {
                    if (window.showToast) window.showToast(res.message || '操作失败', 'error');
                    else alert(res.message || '操作失败');
                }
            })
            .catch(function(err) {
                var msg = err && err.message ? err.message : '请求失败';
                if (window.showToast) window.showToast(msg, 'error');
                else alert(msg);
            });
    }

    window.changeUserStatus = function(userId, status) {
        if (!confirm('确定要将用户状态修改为「' + statusLabels[status] + '」？')) return;
        doUserAction('update_status', { user_id: userId, status: status }, function() {
            openUserDetail(userId);
            loadUsersList(_usersPage);
        });
    };

    window.changeUserRole = function(userId, role) {
        var roleLabels = { user: '普通用户', staff: '工作人员' };
        var label = roleLabels[role] || role;
        var hint = role === 'staff'
            ? '设为「工作人员」后，该用户将可在用户中心使用工作台管理站点留言、公告、工单与入服申请。\n请确保已知晓权限范围，是否继续？'
            : '取消「工作人员」身份将立即收回工作台权限，是否继续？';
        if (!confirm(hint)) return;
        doUserAction('update_user_role', { user_id: userId, role: role }, function() {
            if (window.showToast) window.showToast('已将角色设为「' + label + '」', 'success');
            openUserDetail(userId);
            loadUsersList(_usersPage);
        });
    };

    window.deleteUserAccount = function(userId, username) {
        var name = (username || '').trim();
        var typed = prompt('注销操作不可恢复！\n\n该用户的账号资料、入服申请、申请历史、通知和工单都会被永久删除。\n如果该用户仍是「申请已通过」状态，将先尝试通过 RCON 自动从服务器白名单移除，失败将中断本次操作。\n\n请输入该用户的用户名「' + name + '」以确认注销：');
        if (typed === null) return;
        if (typed.trim() !== name) {
            if (window.showToast) window.showToast('用户名不匹配，已取消注销', 'error');
            else alert('用户名不匹配，已取消注销');
            return;
        }
        doUserAction('delete_user', { user_id: userId }, function(res) {
            if (window.showToast) window.showToast(res.message || '用户已注销', 'success');
            closeUserDetail();
            loadUsersList(_usersPage);
        }, { allowFailure: true });
    };

    function announcementLevelLabel(level) {
        var labels = { info: '普通', success: '活动', warning: '维护', danger: '紧急' };
        return labels[level] || '普通';
    }

    function announcementLevelColor(level) {
        var colors = { info: '#2563eb', success: '#16a34a', warning: '#ca8a04', danger: '#dc2626' };
        return colors[level] || '#2563eb';
    }
    var _announcementsCache = [];

    window.resetAnnouncementForm = function() {
        var fields = ['announcementId', 'announcementTitle', 'announcementContent', 'announcementPublishAt', 'announcementStartAt', 'announcementEndAt'];
        fields.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
        var level = document.getElementById('announcementLevel'); if (level) level.value = 'info';
        var pinned = document.getElementById('announcementPinned'); if (pinned) pinned.checked = false;
        var active = document.getElementById('announcementActive'); if (active) active.checked = true;
        var showInHome = document.getElementById('announcementShowInHome'); if (showInHome) showInHome.checked = false;
        var showInUserCenter = document.getElementById('announcementShowInUserCenter'); if (showInUserCenter) showInUserCenter.checked = true;
        var showAsPopup = document.getElementById('announcementShowAsPopup'); if (showAsPopup) showAsPopup.checked = false;
        var composer = document.getElementById('announcementComposer'); if (composer) composer.open = false;
        var count = document.getElementById('announcementsCount'); if (count) count.textContent = _announcementsCache.length ? '已发布 ' + _announcementsCache.length + ' 条，点击新增' : '点击展开填写公告内容';
    };

    window.loadAnnouncementsList = function() {
        doUserAction('list_announcements', {}, function(res) {
            var list = document.getElementById('announcementsList');
            if (!list) return;
            var rows = res.announcements || [];
            _announcementsCache = rows;
            var count = document.getElementById('announcementsCount');
            if (count) count.textContent = rows.length ? '已发布 ' + rows.length + ' 条，点击新增' : '暂无公告，点击发布';
            if (!rows.length) {
                list.innerHTML = '<div style="padding:32px;text-align:center;color:#94a3b8;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">暂无公告</div>';
                return;
            }
            list.innerHTML = rows.map(function(item) {
                var color = announcementLevelColor(item.level);
                var scopeParts = [];
                if (parseInt(item.show_in_home, 10)) scopeParts.push('首页');
                if (parseInt(item.show_in_user_center, 10)) scopeParts.push('用户中心');
                if (parseInt(item.show_as_popup, 10)) scopeParts.push('弹窗');
                return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;box-shadow:0 6px 18px rgba(15,23,42,.035);">' +
                    '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:6px;"><div style="min-width:0;"><strong style="color:#0f172a;">' + esc(item.title || '') + '</strong> ' + (parseInt(item.is_pinned, 10) ? '<span style="color:#16a34a;font-weight:700;font-size:.86em;">置顶</span>' : '') + '<div style="color:#64748b;font-size:.86em;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(item.content || '') + '</div></div><span style="color:' + color + ';font-weight:700;font-size:.86em;">' + announcementLevelLabel(item.level) + '</span></div>' +
                    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#94a3b8;font-size:.84em;"><span>' + (parseInt(item.is_active, 10) ? '启用' : '停用') + ' · ' + esc(item.start_at || item.publish_at || item.created_at || '') + (item.end_at ? ' ~ ' + esc(item.end_at) : '') + (scopeParts.length ? ' · ' + esc(scopeParts.join(' / ')) : '') + '</span><span><button onclick="editAnnouncement(' + item.id + ')" style="border:none;border-radius:7px;padding:5px 10px;background:#f0fdf4;color:#15803d;cursor:pointer;">编辑</button> <button onclick="deleteAnnouncement(' + item.id + ')" style="border:none;border-radius:7px;padding:5px 10px;background:#fef2f2;color:#dc2626;cursor:pointer;">删除</button></span></div>' +
                '</div>';
            }).join('');
        });
    };

    window.editAnnouncement = function(id) {
        var item = null;
        _announcementsCache.some(function(row) {
            if (parseInt(row.id, 10) === parseInt(id, 10)) {
                item = row;
                return true;
            }
            return false;
        });
        if (!item) return;
        document.getElementById('announcementId').value = item.id || '';
        document.getElementById('announcementTitle').value = item.title || '';
        document.getElementById('announcementContent').value = item.content || '';
        document.getElementById('announcementLevel').value = item.level || 'info';
        document.getElementById('announcementPublishAt').value = item.publish_at ? String(item.publish_at).replace(' ', 'T').slice(0, 16) : '';
        document.getElementById('announcementStartAt').value = item.start_at ? String(item.start_at).replace(' ', 'T').slice(0, 16) : '';
        document.getElementById('announcementEndAt').value = item.end_at ? String(item.end_at).replace(' ', 'T').slice(0, 16) : '';
        document.getElementById('announcementPinned').checked = !!parseInt(item.is_pinned, 10);
        document.getElementById('announcementActive').checked = !!parseInt(item.is_active, 10);
        document.getElementById('announcementShowInHome').checked = !!parseInt(item.show_in_home, 10);
        document.getElementById('announcementShowInUserCenter').checked = !!parseInt(item.show_in_user_center, 10);
        document.getElementById('announcementShowAsPopup').checked = !!parseInt(item.show_as_popup, 10);
        var composer = document.getElementById('announcementComposer');
        if (composer) {
            composer.open = true;
            composer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var count = document.getElementById('announcementsCount'); if (count) count.textContent = '正在编辑：' + (item.title || '');
    };

    window.saveAnnouncement = function() {
        doUserAction('save_announcement', {
            id: (document.getElementById('announcementId') || {}).value || '',
            title: (document.getElementById('announcementTitle') || {}).value || '',
            content: (document.getElementById('announcementContent') || {}).value || '',
            level: (document.getElementById('announcementLevel') || {}).value || 'info',
            publish_at: (document.getElementById('announcementPublishAt') || {}).value || '',
            start_at: (document.getElementById('announcementStartAt') || {}).value || '',
            end_at: (document.getElementById('announcementEndAt') || {}).value || '',
            is_pinned: (document.getElementById('announcementPinned') || {}).checked ? 1 : 0,
            is_active: (document.getElementById('announcementActive') || {}).checked ? 1 : 0,
            show_in_home: (document.getElementById('announcementShowInHome') || {}).checked ? 1 : 0,
            show_in_user_center: (document.getElementById('announcementShowInUserCenter') || {}).checked ? 1 : 0,
            show_as_popup: (document.getElementById('announcementShowAsPopup') || {}).checked ? 1 : 0
        }, function() {
            resetAnnouncementForm();
            loadAnnouncementsList();
        });
    };

    window.deleteAnnouncement = function(id) {
        if (!confirm('确定删除这条公告？')) return;
        doUserAction('delete_announcement', { id: id }, function() {
            loadAnnouncementsList();
        });
    };

    window.loadTicketsList = function(page, silent) {
        if (typeof page === 'boolean') {
            silent = page;
            page = 1;
        }
        page = page || 1;
        if (silent && hasUnsavedTicketDraft()) return;
        var status = (document.getElementById('ticketStatusFilter') || {}).value || '';
        var payload = { status: status, page: page };
        if (silent && _ticketsLastFp) payload.fp = _ticketsLastFp;
        doUserAction('list_tickets', payload, function(res) {
            if (res.fp) _ticketsLastFp = res.fp;
            if (res.unchanged) return;
            var list = document.getElementById('ticketsList');
            if (res.stats) updateOpenTicketsBadge(res.stats.open || 0);
            if (!list) return;
            var rows = res.tickets || [];
            if (!rows.length) {
                list.innerHTML = '<div style="padding:32px;text-align:center;color:#94a3b8;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">暂无工单</div>';
                var pgElEmpty = document.getElementById('ticketsPagination');
                if (pgElEmpty) pgElEmpty.innerHTML = '';
                return;
            }
            var statusLabels = { open: '待处理', replied: '已回复', closed: '已关闭' };
            var categoryLabels = { bug: 'Bug', report: '举报', appeal: '申诉', suggestion: '建议', other: '其他' };
            function renderAttachments(atts) {
                if (!atts || !atts.length) return '';
                var items = atts.map(function(a) {
                    var url = a.web_url || '';
                    var name = esc(a.original_name || '附件');
                    var size = esc(a.size_label || '');
                    if (a.is_image && url) {
                        // 点击缩略图打开灯箱预览（openLightbox 由 admin/panel.php 提供）
                        return '<a href="' + esc(url) + '" data-lightbox="' + esc(url) + '" title="' + name + '" onclick="openLightbox(\'' + esc(url).replace(/\\/g,'\\\\').replace(/\x27/g,'\\\x27') + '\');return false;" style="display:inline-block;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;line-height:0;background:#f8fafc;cursor:zoom-in;">' +
                            '<img src="' + esc(url) + '" alt="' + name + '" style="max-width:160px;max-height:120px;display:block;object-fit:cover;" loading="lazy"></a>';
                    }
                    return '<a href="' + esc(url) + '" target="_blank" rel="noopener" download style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#334155;text-decoration:none;font-size:.88em;">' +
                        '<span>📎</span><span>' + name + '</span><span style="color:#94a3b8;">' + size + '</span></a>';
                }).join('');
                return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">' + items + '</div>';
            }
            list.innerHTML = rows.map(function(ticket) {
                var replies = ticket.replies || [];
                var replyHtml = replies.map(function(reply) {
                    var isAdmin = reply.author_type === 'admin';
                    var atts = reply.attachments || [];
                    // 首条 user 回复继承工单的附件
                    if (!isAdmin && replies.indexOf(reply) === 0 && (!atts || !atts.length)) atts = ticket.attachments || [];
                    return '<div style="background:' + (isAdmin ? '#f0fdf4' : '#f8fafc') + ';border:1px solid ' + (isAdmin ? '#bbf7d0' : '#e2e8f0') + ';border-radius:10px;padding:10px;margin-top:8px;"><strong style="color:' + (isAdmin ? '#15803d' : '#334155') + ';">' + (isAdmin ? '管理员' : esc(reply.username || ticket.username || '用户')) + ' · ' + esc(reply.created_at || '') + '</strong><div class="ticket-rich-content">' + (reply.content_html || esc(reply.content || '')) + '</div>' + renderAttachments(atts) + '</div>';
                }).join('');
                // 工单创建时正文已作为首条 user 回复入库（见 admin/includes/tickets.php createSupportTicket），
                // 因此这里不再单独渲染 ticket.content，避免与 replies 中第一条重复。
                // 兜底：极少数老数据若没有 replies，则回退展示工单正文。
                var fallbackContent = replies.length ? '' :
                    '<div class="ticket-rich-content" style="margin-bottom:10px;">' + (ticket.content_html || esc(ticket.content || '')) + '</div>' + renderAttachments(ticket.attachments || []);
                var collapsed = _ticketCollapsedState[ticket.id] !== false;
                return '<div id="ticketCard' + ticket.id + '" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.04);">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
                        '<button type="button" onclick="toggleTicketCard(' + ticket.id + ')" aria-expanded="' + (collapsed ? 'false' : 'true') + '" style="display:flex;align-items:flex-start;gap:10px;min-width:220px;flex:1;text-align:left;border:none;background:transparent;padding:0;cursor:pointer;color:inherit;">' +
                            '<span id="ticketToggleIcon' + ticket.id + '" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:#f1f5f9;color:#64748b;font-weight:800;line-height:1;margin-top:1px;">' + (collapsed ? '+' : '−') + '</span>' +
                            '<span><strong>#' + ticket.id + ' ' + esc(ticket.subject || '') + '</strong><div style="color:#64748b;font-size:.86em;margin-top:2px;">' + esc(ticket.username || '-') + ' · ' + (categoryLabels[ticket.category] || '其他') + ' · ' + esc(ticket.created_at || '') + '</div></span>' +
                        '</button>' +
                        '<span style="font-weight:700;color:#16a34a;">' + (statusLabels[ticket.status] || ticket.status) + '</span>' +
                    '</div>' +
                    '<div id="ticketBody' + ticket.id + '" style="display:' + (collapsed ? 'none' : 'block') + ';margin-top:8px;">' +
                        fallbackContent +
                        '<div>' + replyHtml + '</div>' +
                        (ticket.status !== 'closed' ? (
                            '<div style="display:grid;gap:8px;margin-top:12px;">' +
                                '<textarea id="ticketReply' + ticket.id + '" class="rich-text-source" rows="3" placeholder="回复该工单..."></textarea>' +
                                '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">' +
                                    '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;cursor:pointer;font-size:.88em;">' +
                                        '<span>📎 添加附件</span>' +
                                        '<input type="file" id="ticketReplyFiles' + ticket.id + '" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.log,.json,.zip,.mp4,.mp3,image/*" style="display:none;" onchange="updateTicketFileLabel(' + ticket.id + ')">' +
                                    '</label>' +
                                    '<span id="ticketReplyFilesLabel' + ticket.id + '" style="color:#94a3b8;font-size:.85em;">未选择文件（最多 5 个，单个 ≤ 10MB）</span>' +
                                    '<button onclick="replyTicket(' + ticket.id + ')" style="border:none;border-radius:8px;padding:7px 12px;background:#16a34a;color:#fff;cursor:pointer;">回复</button>' +
                                    '<button onclick="closeTicket(' + ticket.id + ')" style="border:none;border-radius:8px;padding:7px 12px;background:#64748b;color:#fff;cursor:pointer;">关闭</button>' +
                                '</div>' +
                            '</div>'
                        ) : '') +
                    '</div>' +
                '</div>';
            }).join('');
            initAdminRichTextEditors(list);
            var pgEl = document.getElementById('ticketsPagination');
            if (pgEl) {
                if ((res.pages || 1) <= 1) { pgEl.innerHTML = ''; } else {
                    var pgHtml = '';
                    for (var i = 1; i <= (res.pages || 1); i++) {
                        var active = i === (res.page || 1) ? 'background:#16a34a;color:#fff;' : 'background:#f1f5f9;color:#334155;';
                        pgHtml += '<button onclick="loadTicketsList(' + i + ')" style="border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;' + active + '">' + i + '</button>';
                    }
                    pgEl.innerHTML = pgHtml;
                }
            }
        });
    };

    window.updateTicketFileLabel = function(id) {
        var input = document.getElementById('ticketReplyFiles' + id);
        var label = document.getElementById('ticketReplyFilesLabel' + id);
        if (!input || !label) return;
        var files = input.files || [];
        if (!files.length) {
            label.style.color = '#94a3b8';
            label.textContent = '未选择文件（最多 5 个，单个 ≤ 10MB）';
            return;
        }
        if (files.length > 5) {
            label.style.color = '#dc2626';
            label.textContent = '最多 5 个附件，已选 ' + files.length + ' 个';
            return;
        }
        var oversize = false;
        for (var i = 0; i < files.length; i++) if (files[i].size > 10 * 1024 * 1024) { oversize = true; break; }
        if (oversize) {
            label.style.color = '#dc2626';
            label.textContent = '存在超过 10MB 的文件';
            return;
        }
        label.style.color = '#15803d';
        label.textContent = '已选 ' + files.length + ' 个文件';
    };

    window.toggleTicketCard = function(id) {
        var body = document.getElementById('ticketBody' + id);
        var icon = document.getElementById('ticketToggleIcon' + id);
        if (!body) return;
        var collapsed = body.style.display !== 'none';
        body.style.display = collapsed ? 'none' : 'block';
        _ticketCollapsedState[id] = collapsed;
        if (icon) icon.textContent = collapsed ? '+' : '−';
        var btn = document.querySelector('button[onclick="toggleTicketCard(' + id + ')"]');
        if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    };

    window.replyTicket = function(id) {
        var textarea = document.getElementById('ticketReply' + id);
        var editor = textarea ? textarea.parentNode.querySelector('.rich-text-area') : null;
        var content = editor ? editor.innerHTML.trim() : ((textarea || {}).value || '');
        var fileInput = document.getElementById('ticketReplyFiles' + id);
        var files = fileInput && fileInput.files ? fileInput.files : null;
        var hasFiles = !!(files && files.length);
        if (!content && !hasFiles) { alert('请填写回复内容或添加附件'); return; }
        if (hasFiles && files.length > 5) { alert('最多上传 5 个附件'); return; }
        if (hasFiles) {
            for (var i = 0; i < files.length; i++) {
                if (files[i].size > 10 * 1024 * 1024) { alert('附件 ' + files[i].name + ' 超过 10MB'); return; }
            }
        }
        var payload = { ticket_id: id, content: content };
        if (hasFiles) payload.attachments = files;
        doUserAction('reply_ticket', payload, function() {
            loadTicketsList();
        });
    };

    window.closeTicket = function(id) {
        if (!confirm('确定关闭该工单？')) return;
        doUserAction('close_ticket', { ticket_id: id }, function() {
            loadTicketsList();
        });
    };

    var _logsActionLoaded = false;
    var logActionLabels = {
        // 账号
        login: '登录',
        register: '注册',
        update_profile: '修改个人资料',
        change_password: '修改密码',
        reset_password: '重置密码',
        delete_account: '注销账号',
        // 入服申请
        submit_application: '提交入服申请',
        review_application: '审核入服申请',
        update_application: '编辑入服申请',
        update_application_tags: '更新申请标签',
        mark_application_synced: '标记白名单同步',
        send_application_review_mail: '发送审核结果邮件',
        send_application_review_mail_failed: '审核结果邮件发送失败',
        // 白名单 / RCON
        whitelist_rcon_sync: 'RCON 白名单同步',
        whitelist_rcon_sync_failed: 'RCON 白名单同步失败',
        whitelist_rcon_self_remove: 'RCON 自助注销移除',
        whitelist_rcon_self_remove_failed: 'RCON 自助注销移除失败',
        whitelist_rcon_admin_remove: 'RCON 管理员注销移除',
        whitelist_rcon_admin_remove_failed: 'RCON 管理员注销移除失败',
        // 公告
        save_announcement: '保存公告',
        delete_announcement: '删除公告',
        staff_save_announcement: '工作人员保存公告',
        staff_delete_announcement: '工作人员删除公告',
        // 工单
        create_ticket: '创建工单',
        reply_ticket: '回复工单',
        close_ticket: '关闭工单',
        delete_ticket: '删除工单',
        admin_reply_ticket: '管理员回复工单',
        staff_reply_ticket: '工作人员回复工单',
        staff_update_ticket_status: '工作人员更新工单状态',
        staff_review_application: '工作人员审核申请',
        send_ticket_reply_mail: '发送工单回复邮件',
        send_ticket_reply_mail_failed: '工单回复邮件发送失败',
        // 留言
        staff_mark_message_read: '工作人员标记留言已读',
        staff_reply_message: '工作人员回复留言',
        staff_delete_message: '工作人员删除留言',
        // 用户管理
        update_user_status: '修改用户状态',
        update_user_role: '修改用户角色',
        update_user_account: '修改用户账号',
        update_password: '管理员修改密码',
        admin_delete_user: '管理员注销用户',
        send_notification: '发送通知',
        batch_send_notification: '批量发送通知',
        // 风控
        risk_block_ip: '封禁 IP',
        risk_unblock_ip: '解封 IP',
        risk_unlock: '解除锁定',
        // 商城
        shop_create_order: '创建订单',
        shop_cancel_order: '取消订单',
        shop_payment_success: '支付成功',
        shop_save_product: '保存商品',
        shop_upload_product_image: '上传商品封面',
        shop_adjust_stock: '调整库存',
        shop_update_order: '更新订单状态',
        shop_delivery_retry: '重试发货',
        shop_delivery_cancel: '取消发货',
        shop_delivery_batch_retry: '批量重试发货',
        shop_delivery_batch_cancel: '批量取消发货',
        shop_delivery_run: '手动触发发货队列'
    };

    function logActionLabel(action) {
        return logActionLabels[action] || action || '未知行为';
    }
    window.loadUserLogs = function(page) {
        page = page || 1;
        var tbody = document.getElementById('logsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding:32px;text-align:center;color:#94a3b8;">加载中...</td></tr>';
        doUserAction('list_user_logs', {
            page: page,
            search: (document.getElementById('logSearchInput') || {}).value || '',
            action_filter: (document.getElementById('logActionFilter') || {}).value || ''
        }, function(res) {
            var body = document.getElementById('logsTableBody');
            if (!body) return;
            var rows = res.logs || [];
            if (!rows.length) {
                body.innerHTML = '<tr><td colspan="5" style="padding:32px;text-align:center;color:#94a3b8;">暂无日志</td></tr>';
            } else {
                body.innerHTML = rows.map(function(log) {
                    var userText = log.username ? (esc(log.username) + '<div style="color:#94a3b8;font-size:.82em;">' + esc(log.mc_name || log.email || '') + '</div>') : '<span style="color:#94a3b8;">系统/游客</span>';
                    return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                        '<td style="padding:10px 12px;color:#64748b;white-space:nowrap;">' + esc((log.created_at || '').substring(0, 19)) + '</td>' +
                        '<td style="padding:10px 12px;">' + userText + '</td>' +
                        '<td style="padding:10px 12px;"><span title="' + esc(log.action || '') + '" style="display:inline-block;background:#f0fdf4;color:#15803d;border-radius:999px;padding:3px 9px;font-weight:700;font-size:.82em;">' + esc(logActionLabel(log.action)) + '</span></td>' +
                        '<td style="padding:10px 12px;color:#475569;max-width:420px;white-space:pre-wrap;">' + esc(log.detail || '-') + '</td>' +
                        '<td style="padding:10px 12px;color:#64748b;white-space:nowrap;">' + esc(log.ip || '-') + '</td>' +
                    '</tr>';
                }).join('');
            }
            if (!_logsActionLoaded) {
                var filter = document.getElementById('logActionFilter');
                if (filter) {
                    var current = filter.value || '';
                    filter.innerHTML = '<option value="">全部行为</option>' + (res.actions || []).map(function(item) {
                        return '<option value="' + esc(item.action || '') + '">' + esc(logActionLabel(item.action)) + ' (' + item.total + ')</option>';
                    }).join('');
                    filter.value = current;
                }
                _logsActionLoaded = true;
            }
            var pgEl = document.getElementById('logsPagination');
            if (pgEl) {
                if ((res.pages || 1) <= 1) {
                    pgEl.innerHTML = '';
                } else {
                    var html = '<span style="color:#64748b;font-size:.84em;margin-right:6px;">共 ' + (res.total || 0) + ' 条，每页 15 条</span>';
                    var currentPage = parseInt(res.page || 1, 10);
                    var totalPages = parseInt(res.pages || 1, 10);
                    function pageBtn(p, text, disabled) {
                        var active = p === currentPage ? 'background:#16a34a;color:#fff;' : 'background:#f1f5f9;color:#334155;';
                        var state = disabled ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
                        return '<button ' + (disabled ? 'disabled' : 'onclick="loadUserLogs(' + p + ')"') + ' style="border:none;padding:6px 10px;border-radius:6px;font-size:.85em;' + active + state + '">' + text + '</button>';
                    }
                    html += pageBtn(1, '首页', currentPage <= 1);
                    html += pageBtn(Math.max(1, currentPage - 1), '上一页', currentPage <= 1);
                    var start = Math.max(1, currentPage - 2);
                    var end = Math.min(totalPages, currentPage + 2);
                    if (start > 1) html += '<span style="padding:6px 2px;color:#94a3b8;">...</span>';
                    for (var i = start; i <= end; i++) {
                        html += pageBtn(i, String(i), false);
                    }
                    if (end < totalPages) html += '<span style="padding:6px 2px;color:#94a3b8;">...</span>';
                    html += pageBtn(Math.min(totalPages, currentPage + 1), '下一页', currentPage >= totalPages);
                    html += pageBtn(totalPages, '末页', currentPage >= totalPages);
                    pgEl.innerHTML = html;
                }
            }
        });
    };

    function riskEmpty(text) {
        return '<div style="padding:18px;text-align:center;color:#94a3b8;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">' + text + '</div>';
    }

    var reviewNoteTemplates = [
        ['通过', '申请信息完整，欢迎加入服务器，请入服前仔细阅读规则并保持友好交流。'],
        ['需补充', '请补充更详细的游玩经历、入服原因或联系方式后再次提交申请。'],
        ['拒绝', '当前申请信息不足或暂不符合入服要求，建议完善资料后再重新提交。'],
        ['风险复审', '该申请存在一定风险线索，建议管理员进一步核对账号、IP 或历史记录后再处理。']
    ];

    function renderReviewTemplateButtons(inputId) {
        return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;">' + reviewNoteTemplates.map(function(t) {
            return '<button type="button" onclick="fillReviewTemplate(\'' + inputId + '\',\'' + escAttr(t[1]) + '\')" style="border:1px solid #bbf7d0;border-radius:999px;background:#f0fdf4;color:#15803d;padding:4px 9px;cursor:pointer;font-size:.82em;">' + esc(t[0]) + '</button>';
        }).join('') + '</div>';
    }

    window.fillReviewTemplate = function(inputId, text) {
        var el = document.getElementById(inputId);
        if (!el) return;
        el.value = text;
        el.focus();
    };

    function riskFmtRetry(secs) {
        secs = parseInt(secs || 0, 10);
        if (secs <= 0) return '已到期';
        if (secs < 60) return secs + ' 秒';
        if (secs < 3600) return Math.ceil(secs / 60) + ' 分钟';
        return Math.ceil(secs / 3600) + ' 小时';
    }

    window.riskAddBlocklist = function(ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var ip  = (document.getElementById('riskBlockIpInput') || {}).value || '';
        var rsn = (document.getElementById('riskBlockReasonInput') || {}).value || '';
        var ttl = (document.getElementById('riskBlockTtlInput') || {}).value || '0';
        ip = ip.trim();
        if (!ip) return false;
        if (!confirm('确定要封禁 IP ' + ip + ' 吗？')) return false;
        doUserAction('risk_block_ip', { ip: ip, reason: rsn, ttl: ttl }, function() {
            var el; if ((el = document.getElementById('riskBlockIpInput'))) el.value = '';
            if ((el = document.getElementById('riskBlockReasonInput'))) el.value = '';
            loadRiskSummary();
        });
        return false;
    };

    window.riskUnblockIp = function(ip) {
        if (!confirm('确定要解封 IP ' + ip + ' 吗？')) return;
        doUserAction('risk_unblock_ip', { ip: ip }, function() { loadRiskSummary(); });
    };

    window.riskUnlock = function(scope, type, key) {
        if (!confirm('确定要解锁 ' + scope + '/' + type + '：' + key + ' 吗？')) return;
        doUserAction('risk_unlock', { scope: scope, type: type, key: key }, function() { loadRiskSummary(); });
    };

    window.riskQuickBlock = function(ip) {
        if (!ip) return;
        var reason = prompt('封禁 IP：' + ip + '\n请输入封禁原因（可选）', '风控页一键封禁') || '';
        if (reason === null) return;
        doUserAction('risk_block_ip', { ip: ip, reason: reason, ttl: 0 }, function() { loadRiskSummary(); });
    };

    window.loadRiskSummary = function() {
        doUserAction('risk_summary', {}, function(res) {
            var stats = res.stats || {};

            // ---- 威胁等级 banner ----
            var banner = document.getElementById('riskThreatBanner');
            if (banner) {
                var t = res.threat || { level: 'low', score: 0, reasons: [] };
                var palette = {
                    high:   { bg: '#fef2f2', bd: '#fecaca', fg: '#dc2626', label: '高风险', icon: '⚠' },
                    medium: { bg: '#fefce8', bd: '#fde68a', fg: '#ca8a04', label: '中风险', icon: '!' },
                    low:    { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d', label: '低风险', icon: '✓' }
                };
                var p = palette[t.level] || palette.low;
                var reasonsHtml = (t.reasons || []).map(function(r) {
                    return '<span style="display:inline-block;background:rgba(255,255,255,.7);border:1px solid ' + p.bd + ';color:' + p.fg + ';border-radius:999px;padding:3px 9px;margin:3px 4px 0 0;font-size:.82em;">' + esc(r) + '</span>';
                }).join('');
                banner.innerHTML =
                    '<div style="background:' + p.bg + ';border:1px solid ' + p.bd + ';border-radius:14px;padding:14px 16px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">' +
                            '<div style="display:flex;align-items:center;gap:10px;">' +
                                '<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:' + p.fg + ';color:#fff;font-weight:800;">' + p.icon + '</span>' +
                                '<div><div style="color:' + p.fg + ';font-weight:800;font-size:1.05em;">' + p.label + ' · ' + (t.score || 0) + ' 分</div>' +
                                '<div style="color:#475569;font-size:.84em;margin-top:2px;">综合登录暴破、锁定状态、注册异常等信号</div></div>' +
                            '</div>' +
                            '<div style="text-align:right;color:' + p.fg + ';font-size:.86em;">最近一次刷新：' + new Date().toLocaleTimeString() + '</div>' +
                        '</div>' +
                        (reasonsHtml ? '<div style="margin-top:10px;">' + reasonsHtml + '</div>' : '') +
                    '</div>';
            }

            var statsGrid = document.getElementById('riskStatsGrid');
            if (statsGrid) {
                var cards = [
                    ['暴破 IP（24h）',  stats.brute_force_ip_count || 0,    '#dc2626', '#fef2f2'],
                    ['当前锁定',        stats.locked_count || 0,            '#ca8a04', '#fefce8'],
                    ['注册集群',        stats.register_cluster_count || 0,  '#dc2626', '#fef2f2'],
                    ['新注册即申请',    stats.quick_apply_count || 0,       '#ca8a04', '#fefce8'],
                    ['IP 黑名单',       stats.ip_blocklist_count || 0,      '#0f172a', '#f8fafc'],
                    ['同 IP 多账号',    stats.multi_ip_count || 0,          '#dc2626', '#fef2f2'],
                    ['高频行为 IP',     stats.high_freq_ip_count || 0,      '#ca8a04', '#fefce8'],
                    ['已封禁用户',      stats.banned_users || 0,            '#64748b', '#f8fafc'],
                    ['近 7 日异常申请', stats.recent_rejected_apps || 0,    '#2563eb', '#eff6ff']
                ];
                statsGrid.innerHTML = cards.map(function(card) {
                    return '<div style="background:' + card[3] + ';border:1px solid #e2e8f0;border-radius:12px;padding:12px;"><div style="font-size:1.45em;font-weight:800;color:' + card[2] + ';line-height:1;">' + card[1] + '</div><div style="color:#475569;font-size:.84em;margin-top:6px;">' + card[0] + '</div></div>';
                }).join('');
            }

            // ---- 暴破登录 IP ----
            var bf = document.getElementById('riskBruteForceList');
            if (bf) {
                var bfRows = res.brute_force_ips || [];
                bf.innerHTML = bfRows.length ? bfRows.map(function(r) {
                    var reasons = r.reasons || {};
                    var reasonHtml = Object.keys(reasons).map(function(k) {
                        return '<span style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:999px;padding:2px 8px;margin:2px 3px 0 0;font-size:.78em;">' + esc(k) + ' × ' + reasons[k] + '</span>';
                    }).join('');
                    var srcLabel = { admin: '后台', user: '用户中心', both: '双端' }[r.source] || r.source || '-';
                    return '<div style="border:1px solid #fecaca;background:#fff;border-radius:10px;padding:10px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
                            '<strong style="color:#dc2626;font-family:Consolas,monospace;">' + esc(r.ip) + '</strong>' +
                            '<span style="color:#64748b;font-size:.84em;">失败 ' + r.fails + ' 次 · ' + srcLabel + '</span>' +
                        '</div>' +
                        '<div style="margin-top:6px;">' + reasonHtml + '</div>' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;align-items:center;">' +
                            '<span style="color:#94a3b8;font-size:.78em;">最后出现：' + esc(r.last_seen_str || '-') + '</span>' +
                            '<button type="button" onclick="riskQuickBlock(\'' + escAttr(r.ip) + '\')" style="border:none;padding:5px 10px;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;font-size:.82em;">封禁此 IP</button>' +
                        '</div>' +
                    '</div>';
                }).join('') : riskEmpty('近 24 小时未发现暴破登录 IP');
            }

            // ---- 当前锁定 ----
            var lockedEl = document.getElementById('riskLockedList');
            if (lockedEl) {
                var lockedRows = res.locked_entries || [];
                lockedEl.innerHTML = lockedRows.length ? lockedRows.map(function(r) {
                    var scopeLabel = r.scope === 'admin' ? '后台' : '用户中心';
                    var typeLabel  = r.type  === 'ip' ? 'IP' : '账号';
                    var actions = '<button type="button" onclick="riskUnlock(\'' + escAttr(r.scope) + '\',\'' + escAttr(r.type) + '\',\'' + escAttr(r.key) + '\')" style="border:none;padding:5px 10px;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:.82em;">解除锁定</button>';
                    if (r.type === 'ip') {
                        actions += ' <button type="button" onclick="riskQuickBlock(\'' + escAttr(r.key) + '\')" style="border:none;padding:5px 10px;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;font-size:.82em;">加入黑名单</button>';
                    }
                    return '<div style="border:1px solid #fde68a;background:#fff;border-radius:10px;padding:10px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
                            '<strong style="color:#ca8a04;font-family:Consolas,monospace;">[' + scopeLabel + '/' + typeLabel + '] ' + esc(r.key) + '</strong>' +
                            '<span style="color:#64748b;font-size:.84em;">失败 ' + r.fails + ' 次</span>' +
                        '</div>' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">' +
                            '<span style="color:#94a3b8;font-size:.78em;">剩余锁定：' + riskFmtRetry(r.retryAfter) + '</span>' +
                            '<div>' + actions + '</div>' +
                        '</div>' +
                    '</div>';
                }).join('') : riskEmpty('当前没有 IP / 账号被锁定');
            }

            // ---- IP 黑名单 ----
            var blEl = document.getElementById('riskBlocklistList');
            if (blEl) {
                var blRows = res.ip_blocklist || [];
                blEl.innerHTML = blRows.length ? blRows.map(function(b) {
                    var ttlText = b.until ? ('到期：' + esc(b.until_str)) : '永久';
                    return '<div style="border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
                            '<strong style="color:#0f172a;font-family:Consolas,monospace;">' + esc(b.ip) + '</strong>' +
                            '<span style="color:#64748b;font-size:.84em;">' + ttlText + '</span>' +
                        '</div>' +
                        '<div style="color:#475569;font-size:.84em;margin-top:5px;">' + (b.reason ? esc(b.reason) : '<span style="color:#94a3b8;">未填写原因</span>') + '</div>' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;align-items:center;">' +
                            '<span style="color:#94a3b8;font-size:.78em;">' + esc(b.by || '-') + ' · ' + esc(b.ts_str || '-') + '</span>' +
                            '<button type="button" onclick="riskUnblockIp(\'' + escAttr(b.ip) + '\')" style="border:none;padding:5px 10px;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:.82em;">解封</button>' +
                        '</div>' +
                    '</div>';
                }).join('') : riskEmpty('黑名单为空');
            }

            // ---- 注册集群 ----
            var rcEl = document.getElementById('riskRegisterClusterList');
            if (rcEl) {
                var rcRows = res.register_clusters || [];
                rcEl.innerHTML = rcRows.length ? rcRows.map(function(r) {
                    var users = (r.users || []).map(function(u) {
                        return '<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 8px;margin:3px;color:#334155;font-size:.82em;">' + esc(u.username || '-') + ' / ' + esc(u.mc_name || '-') + '</span>';
                    }).join('');
                    return '<div style="border:1px solid #fecaca;background:#fff;border-radius:10px;padding:10px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
                            '<strong style="color:#dc2626;font-family:Consolas,monospace;">' + esc(r.ip) + '</strong>' +
                            '<span style="color:#64748b;font-size:.84em;">' + r.user_count + ' 个账号</span>' +
                        '</div>' +
                        '<div style="margin-top:6px;">' + users + '</div>' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">' +
                            '<span style="color:#94a3b8;font-size:.78em;">' + esc(r.earliest || '-') + ' ~ ' + esc(r.latest || '-') + '</span>' +
                            '<button type="button" onclick="riskQuickBlock(\'' + escAttr(r.ip) + '\')" style="border:none;padding:5px 10px;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;font-size:.82em;">封禁此 IP</button>' +
                        '</div>' +
                    '</div>';
                }).join('') : riskEmpty('近 24 小时无注册集群');
            }

            // ---- 新注册即申请 ----
            var qaEl = document.getElementById('riskQuickApplyList');
            if (qaEl) {
                var qaRows = res.quick_apply || [];
                qaEl.innerHTML = qaRows.length ? qaRows.map(function(q) {
                    var gap = parseInt(q.gap_seconds || 0, 10);
                    var gapText = gap < 60 ? (gap + ' 秒') : (Math.floor(gap / 60) + ' 分 ' + (gap % 60) + ' 秒');
                    var statusLabel = appStatusLabels[q.status] || q.status || '-';
                    return '<div style="border:1px solid #fde68a;background:#fff;border-radius:10px;padding:10px;">' +
                        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
                            '<strong>' + esc(q.username || '-') + ' / ' + esc(q.mc_name || '-') + '</strong>' +
                            '<span style="color:#ca8a04;font-weight:700;font-size:.82em;">注册后 ' + gapText + ' 即申请</span>' +
                        '</div>' +
                        '<div style="color:#64748b;font-size:.82em;margin-top:5px;">注册：' + esc(q.register_at || '-') + ' · 申请：' + esc(q.apply_at || '-') + '</div>' +
                        '<div style="color:#94a3b8;font-size:.78em;margin-top:5px;">状态：' + esc(statusLabel) + ' · ' + esc(q.email || '-') + '</div>' +
                    '</div>';
                }).join('') : riskEmpty('暂无新注册即申请记录');
            }

            var sourceList = document.getElementById('riskSourceStatsList');
            if (sourceList) {
                var sourceRows = res.source_stats || [];
                var maxTotal = sourceRows.reduce(function(max, row) {
                    return Math.max(max, parseInt(row.total || 0, 10));
                }, 1);
                sourceList.innerHTML = sourceRows.length ? sourceRows.map(function(row) {
                    var total = parseInt(row.total || 0, 10);
                    var width = Math.max(4, Math.round((total / maxTotal) * 100));
                    var approvedRate = parseFloat(row.approved_rate || 0);
                    var rejectedRate = parseFloat(row.rejected_rate || 0);
                    return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:9px 10px;background:#fff;">' +
                        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;"><strong style="color:#0f172a;">' + esc(row.source_name || '未填写') + '</strong><span style="color:#64748b;font-size:.86em;">' + total + ' 份</span></div>' +
                        '<div style="height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-bottom:6px;"><span style="display:block;height:100%;width:' + width + '%;background:linear-gradient(135deg,#16a34a,#22c55e);border-radius:999px;"></span></div>' +
                        '<div style="display:flex;gap:8px;flex-wrap:wrap;color:#64748b;font-size:.8em;"><span>过 ' + (row.approved || 0) + '（' + approvedRate + '%）</span><span>拒 ' + (row.rejected || 0) + '（' + rejectedRate + '%）</span><span>待 ' + (row.pending || 0) + '</span><span>补 ' + (row.need_more_info || 0) + '</span></div>' +
                    '</div>';
                }).join('') : riskEmpty('暂无来源统计数据');
            }

            var reviewList = document.getElementById('riskReviewQualityList');
            if (reviewList) {
                var reviewRows = res.review_quality || [];
                reviewList.innerHTML = reviewRows.length ? reviewRows.map(function(row) {
                    var total = parseInt(row.total || 0, 10);
                    var approvedRate = parseFloat(row.approved_rate || 0);
                    var rejectedRate = parseFloat(row.rejected_rate || 0);
                    var avgHours = parseFloat(row.avg_hours || 0);
                    var passWidth = Math.max(3, Math.min(100, approvedRate));
                    return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:9px 10px;background:#fff;">' +
                        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;"><strong style="color:#0f172a;">' + esc(row.reviewer || '未知管理员') + '</strong><span style="color:#64748b;font-size:.86em;">审核 ' + total + ' 份</span></div>' +
                        '<div style="height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-bottom:6px;"><span style="display:block;height:100%;width:' + passWidth + '%;background:linear-gradient(135deg,#16a34a,#22c55e);border-radius:999px;"></span></div>' +
                        '<div style="display:flex;gap:8px;flex-wrap:wrap;color:#64748b;font-size:.8em;"><span>过 ' + (row.approved || 0) + '（' + approvedRate + '%）</span><span>拒 ' + (row.rejected || 0) + '（' + rejectedRate + '%）</span><span>补 ' + (row.need_more_info || 0) + '</span><span>均 ' + avgHours + 'h</span></div>' +
                    '</div>';
                }).join('') : riskEmpty('暂无审核质量数据');
            }

            var multi = document.getElementById('riskMultiIpList');
            if (multi) {
                var rows = res.multi_ip || [];
                multi.innerHTML = rows.length ? rows.map(function(row) {
                    var users = (row.users || []).map(function(u) {
                        return '<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 8px;margin:3px;color:#334155;">' + esc(u.username || '-') + ' / ' + esc(u.mc_name || '-') + '</span>';
                    }).join('');
                    return '<div style="border:1px solid #fecaca;background:#fff;border-radius:10px;padding:10px;"><div style="display:flex;justify-content:space-between;gap:8px;"><strong style="color:#dc2626;">' + esc(row.ip || '-') + '</strong><span style="color:#64748b;font-size:.86em;">' + row.user_count + ' 账号 / ' + row.log_count + ' 次</span></div><div style="margin-top:6px;">' + users + '</div><div style="color:#94a3b8;font-size:.8em;margin-top:5px;">最后出现：' + esc(row.last_seen || '-') + '</div></div>';
                }).join('') : riskEmpty('暂无同 IP 多账号线索');
            }

            var high = document.getElementById('riskHighFreqList');
            if (high) {
                var highRows = res.high_frequency || [];
                high.innerHTML = highRows.length ? highRows.map(function(row) {
                    return '<div style="border:1px solid #fde68a;background:#fff;border-radius:10px;padding:10px;"><div style="display:flex;justify-content:space-between;gap:8px;"><strong style="color:#ca8a04;">' + esc(row.ip || '-') + '</strong><span style="color:#64748b;font-size:.86em;">' + row.total + ' 次 / ' + row.user_count + ' 用户</span></div><div style="color:#94a3b8;font-size:.8em;margin-top:5px;">最后出现：' + esc(row.last_seen || '-') + '</div></div>';
                }).join('') : riskEmpty('暂无 24 小时高频 IP');
            }

            var apps = document.getElementById('riskApplicationsList');
            if (apps) {
                var appRows = res.suspicious_applications || [];
                apps.innerHTML = appRows.length ? appRows.map(function(app) {
                    var statusLabel = app.status === 'rejected' ? '已拒绝' : '需补充信息';
                    return '<div style="border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px;"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong>' + esc(app.username || '-') + ' / ' + esc(app.mc_name || '-') + '</strong><span style="color:#dc2626;font-weight:700;font-size:.86em;">' + statusLabel + '</span></div><div style="color:#64748b;font-size:.86em;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(app.review_note || app.reason || '-') + '</div><div style="color:#94a3b8;font-size:.8em;margin-top:5px;">' + esc(app.email || '-') + '</div></div>';
                }).join('') : riskEmpty('暂无近期异常申请');
            }
        });
    };

    window.reviewApp = function(userId, decision) {
        var note = (document.getElementById('reviewNoteInput') || {}).value || '';
        var labels = { approved: '通过', rejected: '拒绝', need_more_info: '需要补充信息' };
        if (!confirm('确定要「' + labels[decision] + '」该申请？')) return;
        doUserAction('review_application', { user_id: userId, decision: decision, review_note: note }, function() {
            openUserDetail(userId);
            loadUsersList(_usersPage);
            loadApplicationsList(_appsPage);
        });
    };

    window.saveUserAccount = function(userId) {
        doUserAction('update_user_account', {
            user_id: userId,
            username: (document.getElementById('editUsernameInput') || {}).value || '',
            email: (document.getElementById('editEmailInput') || {}).value || '',
            mc_name: (document.getElementById('editMcNameInput') || {}).value || '',
            contact_qq: (document.getElementById('editQqInput') || {}).value || '',
            contact_discord: (document.getElementById('editDiscordInput') || {}).value || '',
            bio: (document.getElementById('editBioInput') || {}).value || '',
            new_password: (document.getElementById('editPasswordInput') || {}).value || ''
        }, function() {
            alert('用户账号已更新');
            openUserDetail(userId);
            loadUsersList(_usersPage);
            loadApplicationsList(_appsPage);
        });
    };

    window.saveAdminNote = function(userId) {
        var note = (document.getElementById('adminNoteInput') || {}).value || '';
        doUserAction('save_note', { user_id: userId, admin_note: note }, function() {
            alert('备注已保存');
        });
    };

    window.sendUserNotif = function(userId) {
        var title = (document.getElementById('notifTitleInput') || {}).value || '';
        var content = (document.getElementById('notifContentInput') || {}).value || '';
        if (!title || !content) { alert('请填写通知标题和内容'); return; }
        doUserAction('send_notification', { user_id: userId, title: title, content: content }, function() {
            alert('通知已发送');
            document.getElementById('notifTitleInput').value = '';
            document.getElementById('notifContentInput').value = '';
        });
    };

    window.sendBatchUserNotification = function() {
        var search = (document.getElementById('userSearchInput') || {}).value || '';
        var status = (document.getElementById('userStatusFilter') || {}).value || '';
        var title = (document.getElementById('batchNotifTitleInput') || {}).value || '';
        var content = (document.getElementById('batchNotifContentInput') || {}).value || '';
        if (!title || !content) {
            alert('请填写通知标题和内容');
            return;
        }
        if (!confirm('确定按当前筛选条件批量发送站内通知？')) return;
        doUserAction('batch_send_notification', {
            search: search,
            status: status,
            title: title,
            content: content
        }, function(res) {
            alert('批量通知已发送：' + (res.count || 0) + ' 人');
            document.getElementById('batchNotifTitleInput').value = '';
            document.getElementById('batchNotifContentInput').value = '';
        });
    };

    window.sendSmtpTestMail = function() {
        var email = (document.getElementById('smtpTestEmailInput') || {}).value || '';
        if (!email) {
            alert('请填写测试收件邮箱');
            return;
        }
        doUserAction('test_smtp_mail', { email: email }, function() {
            alert('测试邮件已发送，请检查收件箱');
        });
    };

    window.loadApplicationsList = function(page, silent) {
        _appsPage = page || 1;
        var search = (document.getElementById('appSearchInput') || {}).value || '';
        var status = (document.getElementById('appStatusFilter') || {}).value || '';
        var url = 'user_actions.php?action=list_applications&csrf=' + encodeURIComponent(getCsrf())
            + '&page=' + _appsPage
            + '&search=' + encodeURIComponent(search)
            + '&status=' + encodeURIComponent(status);
        // 轮询路径携带上次指纹，服务端发现数据未变会直接返回 unchanged，跳过查询/序列化
        if (silent && _appsLastFp) url += '&fp=' + encodeURIComponent(_appsLastFp);
        fetch(url).then(function(r) { return r.json(); }).then(function(res) {
            if (res.status !== 'success') return;
            if (res.fp) _appsLastFp = res.fp;
            if (res.unchanged) return;
            var s = res.stats || {};
            var el;
            el = document.getElementById('appsStatTotal'); if (el) el.textContent = s.total || 0;
            el = document.getElementById('appsStatPending'); if (el) el.textContent = s.pending || 0;
            el = document.getElementById('appsStatNeedInfo'); if (el) el.textContent = s.need_more_info || 0;
            el = document.getElementById('appsStatApproved'); if (el) el.textContent = s.approved || 0;
            el = document.getElementById('appsStatRejected'); if (el) el.textContent = s.rejected || 0;
            el = document.getElementById('appsStatUnsynced'); if (el) el.textContent = s.approved_unsynced || 0;
            updatePendingApplicationsBadge(s.pending || 0);
            var list = document.getElementById('applicationsList');
            if (!list) return;
            _applicationsCache = res.applications || [];
            _selectedApplicationIds = {};
            if (!res.applications || res.applications.length === 0) {
                list.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">暂无申请数据</div>';
            } else {
                list.innerHTML = res.applications.map(renderApplicationCard).join('');
            }
            updateApplicationsBatchBar();
            var pgEl = document.getElementById('applicationsPagination');
            if (pgEl) {
                if (res.pages <= 1) { pgEl.innerHTML = ''; return; }
                var pgHtml = '';
                for (var i = 1; i <= res.pages; i++) {
                    var active = i === res.page ? 'background:#16a34a;color:#fff;' : 'background:#f1f5f9;color:#334155;';
                    pgHtml += '<button onclick="loadApplicationsList(' + i + ')" style="border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;' + active + '">' + i + '</button>';
                }
                pgEl.innerHTML = pgHtml;
            }
        }).catch(function(err) { console.error('申请列表加载失败', err); });
    };

    function isApplicationsTabVisible() {
        var tab = document.getElementById('tab-applications');
        return !!(tab && tab.style.display !== 'none');
    }

    function startApplicationsPolling() {
        stopApplicationsPolling();
        if (!isApplicationsTabVisible() || document.hidden) return;
        _appsPollTimer = setInterval(function() {
            if (!isApplicationsTabVisible() || document.hidden) {
                stopApplicationsPolling();
                return;
            }
            var list = document.getElementById('applicationsList');
            if (list && list.contains(document.activeElement)) return;
            loadApplicationsList(_appsPage, true);
        }, _appsPollInterval);
    }

    function stopApplicationsPolling() {
        if (_appsPollTimer) {
            clearInterval(_appsPollTimer);
            _appsPollTimer = null;
        }
    }

    function updatePendingApplicationsBadge(count) {
        var badge = document.getElementById('pendingApplicationsBadge');
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

    function updateOpenTicketsBadge(count) {
        var badge = document.getElementById('openTicketsBadge');
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

    function isTicketsTabVisible() {
        var tab = document.getElementById('tab-tickets');
        return !!(tab && tab.style.display !== 'none');
    }

    function hasUnsavedTicketDraft() {
        var list = document.getElementById('ticketsList');
        if (!list) return false;
        var editors = list.querySelectorAll('.rich-text-area');
        for (var i = 0; i < editors.length; i++) {
            var text = (editors[i].innerText || '').replace(/\u00a0/g, ' ').trim();
            var html = (editors[i].innerHTML || '').replace(/<br\s*\/?>/gi, '').trim();
            if (text !== '' || (html !== '' && html !== '<p></p>')) return true;
        }
        var fileInputs = list.querySelectorAll('input[type="file"][id^="ticketReplyFiles"]');
        for (var j = 0; j < fileInputs.length; j++) {
            if (fileInputs[j].files && fileInputs[j].files.length) return true;
        }
        return false;
    }

    function startTicketsPolling() {
        stopTicketsPolling();
        if (!isTicketsTabVisible() || document.hidden) return;
        _ticketsPollTimer = setInterval(function() {
            if (!isTicketsTabVisible() || document.hidden) {
                stopTicketsPolling();
                return;
            }
            var list = document.getElementById('ticketsList');
            if (list && list.contains(document.activeElement)) return;
            if (hasUnsavedTicketDraft()) return;
            loadTicketsList(true);
        }, _ticketsPollInterval);
    }

    function stopTicketsPolling() {
        if (_ticketsPollTimer) {
            clearInterval(_ticketsPollTimer);
            _ticketsPollTimer = null;
        }
    }

    function renderApplicationCard(app) {
        var color = appStatusColors[app.status] || '#94a3b8';
        var label = appStatusLabels[app.status] || app.status;
        var id = app.id;
        var command = app.whitelist_command || ('/vmc approve ' + (app.mc_name || ''));
        var tags = Array.isArray(app.tags) ? app.tags : [];
        var revisions = Array.isArray(app.revisions) ? app.revisions : [];
        var riskScore = typeof app.risk_score !== 'undefined' ? parseInt(app.risk_score, 10) : null;
        var riskLevel = app.risk_level || 'low';
        var riskHints = Array.isArray(app.risk_hints) ? app.risk_hints : [];
        var riskMeta = {
            low: { label: '低风险', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
            medium: { label: '中风险', color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
            high: { label: '高风险', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
        }[riskLevel] || { label: '低风险', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
        var html = '';
        html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;box-shadow:0 6px 18px rgba(15,23,42,.035);">';
        html += '<div style="display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:12px;align-items:start;">';
        html += '<div style="min-width:0;">';
        html += '<div style="display:flex;gap:10px;align-items:flex-start;min-width:0;"><input type="checkbox" class="application-batch-check" data-app-id="' + id + '" onchange="toggleApplicationSelected(' + id + ', this.checked)" style="margin-top:3px;width:16px;height:16px;accent-color:#16a34a;"><div style="min-width:0;">';
        html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><strong style="color:#0f172a;">' + esc(app.username || '-') + '</strong><span style="color:#64748b;">/ ' + esc(app.mc_name || '-') + '</span><span style="color:' + color + ';font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 8px;font-size:.82em;">' + label + '</span>';
        if (riskScore !== null) html += '<span style="color:' + riskMeta.color + ';background:' + riskMeta.bg + ';border:1px solid ' + riskMeta.border + ';border-radius:999px;padding:3px 8px;font-size:.82em;font-weight:700;">评分 ' + riskScore + ' · ' + riskMeta.label + '</span>';
        if (parseInt(app.synced_to_server, 10)) {
            html += '<span style="color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:3px 8px;font-size:.82em;font-weight:700;">已同步</span>';
        } else if ((app.status === 'approved' || app.status === 'rejected') && app.sync_error) {
            html += '<span title="' + escAttr(app.sync_error) + '" style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:3px 8px;font-size:.82em;font-weight:700;">同步失败</span>';
        }
        html += '</div>';
        html += '<div style="font-size:.84em;color:#64748b;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(app.email || '-') + ' · ' + esc(app.created_at || '-') + ' · 年龄 ' + esc(app.age_range || '-') + ' · 来源 ' + esc(app.source || '-') + '</div>';
        html += '<div style="font-size:.86em;color:#475569;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">申请原因：' + esc(app.reason || '-') + '</div>';
        if ((app.status === 'approved' || app.status === 'rejected') && app.sync_error && !parseInt(app.synced_to_server, 10)) {
            html += '<div style="font-size:.82em;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:6px 8px;margin-top:6px;line-height:1.4;">同步报错：' + esc(app.sync_error) + '</div>';
        }
        html += '</div></div></div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center;">';
        html += '<button onclick="reviewApplicationById(' + id + ',\'approved\')" style="padding:6px 10px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-size:.86em;">通过</button>';
        html += '<button onclick="reviewApplicationById(' + id + ',\'rejected\')" style="padding:6px 10px;border:none;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;font-size:.86em;">拒绝</button>';
        html += '<button onclick="reviewApplicationById(' + id + ',\'need_more_info\')" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-size:.86em;">补充</button>';
        if (app.status === 'approved' || app.status === 'rejected') {
            var syncText = parseInt(app.synced_to_server, 10) ? '重同步' : (app.status === 'rejected' ? '同步拒绝' : '同步');
            html += '<button onclick="syncApplicationWhitelist(' + id + ')" style="padding:6px 10px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;cursor:pointer;font-size:.86em;">' + syncText + '</button>';
        }
        html += '<button onclick="openUserDetail(' + app.user_id + ')" style="padding:6px 10px;border:none;border-radius:8px;background:#64748b;color:#fff;cursor:pointer;font-size:.86em;">用户</button>';
        html += '</div></div>';
        html += '<details style="margin-top:8px;border-top:1px dashed #e2e8f0;padding-top:8px;"><summary style="cursor:pointer;color:#64748b;font-weight:700;font-size:.88em;">展开详情 / 编辑 / 标签 / 历史</summary>';
        if (riskScore !== null) {
            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:' + riskMeta.bg + ';border:1px solid ' + riskMeta.border + ';border-radius:12px;padding:8px 10px;margin-top:10px;margin-bottom:10px;">';
            html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><strong style="color:' + riskMeta.color + ';">审核评分 ' + riskScore + '</strong><span style="color:' + riskMeta.color + ';font-weight:700;">' + riskMeta.label + '</span></div>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + (riskHints.length ? riskHints.map(function(h) { return '<span style="background:#fff;border:1px solid ' + riskMeta.border + ';color:' + riskMeta.color + ';border-radius:999px;padding:3px 8px;font-size:.82em;font-weight:700;">' + esc(h) + '</span>'; }).join('') : '<span style="color:#64748b;font-size:.86em;">暂无风险提示</span>') + '</div>';
            html += '</div>';
        }
        html += '<div style="display:grid;grid-template-columns:90px 1fr;gap:8px 12px;font-size:.9em;margin-bottom:12px;">';
        html += '<span style="color:#94a3b8;">年龄段</span><span>' + esc(app.age_range || '-') + '</span>';
        html += '<span style="color:#94a3b8;">来源</span><span>' + esc(app.source || '-') + '</span>';
        html += '<span style="color:#94a3b8;">原因</span><span>' + esc(app.reason || '-') + '</span>';
        if (app.review_note) html += '<span style="color:#94a3b8;">审核备注</span><span>' + esc(app.review_note) + '</span>';
        if (app.status === 'approved' || app.status === 'rejected') {
            html += '<span style="color:#94a3b8;">白名单命令</span><span><code style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;">' + esc(command) + '</code> <button onclick="copyText(\'' + escAttr(command) + '\')" style="margin-left:6px;padding:4px 8px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;">复制</button></span>';
            html += '<span style="color:#94a3b8;">同步状态</span><span>' + (parseInt(app.synced_to_server, 10) ? '<span style="color:#16a34a;font-weight:700;">已同步</span> ' + esc(app.synced_at || '') : '<span style="color:#2563eb;font-weight:700;">未同步</span>') + (app.sync_error ? '<div style="color:#dc2626;margin-top:4px;">' + esc(app.sync_error) + '</div>' : '') + '</span>';
        }
        html += '</div>';
        html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:12px;">';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + (tags.length ? tags.map(function(t) { return '<span style="background:#dcfce7;color:#15803d;border-radius:999px;padding:3px 8px;font-size:.82em;font-weight:700;">' + esc(t) + '</span>'; }).join('') : '<span style="color:#94a3b8;font-size:.86em;">暂无标签</span>') + '</div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="appTags' + id + '" value="' + esc(tags.join('，')) + '" placeholder="标签，用逗号分隔" style="flex:1;min-width:220px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;"><button onclick="saveApplicationTags(' + id + ')" style="padding:7px 12px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">保存标签</button></div>';
        html += '</div>';
        if (revisions.length) {
            html += '<details style="margin-bottom:12px;"><summary style="cursor:pointer;color:#64748b;font-weight:600;">申请历史（' + revisions.length + '）</summary><div style="display:grid;gap:8px;margin-top:10px;">';
            revisions.slice(0, 8).forEach(function(r) {
                html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:.86em;color:#475569;"><strong>' + esc(r.snapshot_type || '-') + '</strong> · ' + esc(r.status || '-') + ' · ' + esc(r.created_at || '-') + '<div style="margin-top:4px;color:#64748b;">' + esc(r.reason || '') + '</div></div>';
            });
            html += '</div></details>';
        }
        html += '<details style="margin-bottom:12px;"><summary style="cursor:pointer;color:#16a34a;font-weight:600;">编辑申请</summary>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">';
        html += '<input id="appMcName' + id + '" value="' + esc(app.mc_name || '') + '" placeholder="游戏ID" style="padding:9px;border:1px solid #e2e8f0;border-radius:8px;">';
        html += '<input id="appAgeRange' + id + '" value="' + esc(app.age_range || '') + '" placeholder="年龄段" style="padding:9px;border:1px solid #e2e8f0;border-radius:8px;">';
        html += '<input id="appSource' + id + '" value="' + esc(app.source || '') + '" placeholder="来源" style="padding:9px;border:1px solid #e2e8f0;border-radius:8px;">';
        html += '<select id="appStatus' + id + '" style="padding:9px;border:1px solid #e2e8f0;border-radius:8px;">';
        ['pending', 'need_more_info', 'approved', 'rejected'].forEach(function(st) {
            html += '<option value="' + st + '"' + (app.status === st ? ' selected' : '') + '>' + appStatusLabels[st] + '</option>';
        });
        html += '</select></div>';
        html += '<textarea id="appReason' + id + '" placeholder="申请原因" style="width:100%;margin-top:10px;padding:9px;border:1px solid #e2e8f0;border-radius:8px;min-height:78px;">' + esc(app.reason || '') + '</textarea>';
        html += '<textarea id="appReviewNote' + id + '" placeholder="审核备注" style="width:100%;margin-top:10px;padding:9px;border:1px solid #e2e8f0;border-radius:8px;min-height:64px;">' + esc(app.review_note || '') + '</textarea>';
        html += renderReviewTemplateButtons('appReviewNote' + id);
        html += '<button onclick="saveApplicationEdit(' + id + ')" style="margin-top:8px;padding:7px 14px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">保存编辑</button>';
        html += '</details>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
        if (app.status === 'approved' || app.status === 'rejected') {
            html += '<button onclick="markApplicationSynced(' + id + ',' + (parseInt(app.synced_to_server, 10) ? '0' : '1') + ')" style="padding:7px 14px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;cursor:pointer;">' + (parseInt(app.synced_to_server, 10) ? '取消同步' : '标记已同步') + '</button>';
        }
        html += '</div></details></div>';
        return html;
    }

    function escAttr(s) {
        return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
    }

    window.copyText = function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { alert('已复制'); }).catch(function() { prompt('请手动复制', text); });
            return;
        }
        prompt('请手动复制', text);
    };

    window.saveApplicationTags = function(appId) {
        doUserAction('update_application_tags', {
            app_id: appId,
            tags: (document.getElementById('appTags' + appId) || {}).value || ''
        }, function() {
            loadApplicationsList(_appsPage);
        });
    };

    window.markApplicationSynced = function(appId, synced) {
        doUserAction('mark_application_synced', { app_id: appId, synced: synced }, function() {
            loadApplicationsList(_appsPage);
        });
    };

    window.syncApplicationWhitelist = function(appId) {
        if (!confirm('确定通过 RCON 自动同步该审核命令？如果失败，会提示是否复制备用命令。')) return;
        doUserAction('sync_application_whitelist', { app_id: appId }, function(res) {
            if (res.status === 'success') {
                var ok = res.message || '同步成功';
                if (res.response) ok += '\n服务器返回：' + res.response;
                if (window.showToast) window.showToast(ok, 'success'); else alert(ok);
            } else {
                // 失败：弹出原因 + 备用命令复制
                var msg = res.message || '同步失败';
                if (res.response) msg += '\n服务器返回：' + res.response;
                if (res.command) {
                    msg += '\n\n备用命令：\n' + res.command;
                    msg += '\n\n是否复制备用命令，手动粘贴到服务器控制台执行？';
                    if (confirm(msg)) copyText(res.command);
                } else {
                    alert(msg);
                }
            }
            loadApplicationsList(_appsPage);
        }, { allowFailure: true });
    };

    window.batchSyncSelectedApplications = function() {
        var apps = getSelectedApplications().filter(function(app) {
            return app.status === 'approved' || app.status === 'rejected';
        });
        if (!apps.length) { alert('请选择已通过或已拒绝的申请'); return; }
        if (!confirm('确定要对 ' + apps.length + ' 个申请发起 RCON 自动同步？\n（一次最多处理 50 条，已成功的会跳过）')) return;
        doUserAction('batch_sync_application_whitelist', {
            app_ids: apps.map(function(a) { return a.id; })
        }, function(res) {
            _showBatchSyncResult(res);
            loadApplicationsList(_appsPage);
        }, { allowFailure: true });
    };

    window.retryAllFailedSyncs = function() {
        if (!confirm('确定要对所有"未同步"的已审核申请发起 RCON 同步？\n（最多处理 50 条）')) return;
        doUserAction('batch_sync_application_whitelist', {}, function(res) {
            _showBatchSyncResult(res);
            loadApplicationsList(_appsPage);
        }, { allowFailure: true });
    };

    function _showBatchSyncResult(res) {
        if (res.status !== 'success') {
            alert(res.message || '批量同步失败');
            return;
        }
        var msg = res.message || '批量同步完成';
        if (res.fail_count > 0 && res.failures && res.failures.length) {
            msg += '\n\n失败明细（前 ' + Math.min(10, res.failures.length) + ' 条）：';
            res.failures.slice(0, 10).forEach(function(f) {
                msg += '\n• [#' + f.app_id + '] ' + (f.mc_name || '-') + '：' + f.message;
            });
            msg += '\n\n是否复制全部失败的备用命令到剪贴板？';
            if (confirm(msg)) {
                var lines = res.failures.map(function(f) { return f.command || ''; }).filter(Boolean);
                if (lines.length) copyText(lines.join('\n'));
            }
        } else {
            alert(msg);
        }
    }

    window.testRconConnection = function() {
        doUserAction('test_rcon', {}, function(res) {
            var success = res.status === 'success';
            var msg = res.message || (success ? 'RCON 连接成功' : 'RCON 连接失败');
            if (res.response) msg += '\n服务器返回：' + res.response;
            if (!success) {
                msg += '\n\n排查建议：';
                msg += '\n1. 确认 server.properties 已开启 enable-rcon=true';
                msg += '\n2. 确认 rcon.password 和后台密码一致';
                msg += '\n3. 确认 rcon.port 和后台端口一致，默认常见为 25575';
                msg += '\n4. 确认防火墙/安全组允许网站服务器访问该端口';
                msg += '\n5. 修改 server.properties 后需要重启 Minecraft 服务端';
            }
            alert(msg);
        }, { allowFailure: true });
    };

    // ---- 通用敏感字段 UI 辅助（RCON 密码 / SMTP 密码 / 雨云 API key 共用）----
    window.toggleSensitiveField = function(inputId) {
        var input = document.getElementById(inputId);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    };

    window.clearSensitiveField = function(inputId, hiddenId, hintId, confirmMsg) {
        if (confirmMsg && !confirm('确定保存后清除已保存的内容？\n\n' + confirmMsg + '。')) return;
        var hidden = document.getElementById(hiddenId);
        var input  = document.getElementById(inputId);
        var hint   = document.getElementById(hintId);
        if (hidden) hidden.value = '1';
        if (input)  { input.value = ''; input.disabled = true; input.placeholder = '保存后将清除'; }
        if (hint)   hint.style.display = 'block';
    };

    // ---- RCON 密码兼容层（保持旧 onclick 调用不破坏） ----
    window.toggleRconPasswordVisibility = function() {
        window.toggleSensitiveField('rconPasswordInput');
    };
    window.clearRconPassword = function() {
        window.clearSensitiveField('rconPasswordInput', 'rconPasswordClear', 'rconPasswordHint', '保存后自动同步将无法工作');
    };

    function getSelectedApplicationIds() {
        return Object.keys(_selectedApplicationIds).filter(function(id) { return _selectedApplicationIds[id]; }).map(function(id) { return parseInt(id, 10); });
    }

    function getSelectedApplications() {
        var ids = getSelectedApplicationIds();
        return _applicationsCache.filter(function(app) { return ids.indexOf(parseInt(app.id, 10)) !== -1; });
    }

    function updateApplicationsBatchBar() {
        var ids = getSelectedApplicationIds();
        var bar = document.getElementById('applicationsBatchBar');
        var count = document.getElementById('applicationsSelectedCount');
        if (count) count.textContent = ids.length;
        if (bar) bar.style.display = ids.length ? 'flex' : 'none';
        document.querySelectorAll('.application-batch-check').forEach(function(el) {
            var id = parseInt(el.getAttribute('data-app-id') || '0', 10);
            el.checked = !!_selectedApplicationIds[id];
        });
    }

    window.toggleApplicationSelected = function(appId, checked) {
        if (checked) {
            _selectedApplicationIds[appId] = true;
        } else {
            delete _selectedApplicationIds[appId];
        }
        updateApplicationsBatchBar();
    };

    window.selectAllVisibleApplications = function() {
        _applicationsCache.forEach(function(app) {
            _selectedApplicationIds[parseInt(app.id, 10)] = true;
        });
        updateApplicationsBatchBar();
    };

    window.clearSelectedApplications = function() {
        _selectedApplicationIds = {};
        updateApplicationsBatchBar();
    };

    window.copySelectedWhitelistCommands = function() {
        var apps = getSelectedApplications().filter(function(app) { return app.status === 'approved' && app.mc_name; });
        if (!apps.length) {
            alert('选中的申请中没有已通过且包含游戏 ID 的记录');
            return;
        }
        copyText(apps.map(function(app) { return app.whitelist_command || ('/vmc approve ' + app.mc_name); }).join('\n'));
    };

    window.batchReviewSelectedApplications = function(decision) {
        var labels = { approved: '通过', rejected: '拒绝', need_more_info: '需要补充信息' };
        var ids = getSelectedApplicationIds();
        if (!ids.length) {
            alert('请选择需要审核的申请');
            return;
        }
        var note = prompt('请输入批量审核备注（可留空）', '');
        if (note === null) return;
        if (!confirm('确定要批量「' + labels[decision] + '」' + ids.length + ' 个申请？')) return;
        doUserAction('batch_review_applications', {
            app_ids: ids,
            decision: decision,
            review_note: note
        }, function(res) {
            alert('批量审核已完成：' + (res.count || ids.length) + ' 个申请');
            clearSelectedApplications();
            loadApplicationsList(_appsPage);
            loadUsersList(_usersPage);
        });
    };

    window.batchMarkSelectedSynced = function(synced) {
        var apps = getSelectedApplications().filter(function(app) { return app.status === 'approved'; });
        if (!apps.length) {
            alert('请选择已通过的申请');
            return;
        }
        if (!confirm('确定要批量' + (synced ? '标记同步' : '取消同步') + ' ' + apps.length + ' 个申请？')) return;
        var index = 0;
        function next() {
            if (index >= apps.length) {
                alert('批量操作已完成');
                loadApplicationsList(_appsPage);
                return;
            }
            doUserAction('mark_application_synced', { app_id: apps[index].id, synced: synced }, function() {
                index++;
                next();
            });
        }
        next();
    };

    window.exportWhitelistCommands = function() {
        doUserAction('export_whitelist_commands', {}, function(res) {
            var text = res.text || '';
            if (!text) {
                alert('暂无已通过申请可导出');
                return;
            }
            copyText(text);
        });
    };

    window.reviewApplicationById = function(appId, decision) {
        var labels = { approved: '通过', rejected: '拒绝', need_more_info: '需要补充信息' };
        var noteInput = document.getElementById('appReviewNote' + appId);
        var note = noteInput ? (noteInput.value || '') : prompt('请输入审核备注（可留空）', '');
        if (note === null) return;
        if (!confirm('确定要「' + labels[decision] + '」该申请？')) return;
        doUserAction('review_application', { app_id: appId, decision: decision, review_note: note }, function() {
            loadApplicationsList(_appsPage);
            loadUsersList(_usersPage);
        });
    };

    window.saveApplicationEdit = function(appId) {
        doUserAction('update_application', {
            app_id: appId,
            mc_name: (document.getElementById('appMcName' + appId) || {}).value || '',
            age_range: (document.getElementById('appAgeRange' + appId) || {}).value || '',
            source: (document.getElementById('appSource' + appId) || {}).value || '',
            reason: (document.getElementById('appReason' + appId) || {}).value || '',
            review_note: (document.getElementById('appReviewNote' + appId) || {}).value || '',
            status: (document.getElementById('appStatus' + appId) || {}).value || 'pending'
        }, function() {
            alert('申请已更新');
            loadApplicationsList(_appsPage);
            loadUsersList(_usersPage);
        });
    };

    // 搜索和筛选事件
    document.addEventListener('DOMContentLoaded', function() {
        var searchInput = document.getElementById('userSearchInput');
        var statusFilter = document.getElementById('userStatusFilter');
        var appSearchInput = document.getElementById('appSearchInput');
        var appStatusFilter = document.getElementById('appStatusFilter');

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                clearTimeout(_usersSearchTimer);
                _usersSearchTimer = setTimeout(function() { loadUsersList(1); }, 400);
            });
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', function() { loadUsersList(1); });
        }
        if (appSearchInput) {
            appSearchInput.addEventListener('input', function() {
                clearTimeout(_usersSearchTimer);
                _usersSearchTimer = setTimeout(function() { loadApplicationsList(1); }, 400);
            });
        }
        if (appStatusFilter) {
            appStatusFilter.addEventListener('change', function() { loadApplicationsList(1); });
        }

        // 如果当前就在 users tab，立即加载
        var usersTab = document.getElementById('tab-users');
        if (usersTab && usersTab.style.display !== 'none') {
            loadUsersList(1);
        }
        var applicationsTab = document.getElementById('tab-applications');
        if (applicationsTab && applicationsTab.style.display !== 'none') {
            loadApplicationsList(1);
            startApplicationsPolling();
        }
        var announcementsTab = document.getElementById('tab-announcements');
        if (announcementsTab && announcementsTab.style.display !== 'none') {
            loadAnnouncementsList();
        }
        var ticketsTab = document.getElementById('tab-tickets');
        if (ticketsTab && ticketsTab.style.display !== 'none') {
            loadTicketsList();
            startTicketsPolling();
        }
        var logsTab = document.getElementById('tab-logs');
        if (logsTab && logsTab.style.display !== 'none') {
            loadUserLogs(1);
        }
        var riskTab = document.getElementById('tab-risk');
        if (riskTab && riskTab.style.display !== 'none') {
            loadRiskSummary();
        }

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                stopApplicationsPolling();
                stopTicketsPolling();
            } else if (isApplicationsTabVisible()) {
                loadApplicationsList(_appsPage);
                startApplicationsPolling();
                stopTicketsPolling();
            } else if (isTicketsTabVisible()) {
                loadTicketsList(true);
                startTicketsPolling();
                stopApplicationsPolling();
            }
        });
    });

    var origSwitchTabApplications = window.switchTab;
    window.switchTab = function(tabKey) {
        origSwitchTabApplications(tabKey);
        if (tabKey === 'applications') {
            loadApplicationsList(1);
            startApplicationsPolling();
            stopTicketsPolling();
        } else if (tabKey === 'announcements') {
            loadAnnouncementsList();
            stopApplicationsPolling();
            stopTicketsPolling();
        } else if (tabKey === 'tickets') {
            loadTicketsList();
            startTicketsPolling();
            stopApplicationsPolling();
        } else if (tabKey === 'logs') {
            loadUserLogs(1);
            stopApplicationsPolling();
            stopTicketsPolling();
        } else if (tabKey === 'risk') {
            loadRiskSummary();
            stopApplicationsPolling();
            stopTicketsPolling();
        } else {
            stopApplicationsPolling();
            stopTicketsPolling();
        }
    };
})();

// 标记画廊截图为删除状态（保存表单后生效）
window.markGalleryDelete = function(i) {
    if (!confirm('确定要删除截图 #' + (i + 1) + '？点击保存后才会生效。')) return;
    var section = document.getElementById('gallery-item-' + i);
    var flag = document.getElementById('gallery-del-' + i);
    var titleEl = document.getElementById('gallery-title-' + i);
    if (flag) flag.value = '1';
    if (titleEl) titleEl.textContent = '截图 ' + (i + 1) + '（将被删除）';
    if (section) {
        section.style.opacity = '0.45';
        section.style.pointerEvents = 'none';
        section.style.filter = 'grayscale(60%)';
    }
};
