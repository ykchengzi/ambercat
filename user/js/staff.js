/* ============================================================
 * 用户中心「工作台」前端逻辑
 * 仅在 window.userIsStaff === true 时由 panel.php 加载
 * 模块：StaffOverview / StaffMessages / StaffAnnouncements
 *       StaffTickets / StaffApplications
 * 风格：列表用 <details> 折叠，详情/编辑全部 inline 展开，避免弹窗堆叠
 * ============================================================ */
(function() {
    'use strict';

    // -------------------- 通用工具 --------------------
    var API = 'api/staff.php';
    function csrf() { return window.userCsrf || ''; }
    function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : s); return d.innerHTML; }
    function fmtTime(s) { return s ? String(s).slice(0, 16).replace('T', ' ') : '-'; }
    function toast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }

    function apiGet(action, params) {
        var qs = '?action=' + encodeURIComponent(action);
        if (params) for (var k in params) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
                qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            }
        }
        return fetch(API + qs, { credentials: 'same-origin' }).then(function(r) { return r.json(); });
    }
    function apiPost(action, data) {
        var fd;
        if (data instanceof FormData) {
            fd = data;
            fd.set('action', action);
            fd.set('csrf', csrf());
        } else {
            fd = new FormData();
            fd.append('action', action);
            fd.append('csrf', csrf());
            if (data) for (var k in data) fd.append(k, data[k]);
        }
        return fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function(r) { return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error(t.slice(0, 200) || 'invalid response'); } }); });
    }

    function renderPager(container, page, pages, onClick) {
        if (!container) return;
        if (pages <= 1) { container.innerHTML = ''; return; }
        var html = '';
        var max = Math.min(pages, 12);
        html += '<button ' + (page <= 1 ? 'disabled' : '') + ' data-p="' + (page - 1) + '">上一页</button>';
        for (var i = 1; i <= max; i++) html += '<button class="' + (i === page ? 'active' : '') + '" data-p="' + i + '">' + i + '</button>';
        if (pages > max) html += '<span style="padding:6px 8px;color:#94a3b8;">…/' + pages + '</span>';
        html += '<button ' + (page >= pages ? 'disabled' : '') + ' data-p="' + (page + 1) + '">下一页</button>';
        container.innerHTML = html;
        container.querySelectorAll('button[data-p]').forEach(function(b) {
            b.addEventListener('click', function() {
                var p = parseInt(b.dataset.p, 10);
                if (p >= 1 && p <= pages) onClick(p);
            });
        });
    }

    function emptyRow(text) {
        return '<div class="empty-row">' + esc(text) + '</div>';
    }

    // -------------------- 灯箱（图片放大预览） --------------------
    var Lightbox = (function() {
        var el = null, imgEl = null;
        function ensure() {
            if (el) return;
            el = document.createElement('div');
            el.className = 'staff-lightbox';
            el.innerHTML =
                '<img alt="预览">' +
                '<button type="button" class="staff-lightbox-close" aria-label="关闭">&times;</button>';
            el.addEventListener('click', function(e) {
                if (e.target === el || e.target.classList.contains('staff-lightbox-close')) close();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && el && el.classList.contains('open')) close();
            });
            document.body.appendChild(el);
            imgEl = el.querySelector('img');
        }
        function open(src) {
            ensure();
            imgEl.src = src;
            el.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function close() {
            if (!el) return;
            el.classList.remove('open');
            imgEl.src = '';
            document.body.style.overflow = '';
        }
        return { open: open, close: close };
    })();

    function debounce(fn, ms) {
        var t;
        return function() {
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function() { fn.apply(ctx, args); }, ms || 350);
        };
    }

    // ============================================================
    //  概览
    // ============================================================
    var StaffOverview = {
        load: function() {
            apiGet('overview').then(function(res) {
                if (res.status !== 'success') { toast(res.message || '加载失败', 'error'); return; }
                var stats = res.data || {};
                document.querySelectorAll('#staffOverviewStats [data-key]').forEach(function(el) {
                    el.textContent = stats[el.dataset.key] != null ? stats[el.dataset.key] : '0';
                });
            }).catch(function() { toast('加载概览失败', 'error'); });

            document.querySelectorAll('#staffOverviewStats .staff-stat-card').forEach(function(c) {
                if (c.dataset.bound) return;
                c.dataset.bound = '1';
                c.addEventListener('click', function() {
                    var t = c.dataset.target;
                    if (t && window.switchUserTab) window.switchUserTab(t);
                });
            });
        }
    };

    // ============================================================
    //  联系留言
    // ============================================================
    var StaffMessages = {
        page: 1,
        bound: false,
        bind: function() {
            if (this.bound) return; this.bound = true;
            var self = this;
            var s = document.getElementById('staffMsgSearch');
            var f = document.getElementById('staffMsgFilter');
            if (s) s.addEventListener('input', debounce(function() { self.load(1); }));
            if (f) f.addEventListener('change', function() { self.load(1); });
        },
        load: function(page) {
            this.bind();
            this.page = page || 1;
            var list = document.getElementById('staffMsgList');
            var pager = document.getElementById('staffMsgPager');
            if (!list) return;
            list.innerHTML = '<div class="empty-row">加载中…</div>';
            var search = (document.getElementById('staffMsgSearch') || {}).value || '';
            var filter = (document.getElementById('staffMsgFilter') || {}).value || '';
            apiGet('messages_list', { page: this.page, search: search, filter: filter }).then(function(res) {
                if (res.status !== 'success') { list.innerHTML = emptyRow(res.message || '加载失败'); return; }
                StaffMessages.render(res.rows || [], list);
                renderPager(pager, res.page, res.pages, function(p) { StaffMessages.load(p); });
            }).catch(function() { list.innerHTML = emptyRow('加载失败'); });
        },
        render: function(rows, list) {
            if (!rows.length) { list.innerHTML = emptyRow('暂无留言'); return; }
            var html = '';
            rows.forEach(function(m) {
                var unread = parseInt(m.is_read, 10) === 0;
                var replied = parseInt(m.is_replied, 10) === 1;
                var statusBadge = unread ? '<span class="staff-badge b-amber">未读</span>'
                                         : '<span class="staff-badge b-gray">已读</span>';
                var replyBadge = replied ? '<span class="staff-badge b-green">已回复</span>' : '';
                var preview = (m.message || '').replace(/\s+/g, ' ').slice(0, 60);

                var imagesHtml = '';
                var imgs = Array.isArray(m.images) ? m.images : [];
                if (imgs.length) {
                    imagesHtml = '<div class="staff-msg-images">';
                    imgs.forEach(function(img) {
                        var url = '../' + String(img).replace(/^\/+/, '');
                        imagesHtml += '<button type="button" class="staff-msg-thumb" data-lightbox="' + esc(url) + '"><img src="' + esc(url) + '" alt="附件" loading="lazy"></button>';
                    });
                    imagesHtml += '</div>';
                }

                html += '<details class="staff-row" data-id="' + m.id + '">'
                     +   '<summary>'
                     +     '<div class="row-main">'
                     +       '<span class="row-title">' + esc(m.name || '匿名') + ' · ' + esc(m.subject || '(无主题)') + '</span>'
                     +       statusBadge + replyBadge
                     +       (imgs.length ? '<span class="staff-badge b-blue">' + imgs.length + ' 张图片</span>' : '')
                     +       '<span class="row-sub">' + esc(preview) + (preview.length >= 60 ? '…' : '') + '</span>'
                     +     '</div>'
                     +     '<span class="row-meta">' + esc(fmtTime(m.created_at)) + '</span>'
                     +   '</summary>'
                     +   '<div class="row-body">'
                     +     '<div style="font-size:.84em;color:#64748b;">来自：' + esc(m.name) + ' &lt;' + esc(m.email) + '&gt;</div>'
                     +     '<div class="body-content">' + esc(m.message) + '</div>'
                     +     imagesHtml
                     +     '<div class="staff-reply-form" data-msg-id="' + m.id + '">'
                     +       '<label>邮件回复（通过后台 SMTP 发送至 ' + esc(m.email) + '）</label>'
                     +       '<textarea data-role="reply" rows="4" maxlength="5000" placeholder="支持纯文本，将以邮件形式发送给用户。"></textarea>'
                     +       '<div class="staff-reply-attach">'
                     +         '<label class="btn-secondary staff-reply-attach-btn">'
                     +           '<span>+ 添加图片附件</span>'
                     +           '<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple data-role="attach" hidden>'
                     +         '</label>'
                     +         '<span class="staff-reply-attach-hint" data-role="attach-hint">≤5MB/张，最多 5 张</span>'
                     +       '</div>'
                     +       '<div class="staff-reply-attach-list" data-role="attach-list"></div>'
                     +     '</div>'
                     +     '<div class="row-actions">'
                     +       '<button class="btn-primary" data-act="reply">发送邮件回复</button>'
                     +       (unread ? '<button class="btn-secondary" data-act="read">标记已读</button>' : '')
                     +       '<button class="btn-danger" data-act="del">删除</button>'
                     +     '</div>'
                     +   '</div>'
                     + '</details>';
            });
            list.innerHTML = html;
            list.querySelectorAll('.staff-row').forEach(function(row) {
                var id = row.dataset.id;
                StaffMessages._bindAttach(row);
                row.querySelectorAll('button[data-act]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (btn.dataset.act === 'read')  StaffMessages.markRead(id);
                        if (btn.dataset.act === 'del')   StaffMessages.del(id);
                        if (btn.dataset.act === 'reply') StaffMessages.reply(id, row, btn);
                    });
                });
                row.querySelectorAll('.staff-msg-thumb[data-lightbox]').forEach(function(thumb) {
                    thumb.addEventListener('click', function() { Lightbox.open(thumb.dataset.lightbox); });
                });
            });
        },
        _attachMap: {}, // msgId -> File[]
        _bindAttach: function(row) {
            var self = this;
            var id = row.dataset.id;
            var input = row.querySelector('input[data-role="attach"]');
            if (!input) return;
            input.addEventListener('change', function() {
                var bucket = self._attachMap[id] || [];
                var max = 5;
                var maxSize = 5 * 1024 * 1024;
                for (var i = 0; i < input.files.length && bucket.length < max; i++) {
                    var f = input.files[i];
                    if (f.size > maxSize) { toast(f.name + ' 超过 5MB，已跳过', 'error'); continue; }
                    if (!/^image\//.test(f.type)) { toast(f.name + ' 不是图片，已跳过', 'error'); continue; }
                    bucket.push(f);
                }
                self._attachMap[id] = bucket;
                input.value = '';
                self._renderAttachList(row);
            });
        },
        _renderAttachList: function(row) {
            var self = this;
            var id = row.dataset.id;
            var list = row.querySelector('[data-role="attach-list"]');
            var hint = row.querySelector('[data-role="attach-hint"]');
            if (!list) return;
            var files = self._attachMap[id] || [];
            list.innerHTML = '';
            files.forEach(function(f, i) {
                var item = document.createElement('span');
                item.className = 'staff-reply-attach-item';
                item.innerHTML = esc(f.name) + ' <button type="button" data-rm="' + i + '" aria-label="移除">×</button>';
                list.appendChild(item);
            });
            list.querySelectorAll('button[data-rm]').forEach(function(b) {
                b.addEventListener('click', function() {
                    var idx = parseInt(b.dataset.rm, 10);
                    (self._attachMap[id] || []).splice(idx, 1);
                    self._renderAttachList(row);
                });
            });
            if (hint) hint.textContent = files.length ? ('已选 ' + files.length + ' / 5 张') : '≤5MB/张，最多 5 张';
        },
        reply: function(id, row, btn) {
            var ta = row.querySelector('textarea[data-role="reply"]');
            var content = (ta ? ta.value : '').trim();
            if (!content) { toast('请填写回复内容', 'error'); return; }
            var fd = new FormData();
            fd.append('id', id);
            fd.append('reply_content', content);
            var files = StaffMessages._attachMap[id] || [];
            files.forEach(function(f, i) { fd.append('reply_image_' + i, f); });
            if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }
            apiPost('messages_reply', fd).then(function(res) {
                toast(res.message || (res.status === 'success' ? '已发送' : '发送失败'),
                      res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') {
                    delete StaffMessages._attachMap[id];
                    StaffMessages.load(StaffMessages.page);
                } else if (btn) {
                    btn.disabled = false; btn.textContent = '发送邮件回复';
                }
            }).catch(function(err) {
                toast(err && err.message ? err.message : '发送失败', 'error');
                if (btn) { btn.disabled = false; btn.textContent = '发送邮件回复'; }
            });
        },
        markRead: function(id) {
            apiPost('messages_mark_read', { id: id }).then(function(res) {
                toast(res.message || '已标记', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') StaffMessages.load(StaffMessages.page);
            });
        },
        del: function(id) {
            if (!confirm('确定删除这条留言？此操作不可撤销。')) return;
            apiPost('messages_delete', { id: id }).then(function(res) {
                toast(res.message || '已删除', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') StaffMessages.load(StaffMessages.page);
            });
        }
    };

    // ============================================================
    //  公告
    // ============================================================
    var levelLabels = { info: '普通', success: '活动', warning: '维护', danger: '紧急' };
    var levelClass = { info: 'b-blue', success: 'b-green', warning: 'b-amber', danger: 'b-red' };

    var StaffAnnouncements = {
        load: function() {
            var list = document.getElementById('staffAnnList');
            if (!list) return;
            list.innerHTML = emptyRow('加载中…');
            apiGet('announcements_list').then(function(res) {
                if (res.status !== 'success') { list.innerHTML = emptyRow(res.message || '加载失败'); return; }
                StaffAnnouncements.render(res.rows || [], list);
            }).catch(function() { list.innerHTML = emptyRow('加载失败'); });
        },
        render: function(rows, list) {
            if (!rows.length) { list.innerHTML = emptyRow('暂无公告，点击上方「+ 新建公告」开始'); return; }
            var html = '';
            rows.forEach(function(a) {
                var lvKey = a.level || 'info';
                var lvCls = levelClass[lvKey] || 'b-gray';
                var lvLabel = levelLabels[lvKey] || lvKey;
                var stateBadge = parseInt(a.is_active, 10) === 1
                    ? '<span class="staff-badge b-green">已上线</span>'
                    : '<span class="staff-badge b-gray">已下线</span>';
                var pinBadge = parseInt(a.is_pinned, 10) === 1 ? '<span class="staff-badge b-amber">置顶</span>' : '';
                html += '<details class="staff-row" data-id="' + a.id + '">'
                     +   '<summary>'
                     +     '<div class="row-main">'
                     +       '<span class="row-title">' + esc(a.title) + '</span>'
                     +       '<span class="staff-badge ' + lvCls + '">' + lvLabel + '</span>'
                     +       stateBadge + pinBadge
                     +     '</div>'
                     +     '<span class="row-meta">' + esc(fmtTime(a.created_at)) + '</span>'
                     +   '</summary>'
                     +   '<div class="row-body">'
                     +     '<div class="body-content">' + esc(a.content) + '</div>'
                     +     '<div class="row-actions">'
                     +       '<button class="btn-primary" data-act="edit">编辑</button>'
                     +       '<button class="btn-danger" data-act="del">删除</button>'
                     +     '</div>'
                     +   '</div>'
                     + '</details>';
            });
            list.innerHTML = html;
            // 缓存数据供编辑使用
            this._cache = {};
            var self = this;
            rows.forEach(function(a) { self._cache[a.id] = a; });
            list.querySelectorAll('.staff-row').forEach(function(row) {
                var id = row.dataset.id;
                row.querySelectorAll('button[data-act]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (btn.dataset.act === 'edit') StaffAnnouncements.openEditor(id);
                        if (btn.dataset.act === 'del')  StaffAnnouncements.del(id);
                    });
                });
            });
        },
        openEditor: function(id) {
            var box = document.getElementById('staffAnnEditor');
            if (!box) return;
            var data = (id != null && this._cache && this._cache[id]) || {};
            var levels = ['info', 'success', 'warning', 'danger'];
            var levelOptions = levels.map(function(lv) {
                return '<option value="' + lv + '"' + ((data.level || 'info') === lv ? ' selected' : '') + '>' + (levelLabels[lv] || lv) + '</option>';
            }).join('');
            box.style.display = 'flex';
            box.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'
                +   '<strong>' + (id ? '编辑公告 #' + id : '新建公告') + '</strong>'
                +   '<button class="btn-secondary" data-act="close">取消</button>'
                + '</div>'
                + '<label>标题</label><input type="text" id="annTitle" maxlength="120" value="' + esc(data.title || '') + '">'
                + '<label>内容（最多 5000 字）</label><textarea id="annContent" maxlength="5000" rows="5">' + esc(data.content || '') + '</textarea>'
                + '<div class="field-row">'
                +   '<div><label>级别</label><select id="annLevel">' + levelOptions + '</select></div>'
                +   '<div><label>定时发布（可选）</label><input type="datetime-local" id="annPublishAt" value="' + esc((data.publish_at || '').replace(' ', 'T').slice(0, 16)) + '"></div>'
                +   '<div><label>开始时间</label><input type="datetime-local" id="annStartAt" value="' + esc((data.start_at || '').replace(' ', 'T').slice(0, 16)) + '"></div>'
                +   '<div><label>结束时间</label><input type="datetime-local" id="annEndAt" value="' + esc((data.end_at || '').replace(' ', 'T').slice(0, 16)) + '"></div>'
                + '</div>'
                + '<div class="checkbox-row">'
                +   '<label><input type="checkbox" id="annActive"  ' + (parseInt(data.is_active, 10) === 1 || !id ? 'checked' : '') + '> 上线显示</label>'
                +   '<label><input type="checkbox" id="annPinned"  ' + (parseInt(data.is_pinned, 10) === 1 ? 'checked' : '') + '> 置顶</label>'
                +   '<label><input type="checkbox" id="annHome"    ' + (parseInt(data.show_in_home, 10) === 1 ? 'checked' : '') + '> 显示在首页</label>'
                +   '<label><input type="checkbox" id="annUserCenter" ' + (parseInt(data.show_in_user_center, 10) === 1 || !id ? 'checked' : '') + '> 显示在用户中心</label>'
                +   '<label><input type="checkbox" id="annPopup"   ' + (parseInt(data.show_as_popup, 10) === 1 ? 'checked' : '') + '> 弹窗提醒</label>'
                + '</div>'
                + '<div class="row-actions">'
                +   '<button class="btn-primary" data-act="save">保存</button>'
                + '</div>';
            box.querySelector('button[data-act="close"]').addEventListener('click', function() { box.style.display = 'none'; });
            box.querySelector('button[data-act="save"]').addEventListener('click', function() { StaffAnnouncements.save(id); });
        },
        save: function(id) {
            var v = function(sel) { var el = document.getElementById(sel); return el ? el.value : ''; };
            var ck = function(sel) { var el = document.getElementById(sel); return el && el.checked ? '1' : ''; };
            var data = {
                id: id || '',
                title: v('annTitle'),
                content: v('annContent'),
                level: v('annLevel'),
                publish_at: v('annPublishAt').replace('T', ' '),
                start_at: v('annStartAt').replace('T', ' '),
                end_at: v('annEndAt').replace('T', ' '),
                is_active: ck('annActive'),
                is_pinned: ck('annPinned'),
                show_in_home: ck('annHome'),
                show_in_user_center: ck('annUserCenter'),
                show_as_popup: ck('annPopup')
            };
            if (!data.title.trim()) { toast('请填写标题', 'error'); return; }
            if (!data.content.trim()) { toast('请填写内容', 'error'); return; }
            apiPost('announcements_save', data).then(function(res) {
                toast(res.message || '已保存', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') {
                    var box = document.getElementById('staffAnnEditor');
                    if (box) box.style.display = 'none';
                    StaffAnnouncements.load();
                }
            });
        },
        del: function(id) {
            if (!confirm('确定删除这条公告？此操作不可撤销。')) return;
            apiPost('announcements_delete', { id: id }).then(function(res) {
                toast(res.message || '已删除', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') StaffAnnouncements.load();
            });
        }
    };

    // ============================================================
    //  工单
    // ============================================================
    var ticketStatusBadge = function(s) {
        var map = { open: ['处理中', 'b-amber'], replied: ['已回复', 'b-blue'], closed: ['已关闭', 'b-gray'] };
        var v = map[s] || [s, 'b-gray'];
        return '<span class="staff-badge ' + v[1] + '">' + v[0] + '</span>';
    };

    var StaffTickets = {
        page: 1,
        bound: false,
        bind: function() {
            if (this.bound) return; this.bound = true;
            var self = this;
            var f = document.getElementById('staffTicketFilter');
            if (f) f.addEventListener('change', function() { self.load(1); });
        },
        load: function(page) {
            this.bind();
            this.page = page || 1;
            var list = document.getElementById('staffTicketList');
            var pager = document.getElementById('staffTicketPager');
            if (!list) return;
            list.innerHTML = emptyRow('加载中…');
            var status = (document.getElementById('staffTicketFilter') || {}).value || '';
            apiGet('tickets_list', { page: this.page, status: status }).then(function(res) {
                if (res.status !== 'success') { list.innerHTML = emptyRow(res.message || '加载失败'); return; }
                StaffTickets.render(res.rows || [], list);
                renderPager(pager, res.page, res.pages, function(p) { StaffTickets.load(p); });
            }).catch(function() { list.innerHTML = emptyRow('加载失败'); });
        },
        render: function(rows, list) {
            if (!rows.length) { list.innerHTML = emptyRow('暂无工单'); return; }
            var html = '';
            var catLabels = { report: '举报', bug: 'Bug', appeal: '申诉', suggestion: '建议', other: '其他' };
            var prioLabels = { low: '低', normal: '中', high: '高' };
            rows.forEach(function(t) {
                html += '<details class="staff-row" data-id="' + t.id + '">'
                     +   '<summary>'
                     +     '<div class="row-main">'
                     +       '<span class="row-title">#' + t.id + ' ' + esc(t.subject) + '</span>'
                     +       '<span class="staff-badge b-gray">' + esc(catLabels[t.category] || t.category || '') + '</span>'
                     +       (t.priority === 'high' ? '<span class="staff-badge b-red">' + prioLabels.high + '优先级</span>' : '')
                     +       ticketStatusBadge(t.status)
                     +       '<span class="row-sub">提交人：' + esc(t.username || '-') + '</span>'
                     +     '</div>'
                     +     '<span class="row-meta">' + esc(fmtTime(t.updated_at || t.created_at)) + '</span>'
                     +   '</summary>'
                     +   '<div class="row-body" data-loaded="0"><div class="empty-row">展开后加载详情…</div></div>'
                     + '</details>';
            });
            list.innerHTML = html;
            list.querySelectorAll('.staff-row').forEach(function(row) {
                row.addEventListener('toggle', function() {
                    if (row.open && row.querySelector('.row-body').dataset.loaded === '0') {
                        StaffTickets.openDetail(row);
                    }
                });
            });
        },
        // ticketId -> 已选文件数组（在 openDetail 重渲染时保留，发送成功后清空）
        _attachMap: {},
        // 渲染单条对话的附件区（图片缩略图 + 非图片下载链接）
        _renderMsgAttachments: function(atts) {
            if (!atts || !atts.length) return '';
            var items = atts.map(function(a) {
                var url = a.web_url || '';
                if (!url) return '';
                var name = esc(a.original_name || '附件');
                var size = esc(a.size_label || '');
                if (a.is_image) {
                    return '<a class="ticket-attachment-image" href="' + esc(url) + '" data-lightbox="' + esc(url) + '" title="' + name + '" style="display:inline-block;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;line-height:0;background:#f8fafc;">' +
                        '<img src="' + esc(url) + '" alt="' + name + '" loading="lazy" style="max-width:160px;max-height:120px;display:block;object-fit:cover;"></a>';
                }
                return '<a href="' + esc(url) + '" target="_blank" rel="noopener" download style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#334155;text-decoration:none;font-size:.88em;">' +
                    '<span>📎</span><span>' + name + '</span><span style="color:#94a3b8;">' + size + '</span></a>';
            }).join('');
            return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">' + items + '</div>';
        },
        // 渲染回复表单内"已选文件"标签
        _renderAttachList: function(body, ticketId) {
            var list = body.querySelector('[data-role="attach-list"]');
            var hint = body.querySelector('[data-role="attach-hint"]');
            if (!list) return;
            var files = StaffTickets._attachMap[ticketId] || [];
            list.innerHTML = '';
            files.forEach(function(f, i) {
                var item = document.createElement('span');
                item.className = 'ticket-attach-item';
                item.innerHTML = '<span>' + esc(f.name) + '</span><button type="button" data-rm="' + i + '" aria-label="移除">×</button>';
                list.appendChild(item);
            });
            list.querySelectorAll('button[data-rm]').forEach(function(b) {
                b.addEventListener('click', function() {
                    var idx = parseInt(b.dataset.rm, 10);
                    (StaffTickets._attachMap[ticketId] || []).splice(idx, 1);
                    StaffTickets._renderAttachList(body, ticketId);
                });
            });
            if (hint) {
                if (files.length) {
                    hint.classList.remove('over-limit');
                    hint.textContent = '已选 ' + files.length + ' / 5 个，单个 ≤ 10MB';
                } else {
                    hint.classList.remove('over-limit');
                    hint.textContent = '最多 5 个，单个 ≤ 10MB（图片/PDF/文本/压缩包等）';
                }
            }
        },
        _bindAttach: function(body, ticketId) {
            var input = body.querySelector('input[data-role="attach"]');
            if (!input) return;
            input.addEventListener('change', function() {
                var bucket = StaffTickets._attachMap[ticketId] || [];
                var maxFiles = 5;
                var maxSize  = 10 * 1024 * 1024;
                for (var i = 0; i < input.files.length && bucket.length < maxFiles; i++) {
                    var f = input.files[i];
                    if (f.size > maxSize) { toast(f.name + ' 超过 10MB，已跳过', 'error'); continue; }
                    bucket.push(f);
                }
                StaffTickets._attachMap[ticketId] = bucket;
                input.value = '';
                StaffTickets._renderAttachList(body, ticketId);
            });
        },
        openDetail: function(row) {
            var id = row.dataset.id;
            var body = row.querySelector('.row-body');
            body.innerHTML = '<div class="empty-row">加载中…</div>';
            apiGet('tickets_get', { id: id }).then(function(res) {
                if (res.status !== 'success') { body.innerHTML = emptyRow(res.message || '加载失败'); return; }
                var t = res.ticket;
                var html = '';
                html += '<div style="font-size:.84em;color:#64748b;">提交人：' + esc(t.username || '-') + ' &lt;' + esc(t.email || '') + '&gt; · 提交时间：' + esc(fmtTime(t.created_at)) + '</div>';
                html += '<div class="staff-conv">';
                var replies = res.replies || [];
                if (!replies.length) {
                    // 兜底：极少数老数据可能没有首条用户回复，回退展示工单正文 + 工单级附件
                    html += '<div class="staff-msg from-user"><div class="msg-meta">用户 · ' + esc(fmtTime(t.created_at)) + '</div><div class="msg-content">' + (t.content_html || esc(t.content)) + '</div>' + StaffTickets._renderMsgAttachments(t.attachments || []) + '</div>';
                }
                replies.forEach(function(r) {
                    var cls = r.author_type === 'admin' ? 'from-admin' : 'from-user';
                    var label = r.author_type === 'admin' ? '管理员/工作人员' : '用户';
                    html += '<div class="staff-msg ' + cls + '"><div class="msg-meta">' + label + ' · ' + esc(fmtTime(r.created_at)) + '</div><div class="msg-content">' + (r.content_html || esc(r.content)) + '</div>' + StaffTickets._renderMsgAttachments(r.attachments || []) + '</div>';
                });
                html += '</div>';
                if (t.status !== 'closed') {
                    html += '<label>回复内容（最多 5000 字）</label>';
                    html += '<textarea data-role="reply" class="rich-text-source" rows="4" placeholder="支持富文本：粗体/斜体/列表/引用/链接等，会自动通过站内通知和邮件提醒用户"></textarea>';
                    // 附件上传区
                    html += '<div class="ticket-attach-row">'
                          +   '<label class="ticket-attach-btn">'
                          +     '<span>📎 添加附件</span>'
                          +     '<input type="file" data-role="attach" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.log,.json,.zip,.mp4,.mp3,image/*" hidden>'
                          +   '</label>'
                          +   '<span class="ticket-attach-hint" data-role="attach-hint">最多 5 个，单个 ≤ 10MB（图片/PDF/文本/压缩包等）</span>'
                          + '</div>'
                          + '<div class="ticket-attach-list" data-role="attach-list"></div>';
                    html += '<div class="row-actions">'
                          + '<button class="btn-primary" data-act="reply">发送回复</button>'
                          + '<button class="btn-secondary" data-act="close">关闭工单</button>'
                          + '</div>';
                } else {
                    html += '<div class="row-actions"><button class="btn-secondary" data-act="reopen">重新打开</button></div>';
                }
                body.innerHTML = html;
                body.dataset.loaded = '1';
                // 初始化富文本编辑器（统一编辑器，来自 user/js/richtext.js）
                if (typeof window.initRichTextEditors === 'function') {
                    window.initRichTextEditors(body);
                }
                if (t.status !== 'closed') {
                    StaffTickets._bindAttach(body, id);
                    StaffTickets._renderAttachList(body, id);
                }
                body.querySelectorAll('button[data-act]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var act = btn.dataset.act;
                        if (act === 'reply')  StaffTickets.reply(id, body, btn);
                        if (act === 'close')  StaffTickets.setStatus(id, 'closed');
                        if (act === 'reopen') StaffTickets.setStatus(id, 'open');
                    });
                });
            }).catch(function() { body.innerHTML = emptyRow('加载失败'); });
        },
        reply: function(id, body, btn) {
            // 富文本编辑器：先同步内容到 textarea，再读取
            if (typeof window.syncRichTextEditors === 'function') {
                window.syncRichTextEditors(body);
            }
            var ta = body.querySelector('textarea[data-role="reply"]');
            var content = (ta ? ta.value : '').trim();
            // 编辑器空态可能是 <p><br></p> 之类，仅当去除标签后无文字也判定为空
            var textOnly = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
            var files = StaffTickets._attachMap[id] || [];
            if (!textOnly && !files.length) { toast('请填写回复内容或添加附件', 'error'); return; }
            var fd = new FormData();
            fd.append('ticket_id', id);
            fd.append('content', content);
            files.forEach(function(f) { fd.append('attachments[]', f); });
            if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }
            apiPost('tickets_reply', fd).then(function(res) {
                toast(res.message || '已发送', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') {
                    delete StaffTickets._attachMap[id];
                    body.dataset.loaded = '0';
                    var row = body.parentElement; if (row) StaffTickets.openDetail(row);
                } else if (btn) {
                    btn.disabled = false; btn.textContent = '发送回复';
                }
            }).catch(function() {
                toast('发送失败，请稍后重试', 'error');
                if (btn) { btn.disabled = false; btn.textContent = '发送回复'; }
            });
        },
        setStatus: function(id, status) {
            var label = { open: '重新打开', closed: '关闭' }[status] || status;
            if (!confirm('确定要' + label + '该工单？')) return;
            apiPost('tickets_update_status', { ticket_id: id, status: status }).then(function(res) {
                toast(res.message || '已更新', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') StaffTickets.load(StaffTickets.page);
            });
        }
    };

    // ============================================================
    //  入服申请
    // ============================================================
    var appStatusBadge = function(s) {
        var map = {
            pending: ['待审核', 'b-amber'], approved: ['已通过', 'b-green'],
            rejected: ['已拒绝', 'b-red'], need_more_info: ['需补充', 'b-blue']
        };
        var v = map[s] || [s, 'b-gray'];
        return '<span class="staff-badge ' + v[1] + '">' + v[0] + '</span>';
    };

    var StaffApplications = {
        page: 1,
        bound: false,
        bind: function() {
            if (this.bound) return; this.bound = true;
            var self = this;
            var s = document.getElementById('staffAppSearch');
            var f = document.getElementById('staffAppFilter');
            if (s) s.addEventListener('input', debounce(function() { self.load(1); }));
            if (f) f.addEventListener('change', function() { self.load(1); });
        },
        load: function(page) {
            this.bind();
            this.page = page || 1;
            var list = document.getElementById('staffAppList');
            var pager = document.getElementById('staffAppPager');
            if (!list) return;
            list.innerHTML = emptyRow('加载中…');
            var search = (document.getElementById('staffAppSearch') || {}).value || '';
            var status = (document.getElementById('staffAppFilter') || {}).value || '';
            apiGet('applications_list', { page: this.page, search: search, status: status }).then(function(res) {
                if (res.status !== 'success') { list.innerHTML = emptyRow(res.message || '加载失败'); return; }
                StaffApplications.render(res.rows || [], list);
                renderPager(pager, res.page, res.pages, function(p) { StaffApplications.load(p); });
            }).catch(function() { list.innerHTML = emptyRow('加载失败'); });
        },
        render: function(rows, list) {
            if (!rows.length) { list.innerHTML = emptyRow('暂无申请'); return; }
            var html = '';
            rows.forEach(function(a) {
                html += '<details class="staff-row" data-id="' + a.id + '" data-status="' + esc(a.status) + '">'
                     +   '<summary>'
                     +     '<div class="row-main">'
                     +       '<span class="row-title">' + esc(a.username || '-') + ' · MC: ' + esc(a.mc_name || '-') + '</span>'
                     +       appStatusBadge(a.status)
                     +       '<span class="row-sub">' + esc(a.email || '') + '</span>'
                     +     '</div>'
                     +     '<span class="row-meta">' + esc(fmtTime(a.created_at)) + '</span>'
                     +   '</summary>'
                     +   '<div class="row-body" data-loaded="0"><div class="empty-row">展开后加载详情…</div></div>'
                     + '</details>';
            });
            list.innerHTML = html;
            list.querySelectorAll('.staff-row').forEach(function(row) {
                row.addEventListener('toggle', function() {
                    if (row.open && row.querySelector('.row-body').dataset.loaded === '0') {
                        StaffApplications.openDetail(row);
                    }
                });
            });
        },
        openDetail: function(row) {
            var id = row.dataset.id;
            var body = row.querySelector('.row-body');
            body.innerHTML = '<div class="empty-row">加载中…</div>';
            apiGet('applications_get', { id: id }).then(function(res) {
                if (res.status !== 'success') { body.innerHTML = emptyRow(res.message || '加载失败'); return; }
                var a = res.application;
                var html = '';
                html += '<div style="display:grid;grid-template-columns:90px 1fr;gap:6px 12px;font-size:.88em;">';
                html += '<span style="color:#94a3b8;">用户名</span><span>' + esc(a.username || '-') + '</span>';
                html += '<span style="color:#94a3b8;">邮箱</span><span>' + esc(a.email || '-') + '</span>';
                html += '<span style="color:#94a3b8;">游戏ID</span><span>' + esc(a.mc_name || '-') + '</span>';
                html += '<span style="color:#94a3b8;">年龄段</span><span>' + esc(a.age_range || '-') + '</span>';
                html += '<span style="color:#94a3b8;">来源</span><span>' + esc(a.source || '-') + '</span>';
                html += '<span style="color:#94a3b8;">提交时间</span><span>' + esc(fmtTime(a.created_at)) + '</span>';
                html += '<span style="color:#94a3b8;">当前状态</span><span>' + appStatusBadge(a.status) + '</span>';
                if (a.reviewed_at) {
                    html += '<span style="color:#94a3b8;">审核时间</span><span>' + esc(fmtTime(a.reviewed_at)) + '</span>';
                    html += '<span style="color:#94a3b8;">审核人</span><span>' + esc(a.reviewed_by || '-') + '</span>';
                }
                html += '</div>';
                html += '<label>申请原因</label><div class="body-content">' + esc(a.reason || '') + '</div>';
                if (a.review_note) {
                    html += '<label>历史备注</label><div class="body-content" style="background:#fffbeb;border-color:#fde68a;">' + esc(a.review_note) + '</div>';
                }
                if (a.status === 'pending' || a.status === 'need_more_info') {
                    html += '<label>审核备注（可选，会写入用户通知）</label>';
                    html += '<textarea data-role="note" rows="3" placeholder="例如：账号信息核实通过 / 需要你补充正脸照片..."></textarea>';
                    html += '<div class="row-actions">'
                          + '<button class="btn-primary" data-act="approved">通过</button>'
                          + '<button class="btn-danger" data-act="rejected">拒绝</button>'
                          + '<button class="btn-secondary" data-act="need_more_info">需补充</button>'
                          + '</div>';
                } else {
                    html += '<div class="row-actions"><span style="color:#94a3b8;font-size:.85em;">该申请已审核完毕。如需更改，请联系站长。</span></div>';
                }
                body.innerHTML = html;
                body.dataset.loaded = '1';
                body.querySelectorAll('button[data-act]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        StaffApplications.review(id, btn.dataset.act, body);
                    });
                });
            }).catch(function() { body.innerHTML = emptyRow('加载失败'); });
        },
        review: function(id, decision, body) {
            var note = (body.querySelector('textarea[data-role="note"]') || {}).value || '';
            var labels = { approved: '通过', rejected: '拒绝', need_more_info: '需补充' };
            if (!confirm('确定要将该申请「' + (labels[decision] || decision) + '」？\n通过/拒绝会自动通知用户并尝试 RCON 同步白名单。')) return;
            apiPost('applications_review', { app_id: id, decision: decision, review_note: note }).then(function(res) {
                toast(res.message || '已完成', res.status === 'success' ? 'success' : 'error');
                if (res.status === 'success') StaffApplications.load(StaffApplications.page);
            });
        }
    };

    // -------------------- 暴露 + tab 钩子 --------------------
    window.StaffOverview     = StaffOverview;
    window.staffMessages     = StaffMessages;
    window.staffAnnouncements = StaffAnnouncements;
    window.staffTickets      = StaffTickets;
    window.staffApplications = StaffApplications;

    function initForTab(tabKey) {
        if (tabKey === 'staff_panel')         StaffOverview.load();
        else if (tabKey === 'staff_messages') StaffMessages.load(1);
        else if (tabKey === 'staff_announcements') StaffAnnouncements.load();
        else if (tabKey === 'staff_tickets')  StaffTickets.load(1);
        else if (tabKey === 'staff_applications') StaffApplications.load(1);
    }

    // 包装原有 switchUserTab，使其在切到 staff_* 时自动加载
    var origSwitch = window.switchUserTab;
    window.switchUserTab = function(tabKey) {
        if (typeof origSwitch === 'function') origSwitch(tabKey);
        if (tabKey && tabKey.indexOf('staff_') === 0) initForTab(tabKey);
    };

    // 初次进入页面时，如果当前 URL 即 staff_*，立刻加载
    document.addEventListener('DOMContentLoaded', function() {
        var url = new URL(window.location.href);
        var t = url.searchParams.get('tab');
        if (t && t.indexOf('staff_') === 0) initForTab(t);
    });
})();
