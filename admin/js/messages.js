// ============ Real-time Messages ============
(function() {
    var currentMsgPage = 1;
    var pollTimer = null;
    var POLL_INTERVAL = 5000; // 5 seconds
    var lastKnownTotal = -1;
    var lastMsgFingerprint = '';
    var csrfToken = '';

    // Grab CSRF from any form on the page
    function getCsrf() {
        if (csrfToken) return csrfToken;
        var input = document.querySelector('input[name="csrf"]');
        if (input) csrfToken = input.value;
        return csrfToken;
    }

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function nl2br(str) {
        return escHtml(str).replace(/\n/g, '<br>');
    }

    function subjectTag(subject) {
        var map = {
            report: { label: '违规举报', bg: '#fef2f2', color: '#ef4444' },
            bug: { label: 'Bug反馈', bg: '#fffbeb', color: '#f59e0b' },
            appeal: { label: '封禁申诉', bg: '#eff6ff', color: '#3b82f6' },
            suggestion: { label: '建议', bg: '#eff6ff', color: '#3b82f6' },
            other: { label: '其他', bg: '#eff6ff', color: '#3b82f6' }
        };
        var t = map[subject] || map.other;
        return '<span class="msg-tag" style="background:' + t.bg + ';color:' + t.color + ';">' + t.label + '</span>';
    }

    function renderMessage(m) {
        var csrf = getCsrf();
        var imagesHtml = '';
        if (m.images && m.images.length) {
            imagesHtml = '<div style="margin-bottom:20px;"><h4 style="margin-bottom:10px;color:#0f172a;font-size:0.95em;">附件图片</h4><div style="display:flex;gap:10px;flex-wrap:wrap;">';
            m.images.forEach(function(img) {
                imagesHtml += '<div class="msg-thumb" style="width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;cursor:pointer;transition:transform 160ms cubic-bezier(0.16,1,0.3,1),box-shadow 160ms cubic-bezier(0.16,1,0.3,1),border-color 160ms cubic-bezier(0.16,1,0.3,1);" onclick="openLightbox(\'../' + escHtml(img) + '\')">' +
                    '<img src="../' + escHtml(img) + '" alt="附件" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"></div>';
            });
            imagesHtml += '</div></div>';
        }

        var readBtn = m.read
            ? '<span style="color:#94a3b8;font-size:0.9em;">已读</span>'
            : '<button type="button" onclick="markRead(\'' + escHtml(m.id) + '\',\'' + escHtml(csrf) + '\',this)" style="padding:8px 20px;background:#f1f5f9;border-radius:30px;color:#475569;font-size:0.9em;font-weight:600;border:none;cursor:pointer;transition:background-color 160ms cubic-bezier(0.16,1,0.3,1),color 160ms cubic-bezier(0.16,1,0.3,1);">标记为已读</button>';

        var blockBtn = m.blocked
            ? '<button type="button" onclick="toggleBlock(\'unblock_email\',\'' + escHtml(m.email) + '\',\'' + escHtml(csrf) + '\',this)" style="padding:8px 20px;background:#ecfdf5;border-radius:30px;color:#10b981;font-size:0.9em;font-weight:600;border:none;cursor:pointer;">解除拉黑</button>'
            : '<button type="button" onclick="toggleBlock(\'block_email\',\'' + escHtml(m.email) + '\',\'' + escHtml(csrf) + '\',this)" style="padding:8px 20px;background:#fef2f2;border-radius:30px;color:#ef4444;font-size:0.9em;font-weight:600;border:none;cursor:pointer;">拉黑邮箱</button>';

        var repliedTag = m.replied ? '<span class="msg-tag" style="background:#ecfdf5;color:#10b981;">已回复</span>' : '';

        return '<div class="message-item" data-msg-id="' + escHtml(m.id) + '">' +
            '<div class="msg-header">' +
                '<div class="msg-meta">' +
                    '<div class="msg-name">' + escHtml(m.name) + '</div>' +
                    '<div class="msg-email">&lt;' + escHtml(m.email) + '&gt;</div>' +
                    subjectTag(m.subject) + repliedTag +
                '</div>' +
                '<div class="msg-time">' + escHtml(m.created_at) + '</div>' +
            '</div>' +
            '<details>' +
                '<summary style="cursor:pointer;color:#475569;list-style:none;outline:none;">' +
                    '<div style="display:flex;align-items:center;gap:5px;">' +
                        '<span style="font-weight:500;">查看详情</span>' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
                    '</div>' +
                    '<div style="margin-top:8px;color:#64748b;font-size:0.95em;">' + nl2br(truncate(m.message, 100)) + '</div>' +
                '</summary>' +
                '<div class="msg-full" style="margin-top:15px;padding-top:15px;border-top:1px solid #f1f5f9;">' +
                    '<div style="background:#f8fafc;padding:15px;border-radius:8px;margin-bottom:20px;font-size:0.95em;line-height:1.6;color:#334155;">' + nl2br(m.message) + '</div>' +
                    imagesHtml +
                    '<div class="msg-actions">' +
                        '<h4 style="margin-bottom:15px;color:#0f172a;font-size:1em;">回复邮件</h4>' +
                        '<form method="POST" action="save.php" data-ajax="true" enctype="multipart/form-data" data-reply-form="' + escHtml(m.id) + '">' +
                            '<input type="hidden" name="csrf" value="' + escHtml(csrf) + '">' +
                            '<input type="hidden" name="tab" value="reply_message">' +
                            '<input type="hidden" name="msg_id" value="' + escHtml(m.id) + '">' +
                            '<input type="hidden" name="to_email" value="' + escHtml(m.email) + '">' +
                            '<input type="hidden" name="to_name" value="' + escHtml(m.name) + '">' +
                            '<input type="hidden" name="subject" value="' + escHtml(m.subject) + '">' +
                            '<div class="form-group"><textarea name="reply_content" class="form-input" rows="4" placeholder="在此输入回复内容..." required style="resize:vertical;"></textarea></div>' +
                            '<div class="reply-img-preview" data-reply-preview="' + escHtml(m.id) + '" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;"></div>' +
                            '<div class="msg-btn-row">' +
                                '<button type="submit" class="btn-save small" style="padding:8px 20px;">发送回复</button>' +
                                '<label style="padding:8px 16px;background:#f1f5f9;border-radius:30px;color:#475569;font-size:0.9em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background-color 160ms cubic-bezier(0.16,1,0.3,1),color 160ms cubic-bezier(0.16,1,0.3,1);border:none;" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f1f5f9\'">' +
                                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                                    '插入图片' +
                                    '<input type="file" accept="image/*" multiple style="display:none;" onchange="window._addReplyImages(this,\'' + escHtml(m.id) + '\')">' +
                                '</label>' +
                                '<span data-reply-hint="' + escHtml(m.id) + '" style="font-size:0.8em;color:#94a3b8;">图片将作为附件发送，≤5MB/张</span>' +
                                readBtn + blockBtn +
                            '</div>' +
                        '</form>' +
                    '</div>' +
                '</div>' +
            '</details>' +
        '</div>';
    }

    // Reply image management (per message)
    var replyImagesMap = {}; // msgId -> File[]

    window._addReplyImages = function(input, msgId) {
        if (!replyImagesMap[msgId]) replyImagesMap[msgId] = [];
        var files = replyImagesMap[msgId];
        var maxFiles = 5;
        var maxSize = 5 * 1024 * 1024;
        for (var i = 0; i < input.files.length; i++) {
            if (files.length >= maxFiles) break;
            var f = input.files[i];
            if (!f.type.startsWith('image/')) continue;
            if (f.size > maxSize) { alert('图片 "' + f.name + '" 超过5MB限制'); continue; }
            files.push(f);
        }
        input.value = '';
        _renderReplyPreview(msgId);
    };

    window._removeReplyImage = function(msgId, idx) {
        if (replyImagesMap[msgId]) {
            replyImagesMap[msgId].splice(idx, 1);
            _renderReplyPreview(msgId);
        }
    };

    function _renderReplyPreview(msgId) {
        var container = document.querySelector('[data-reply-preview="' + msgId + '"]');
        if (!container) return;
        var files = replyImagesMap[msgId] || [];
        container.innerHTML = '';
        files.forEach(function(f, i) {
            var div = document.createElement('div');
            div.style.cssText = 'position:relative;width:64px;height:64px;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;';
            var img = document.createElement('img');
            img.src = URL.createObjectURL(f);
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            img.alt = f.name;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = '×';
            btn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;';
            btn.onclick = function() { window._removeReplyImage(msgId, i); };
            div.appendChild(img);
            div.appendChild(btn);
            container.appendChild(div);
        });
        // Update hint
        var hint = document.querySelector('[data-reply-hint="' + msgId + '"]');
        if (hint) hint.textContent = files.length > 0 ? files.length + '/5 张图片将作为附件发送' : '图片将作为附件发送，≤5MB/张';
    }

    function renderPagination(data) {
        var el = document.getElementById('msgPagination');
        if (!el) return;
        if (data.totalPages <= 1) { el.innerHTML = ''; return; }

        var html = '';
        if (data.page > 1) {
            html += '<a href="javascript:void(0)" onclick="window._msgGoPage(' + (data.page - 1) + ')" style="padding:6px 14px;border-radius:8px;background:#f1f5f9;color:#475569;text-decoration:none;font-size:0.9em;font-weight:500;">上一页</a>';
        }
        for (var p = 1; p <= data.totalPages; p++) {
            var style = p === data.page ? 'background:var(--green-dark,#16a34a);color:#fff;' : 'background:#f1f5f9;color:#475569;';
            html += '<a href="javascript:void(0)" onclick="window._msgGoPage(' + p + ')" style="padding:6px 14px;border-radius:8px;font-size:0.9em;font-weight:600;text-decoration:none;' + style + '">' + p + '</a>';
        }
        if (data.page < data.totalPages) {
            html += '<a href="javascript:void(0)" onclick="window._msgGoPage(' + (data.page + 1) + ')" style="padding:6px 14px;border-radius:8px;background:#f1f5f9;color:#475569;text-decoration:none;font-size:0.9em;font-weight:500;">下一页</a>';
        }
        html += '<span style="color:var(--text-muted);font-size:0.85em;margin-left:8px;">第 ' + data.page + '/' + data.totalPages + ' 页</span>';
        el.innerHTML = html;
    }

    function bindNewAjaxForms() {
        var list = document.getElementById('messagesList');
        if (!list) return;
        list.querySelectorAll('form[data-ajax="true"]').forEach(function(form) {
            if (form._ajaxBound) return;
            form._ajaxBound = true;
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                var btn = form.querySelector('button[type="submit"]');
                var origText = btn ? btn.innerHTML : '';
                if (btn) { btn.disabled = true; btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">↻</span> 处理中...'; }
                try {
                    var fd = new FormData(form);
                    // Append reply images if this is a reply form
                    var replyId = form.getAttribute('data-reply-form');
                    if (replyId && replyImagesMap[replyId]) {
                        replyImagesMap[replyId].forEach(function(f, i) {
                            fd.append('reply_image_' + i, f);
                        });
                    }
                    var res = await fetch(form.action, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                    if (!res.ok) {
                        var errText = await res.text();
                        throw new Error('HTTP ' + res.status + ': ' + errText.substring(0, 100));
                    }
                    var text = await res.text();
                    var result;
                    try { result = JSON.parse(text); } catch(pe) {
                        console.error('Non-JSON response:', text.substring(0, 200));
                        if (typeof showToast === 'function') showToast('服务器返回异常，请刷新页面后重试', 'error');
                        return;
                    }
                    if (result.status === 'success') {
                        if (typeof showToast === 'function') showToast(result.message || '操作成功', 'success');
                        // Clear reply images
                        if (replyId) { delete replyImagesMap[replyId]; }
                        // Reset the textarea so isUserEditing won't block rebuild
                        var ta = form.querySelector('textarea[name="reply_content"]');
                        if (ta) ta.value = '';
                        fetchMessages(false, true); // Force rebuild after successful action
                    } else {
                        if (typeof showToast === 'function') showToast(result.message || '操作失败', 'error');
                    }
                } catch (err) {
                    console.error('Reply AJAX Error:', err);
                    var errMsg = (err && err.message && err.message.includes('JSON'))
                        ? '服务器返回异常，可能登录已过期，请刷新页面'
                        : '网络错误，请检查连接';
                    if (typeof showToast === 'function') showToast(errMsg, 'error');
                } finally {
                    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
                }
            });
        });
    }

    // Check if user is actively interacting with any message
    function isUserEditing() {
        var list = document.getElementById('messagesList');
        if (!list) return false;
        // Check if any textarea inside the list is focused
        var active = document.activeElement;
        if (active && list.contains(active) && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'BUTTON')) return true;
        // Check if any details panel is open (user might be reading/about to reply)
        var openDetails = list.querySelectorAll('details[open]');
        if (openDetails.length > 0) return true;
        // Check if any reply textarea has content typed
        var textareas = list.querySelectorAll('textarea[name="reply_content"]');
        for (var i = 0; i < textareas.length; i++) {
            if (textareas[i].value.trim() !== '') return true;
        }
        // Check if any reply images are staged
        for (var id in replyImagesMap) {
            if (replyImagesMap[id] && replyImagesMap[id].length > 0) return true;
        }
        return false;
    }

    // Pending new message count while user is editing
    var pendingNewCount = 0;

    function showNewMsgBanner(count) {
        var list = document.getElementById('messagesList');
        if (!list) return;
        var banner = document.getElementById('newMsgBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'newMsgBanner';
            banner.style.cssText = 'padding:10px 20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background-color 160ms cubic-bezier(0.16,1,0.3,1),border-color 160ms cubic-bezier(0.16,1,0.3,1);';
            banner.onmouseover = function() { banner.style.background = '#dbeafe'; };
            banner.onmouseout = function() { banner.style.background = '#eff6ff'; };
            banner.onclick = function() {
                pendingNewCount = 0;
                banner.remove();
                fetchMessages(false, true); // force rebuild
            };
            list.parentNode.insertBefore(banner, list);
        }
        banner.innerHTML = '<span style="color:#2563eb;font-weight:500;">📬 收到 ' + count + ' 条新消息</span><span style="color:#3b82f6;font-size:0.85em;">点击刷新 ↻</span>';
    }

    function removeNewMsgBanner() {
        var banner = document.getElementById('newMsgBanner');
        if (banner) banner.remove();
        pendingNewCount = 0;
    }

    function fetchMessages(showNewIndicator, forceRebuild) {
        fetch('api.php?act=messages&page=' + currentMsgPage, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var list = document.getElementById('messagesList');
            var label = document.getElementById('msgCountLabel');
            if (!list) return;

            // Update count label
            if (label) {
                label.textContent = '(共 ' + data.total + ' 条' + (data.unread > 0 ? '，' + data.unread + ' 条未读' : '') + ')';
            }

            // Update sidebar badge
            var badge = document.querySelector('#nav-messages .badge');
            if (data.unread > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'badge';
                    document.getElementById('nav-messages').appendChild(badge);
                }
                badge.textContent = data.unread > 99 ? '99+' : data.unread;
            } else if (badge) {
                badge.remove();
            }

            // Detect new messages
            var hasNewMessages = lastKnownTotal >= 0 && data.total > lastKnownTotal && currentMsgPage === 1;
            var newCount = hasNewMessages ? (data.total - lastKnownTotal) : 0;
            lastKnownTotal = data.total;

            var editing = isUserEditing();

            // If user is editing, never rebuild DOM — show banner for new messages instead
            if (editing && !forceRebuild) {
                if (hasNewMessages) {
                    pendingNewCount += newCount;
                    showNewMsgBanner(pendingNewCount);
                }
                // Lightweight in-place status updates only
                data.items.forEach(function(m) {
                    var item = list.querySelector('.message-item[data-msg-id="' + m.id + '"]');
                    if (!item) return;
                    // Update replied tag
                    var meta = item.querySelector('.msg-meta');
                    if (meta && m.replied && !meta.querySelector('.msg-tag[style*="#10b981"]')) {
                        meta.insertAdjacentHTML('beforeend', '<span class="msg-tag" style="background:#ecfdf5;color:#10b981;">已回复</span>');
                    }
                });
                return;
            }

            // Not editing — safe to rebuild
            removeNewMsgBanner();

            if (hasNewMessages && showNewIndicator) {
                if (typeof showToast === 'function') showToast('收到 ' + newCount + ' 条新消息', 'success');
            }

            // 数据指纹：数据没变就跳过重建，避免抖动
            var fingerprint = JSON.stringify(data.items) + '|' + data.total + '|' + data.totalPages;
            if (fingerprint === lastMsgFingerprint && !forceRebuild) return;
            lastMsgFingerprint = fingerprint;

            // Remember which details are open
            var openIds = {};
            list.querySelectorAll('details[open]').forEach(function(d) {
                var item = d.closest('.message-item');
                if (item) openIds[item.dataset.msgId] = true;
            });

            // Render
            if (data.items.length === 0) {
                list.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;background:#fff;border-radius:10px;border:1px dashed #e2e8f0;">暂无消息</div>';
            } else {
                var html = '';
                data.items.forEach(function(m) { html += renderMessage(m); });
                list.innerHTML = html;

                // Restore open details
                list.querySelectorAll('.message-item').forEach(function(item) {
                    if (openIds[item.dataset.msgId]) {
                        var det = item.querySelector('details');
                        if (det) det.open = true;
                    }
                });
            }

            renderPagination(data);
            bindNewAjaxForms();

            // Trigger reveal animation
            if (window.observeRevealElements) {
                window.observeRevealElements(list);
            }
        })
        .catch(function() {});
    }

    window._msgGoPage = function(p) {
        currentMsgPage = p;
        lastMsgFingerprint = '';
        removeNewMsgBanner();
        fetchMessages();
    };

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function() {
            // Only poll when messages tab is visible
            var tab = document.getElementById('tab-messages');
            if (tab && tab.style.display !== 'none') {
                fetchMessages(true);
            }
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        // Initial load
        fetchMessages();
        startPolling();

        // Pause polling when page is hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) { stopPolling(); } else { fetchMessages(true); startPolling(); }
        });
    });

    // Also refresh when switching to messages tab
    var origSwitchTab2 = window.switchTab;
    window.switchTab = function(tabKey) {
        origSwitchTab2(tabKey);
        if (tabKey === 'messages') {
            removeNewMsgBanner();
            fetchMessages(true);
        }
        if (tabKey === 'users') {
            loadUsersList(1);
        }
    };
})();
