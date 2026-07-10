var _userTicketsPollTimer = null;
var _userTicketBadgePollTimer = null;
var _userTicketsPollInterval = 30000;
var _userTicketBadgePollInterval = 60000;
var _userTicketCollapsedState = {};
var _userTicketsPage = 1;

function isUserTicketsTabVisible() {
    var tab = document.getElementById('tab-tickets');
    return !!(tab && tab.style.display !== 'none');
}

// 渲染单条回复/工单的附件区
function renderTicketAttachmentsJs(atts) {
    if (!atts || !atts.length) return '';
    var items = atts.map(function(a) {
        var url = a.web_url || '';
        if (!url) return '';
        var name = escHtml(a.original_name || '附件');
        var size = escHtml(a.size_label || '');
        if (a.is_image) {
            return '<a class="ticket-attachment ticket-attachment-image" href="' + escHtml(url) + '" data-lightbox="' + escHtml(url) + '" title="' + name + '"><img src="' + escHtml(url) + '" alt="' + name + '" loading="lazy"></a>';
        }
        return '<a class="ticket-attachment" href="' + escHtml(url) + '" target="_blank" rel="noopener" download><span>📎</span><span>' + name + '</span><span class="ticket-attachment-size">' + size + '</span></a>';
    }).join('');
    return '<div class="ticket-attachments">' + items + '</div>';
}

function renderUserTickets(tickets, pagination) {
    var list = document.getElementById('userTicketsList');
    if (!list) return;
    tickets = tickets || [];
    if (!tickets.length) {
        list.innerHTML = '<div class="empty-state">暂无工单</div>';
        return;
    }
    var statusLabels = { open: '待处理', replied: '已回复', closed: '已关闭' };
    var categoryLabels = { bug: 'Bug', report: '举报', appeal: '申诉', suggestion: '建议', other: '其他' };
    var html = tickets.map(function(ticket) {
        var replies = ticket.replies || [];
        var ticketAtts = ticket.attachments || [];
        var collapsed = _userTicketCollapsedState[ticket.id] !== false;
        var replyHtml = replies.map(function(reply, idx) {
            var isAdmin = reply.author_type === 'admin';
            var atts = reply.attachments || [];
            // 兜底：首条 user 回复若无独立附件，取工单级附件（兼容历史数据）
            if (!isAdmin && idx === 0 && !atts.length) atts = ticketAtts;
            return '<div class="ticket-reply ' + (isAdmin ? 'admin' : 'user') + '"><b>' + (isAdmin ? '管理员' : '我') + ' · ' + escHtml(reply.created_at || '') + '</b><div class="ticket-rich-content">' + (reply.content_html || escHtml(reply.content || '')) + '</div>' + renderTicketAttachmentsJs(atts) + '</div>';
        }).join('');
        var replyForm = '';
        if (ticket.status !== 'closed') {
            replyForm =
                '<form method="POST" enctype="multipart/form-data" class="profile-form ticket-reply-form" data-ajax="ticket-reply">' +
                    '<input type="hidden" name="csrf" value="' + escHtml(getUserCsrf()) + '">' +
                    '<input type="hidden" name="ticket_id" value="' + escHtml(ticket.id || '') + '">' +
                    '<textarea name="content" rows="3" class="form-input rich-text-source" placeholder="补充回复..."></textarea>' +
                    '<div class="ticket-attach-row">' +
                        '<label class="ticket-attach-btn">' +
                            '<span>📎 添加附件</span>' +
                            '<input type="file" name="attachments[]" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.log,.json,.zip,.mp4,.mp3,image/*" hidden data-role="ticket-attach">' +
                        '</label>' +
                        '<span class="ticket-attach-hint" data-role="ticket-attach-hint">最多 5 个，单个 ≤ 10MB（图片/PDF/文本/压缩包等）</span>' +
                    '</div>' +
                    '<button type="submit" class="btn-outline">提交回复</button>' +
                '</form>';
        }
        return '<article class="ticket-card ticket-' + escHtml(ticket.status || '') + '">' +
            '<div class="ticket-head">' +
                '<button type="button" id="userTicketToggle' + escHtml(ticket.id || '') + '" class="ticket-toggle-btn" onclick="toggleUserTicketCard(' + escHtml(ticket.id || '') + ')" aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="userTicketBody' + escHtml(ticket.id || '') + '">' +
                    '<span id="userTicketToggleIcon' + escHtml(ticket.id || '') + '" class="ticket-toggle-icon">' + (collapsed ? '+' : '−') + '</span>' +
                    '<div class="ticket-title"><h3>#' + escHtml(ticket.id || '') + ' ' + escHtml(ticket.subject || '') + '</h3><p>' + escHtml(categoryLabels[ticket.category] || '其他') + ' · ' + escHtml(ticket.created_at || '') + '</p></div>' +
                '</button>' +
                '<span class="ticket-status">' + escHtml(statusLabels[ticket.status] || ticket.status || '') + '</span>' +
            '</div>' +
            '<div id="userTicketBody' + escHtml(ticket.id || '') + '" class="ticket-body"' + (collapsed ? ' hidden' : '') + '>' +
                '<div class="ticket-thread">' + replyHtml + '</div>' +
                replyForm +
            '</div>' +
        '</article>';
    }).join('');
    html += renderUserTicketsPagination(pagination || {});
    list.innerHTML = html;
    initUserPageInteractions(list);
    bindTicketAttachInputs(list);
}

function renderUserTicketsPagination(pagination) {
    var page = parseInt(pagination.page, 10) || 1;
    var pages = parseInt(pagination.pages, 10) || 1;
    var perPage = parseInt(pagination.per_page, 10) || 5;
    var total = parseInt(pagination.total, 10) || 0;
    if (pages <= 1) return '';
    var html = '<div class="ticket-pagination"><span>共 ' + total + ' 个工单，每页 ' + perPage + ' 个</span><div>';
    html += '<button type="button" onclick="loadUserTickets(false, ' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>';
    for (var i = 1; i <= pages; i++) {
        html += '<button type="button" class="' + (i === page ? 'active' : '') + '" onclick="loadUserTickets(false, ' + i + ')">' + i + '</button>';
    }
    html += '<button type="button" onclick="loadUserTickets(false, ' + (page + 1) + ')" ' + (page >= pages ? 'disabled' : '') + '>下一页</button>';
    html += '</div></div>';
    return html;
}

function toggleUserTicketCard(id) {
    var body = document.getElementById('userTicketBody' + id);
    var icon = document.getElementById('userTicketToggleIcon' + id);
    var btn = document.getElementById('userTicketToggle' + id);
    if (!body) return;
    var collapsed = !body.hidden;
    body.hidden = collapsed;
    _userTicketCollapsedState[id] = collapsed;
    if (icon) icon.textContent = collapsed ? '+' : '−';
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function hasUnsavedUserTicketDraft() {
    var list = document.getElementById('userTicketsList');
    if (!list) return false;
    var editors = list.querySelectorAll('.rich-text-area');
    for (var i = 0; i < editors.length; i++) {
        var text = (editors[i].innerText || '').replace(/\u00a0/g, ' ').trim();
        var html = (editors[i].innerHTML || '').replace(/<br\s*\/?>/gi, '').trim();
        if (text !== '' || (html !== '' && html !== '<p></p>')) return true;
    }
    var fileInputs = list.querySelectorAll('input[data-role="ticket-attach"]');
    for (var j = 0; j < fileInputs.length; j++) {
        if (fileInputs[j].files && fileInputs[j].files.length) return true;
    }
    return false;
}

// 把回复表单内的 file input 的"已选数量/总大小"提示同步到 hint
function bindTicketAttachInputs(root) {
    root.querySelectorAll('input[data-role="ticket-attach"]').forEach(function(input) {
        if (input.dataset.hintBound === '1') return;
        input.dataset.hintBound = '1';
        var row = input.closest('.ticket-attach-row');
        var hint = row ? row.querySelector('[data-role="ticket-attach-hint"]') : null;
        input.addEventListener('change', function() {
            if (!hint) return;
            var files = input.files || [];
            if (!files.length) {
                hint.classList.remove('over-limit');
                hint.textContent = '最多 5 个，单个 ≤ 10MB（图片/PDF/文本/压缩包等）';
                return;
            }
            if (files.length > 5) {
                hint.classList.add('over-limit');
                hint.textContent = '最多 5 个附件，已选 ' + files.length + ' 个，请重新选择';
                input.value = '';
                return;
            }
            var maxSize = 10 * 1024 * 1024;
            for (var i = 0; i < files.length; i++) {
                if (files[i].size > maxSize) {
                    hint.classList.add('over-limit');
                    hint.textContent = '存在超过 10MB 的文件，请重新选择';
                    input.value = '';
                    return;
                }
            }
            hint.classList.remove('over-limit');
            hint.textContent = '已选 ' + files.length + ' 个文件';
        });
    });
}

function loadUserTickets(silent, page) {
    var list = document.getElementById('userTicketsList');
    var requestedPage = typeof page !== 'undefined';
    if (!list || (!requestedPage && list.contains(document.activeElement))) return;
    if (silent && hasUnsavedUserTicketDraft()) return;
    page = page || _userTicketsPage || 1;
    if (!silent && typeof renderSoftLoading === 'function' && !hasUnsavedUserTicketDraft()) {
        list.innerHTML = renderSoftLoading('Loading tickets', 3);
    }
    fetch('api/index.php?action=ticket_list&page=' + encodeURIComponent(page))
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.status !== 'success') {
                if (!silent) showToast(res.message || '工单加载失败', 'error');
                return;
            }
            _userTicketsPage = res.page || page;
            renderUserTickets(res.tickets || [], { page: res.page, pages: res.pages, per_page: res.per_page, total: res.total });
            if (res.stats) updateTicketBadge(res.stats.replied || 0);
        })
        .catch(function(err) {
            console.error('工单列表加载失败:', err);
            if (!silent) showToast('工单加载失败，请稍后重试', 'error');
        });
}

function refreshTicketBadge() {
    fetch('api/index.php?action=ticket_badge')
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.status === 'success') updateTicketBadge(res.count || 0);
        })
        .catch(function() {});
}

function startUserTicketsPolling() {
    stopUserTicketsPolling();
    if (!isUserTicketsTabVisible() || document.hidden) return;
    _userTicketsPollTimer = setInterval(function() {
        if (!isUserTicketsTabVisible() || document.hidden) {
            stopUserTicketsPolling();
            return;
        }
        loadUserTickets(true);
    }, _userTicketsPollInterval);
}

function stopUserTicketsPolling() {
    if (_userTicketsPollTimer) {
        clearInterval(_userTicketsPollTimer);
        _userTicketsPollTimer = null;
    }
}

function startTicketBadgePolling() {
    if (_userTicketBadgePollTimer) return;
    refreshTicketBadge();
    _userTicketBadgePollTimer = setInterval(refreshTicketBadge, _userTicketBadgePollInterval);
}
