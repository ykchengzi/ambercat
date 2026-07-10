// Global function for tab switching
function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateTabPane(tab) {
    if (!tab) return;
    tab.style.display = 'block';
    if (prefersReducedMotion()) {
        tab.style.transition = '';
        tab.style.opacity = '';
        tab.style.transform = '';
        return;
    }
    tab.style.transition = 'none';
    tab.style.opacity = '0';
    tab.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
        tab.style.transition = 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
        tab.style.opacity = '1';
        tab.style.transform = 'translateY(0)';
    });
}

window.switchTab = function(tabKey) {
    try {
        // 1. Hide all tabs
        const tabs = document.querySelectorAll('.tab-pane');
        if (!tabs.length) {
            console.error('No tab-pane elements found');
            return;
        }
        tabs.forEach(el => el.style.display = 'none');
        
        // 2. Show target tab
        const targetTab = document.getElementById('tab-' + tabKey);
        // 安全网：如果目标 tab 是按需渲染的占位 div（data-lazy=1），整页跳转到 ?tab=X 让 PHP 把表单渲染出来
        if (targetTab && targetTab.dataset.lazy === '1') {
            window.location.href = '?tab=' + encodeURIComponent(tabKey);
            return;
        }
        if (targetTab) {
            // Lazy load images in this tab
            const lazyImages = targetTab.querySelectorAll('img[data-src]');
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });

            animateTabPane(targetTab);

            // Re-observe reveal elements in newly shown tab
            if (window.observeRevealElements) {
                window.observeRevealElements(targetTab);
            }
        } else {
            console.error('Target tab not found:', 'tab-' + tabKey);
        }
        
        // 3. Update sidebar active state
        document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-subitem').forEach(el => el.classList.remove('active'));
        const navItem = document.getElementById('nav-' + tabKey);
        if (navItem) {
            navItem.classList.add('active');
            const group = navItem.closest('.nav-group');
            if (group) {
                group.classList.add('open');
                const toggle = group.querySelector('.nav-group-toggle');
                if (toggle) toggle.classList.add('active');
            }
        }
        
        // 4. Update page title
        const titleEl = document.getElementById('page-title');
        if (titleEl && typeof tabLabels !== 'undefined' && tabLabels[tabKey]) {
            titleEl.textContent = tabLabels[tabKey];
        }

        // 5. Update URL without reload
        if (window.history && window.history.pushState) {
            const url = new URL(window.location);
            url.searchParams.set('tab', tabKey);
            window.history.pushState({}, '', url);
        }

        // 6. Close mobile sidebar if open
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
            setAdminSidebarOpen(false);
        }
    } catch (e) {
        console.error('Error in switchTab:', e);
        alert('切换标签页时出错: ' + e.message);
    }
};

window.toggleNavGroup = function(btn) {
    const group = btn ? btn.closest('.nav-group') : null;
    if (group) group.classList.toggle('open');
};

// ==================== 图片上传 Dropzone（渐进增强） ====================
// 把所有 .image-upload-group 升级成可拖拽 / 显示文件名+大小 / 可移除 / 客户端校验的 dropzone。
// 不改变 DOM 结构对接：原有 input[type=file].form-file、img.preview-img、input[type=hidden] 都保留。
(function() {
    var ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    var MAX_BYTES = (window.adminUploadLimits && window.adminUploadLimits.max_bytes) || (5 * 1024 * 1024);
    var TIP_TEXT = (window.adminUploadLimits && window.adminUploadLimits.tip)
        || '点击或拖拽图片到此处，支持 JPG / PNG / GIF / WebP，单文件 ≤ 5MB';

    function humanSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1048576).toFixed(1) + 'MB';
    }

    // 把 .image-upload-group 包装成 dropzone 卡片
    function enhance(group) {
        if (!group || group.dataset.dzReady === '1') return;
        var input = group.querySelector('input[type="file"].form-file');
        if (!input) return;

        // 已有的预览图（PHP 渲染出来的当前图片）
        var existingImg = group.querySelector('img.preview-img');
        var initialSrc = existingImg ? existingImg.getAttribute('src') : '';
        // 同 group 内静态提示文本（如 "建议高度 40px..."）保留下来作为 meta 默认值
        var hintEl = group.querySelector('.file-hint');
        var hintText = hintEl ? hintEl.textContent.trim() : '';

        // 构造 dropzone 内部结构
        var stage = document.createElement('div');
        stage.className = 'dz-stage';

        var thumb = document.createElement('div');
        thumb.className = 'dz-thumb' + (initialSrc ? '' : ' is-empty');
        if (initialSrc) thumb.style.backgroundImage = 'url("' + cssEscape(initialSrc) + '")';

        var text = document.createElement('div');
        text.className = 'dz-text';
        var title = document.createElement('div');
        title.className = 'dz-title';
        title.innerHTML = initialSrc
            ? '当前图片 · <strong>点击或拖拽以替换</strong>'
            : '<strong>点击或拖拽</strong>上传图片';
        var meta = document.createElement('div');
        meta.className = 'dz-meta';
        meta.textContent = hintText || TIP_TEXT;
        text.appendChild(title);
        text.appendChild(meta);

        var actions = document.createElement('div');
        actions.className = 'dz-actions';
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'dz-btn is-danger';
        clearBtn.textContent = '移除';
        clearBtn.style.display = initialSrc ? '' : 'none';
        actions.appendChild(clearBtn);

        stage.appendChild(thumb);
        stage.appendChild(text);
        stage.appendChild(actions);

        group.classList.add('is-dropzone');
        // 把原 hint 删掉（已合并到 meta）
        if (hintEl && hintEl.parentNode === group) hintEl.remove();
        // 让 input 仍在 group 里但被 CSS 完全覆盖
        group.insertBefore(stage, group.firstChild);

        // a11y：用 input 的 name 关联 title
        try { input.setAttribute('aria-label', '上传图片：' + (hintText || '')); } catch (_) {}

        // 状态变量
        var state = {
            originalSrc: initialSrc,
            hintText: hintText || TIP_TEXT,
            hasNewFile: false
        };

        function setError(msg) {
            group.classList.add('has-error');
            meta.classList.add('is-error');
            meta.textContent = msg;
        }
        function clearError() {
            group.classList.remove('has-error');
            meta.classList.remove('is-error');
        }
        function resetMeta() {
            clearError();
            meta.textContent = state.hintText;
        }
        function showThumb(src) {
            if (src) {
                thumb.classList.remove('is-empty');
                thumb.style.backgroundImage = 'url("' + cssEscape(src) + '")';
            } else {
                thumb.classList.add('is-empty');
                thumb.style.backgroundImage = '';
            }
        }

        function applyFile(file) {
            clearError();
            if (!file) return;
            // 客户端校验
            if (!file.type || ALLOWED_MIME.indexOf(file.type) === -1) {
                setError('不支持的格式：' + (file.type || '未知') + '，仅允许 JPG / PNG / GIF / WebP');
                return;
            }
            if (file.size > MAX_BYTES) {
                setError('文件过大：' + humanSize(file.size) + '，上限 ' + humanSize(MAX_BYTES));
                return;
            }
            // 写回原 input.files（拖拽场景）
            try {
                if (file !== input.files[0]) {
                    var dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                }
            } catch (_) { /* 不支持 DataTransfer 的浏览器忽略，change 事件已能传到 input */ }

            // 更新 UI
            title.innerHTML = '<strong>已选择文件，保存即可上传</strong>';
            meta.innerHTML = '<span class="dz-name">' + escHtml(file.name) + '</span> · ' + humanSize(file.size);
            var reader = new FileReader();
            reader.onload = function(ev) {
                var src = ev.target.result;
                showThumb(src);
                thumb.classList.add('is-pending');
                var imgEl = new Image();
                imgEl.onload = function() {
                    meta.innerHTML = '<span class="dz-name">' + escHtml(file.name) + '</span> · '
                        + humanSize(file.size) + ' · <span style="color:#94a3b8;font-size:.75em;">'
                        + imgEl.naturalWidth + '&times;' + imgEl.naturalHeight + '</span>';
                };
                imgEl.src = src;
            };
            reader.readAsDataURL(file);
            clearBtn.textContent = '取消选择';
            clearBtn.style.display = '';
            state.hasNewFile = true;

            // 更新隐藏 .preview-img 的 src，保持旧选择器兼容
            if (existingImg) existingImg.src = reader.result || existingImg.src;
        }

        function clearSelection() {
            input.value = '';
            state.hasNewFile = false;
            thumb.classList.remove('is-pending');
            if (state.originalSrc) {
                showThumb(state.originalSrc);
                title.innerHTML = '当前图片 · <strong>点击或拖拽以替换</strong>';
                clearBtn.textContent = '移除';
                clearBtn.style.display = '';
            } else {
                showThumb('');
                title.innerHTML = '<strong>点击或拖拽</strong>上传图片';
                clearBtn.style.display = 'none';
            }
            resetMeta();
        }

        // 点击移除：
        // - 已选了新文件但未保存 → 取消选择，回到原状
        // - 没选新文件、有原图 → 清空隐藏 input，告诉服务端把字段保存为空（针对支持 clear_logo 等专门字段的 tab，这里不做兜底，仅清掉 client 状态；点击后立即提示）
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (state.hasNewFile) {
                clearSelection();
                return;
            }
            // 已保存的图片：把 hidden 字段清空，提示需保存生效
            var hidden = group.querySelector('input[type="hidden"]');
            if (hidden) hidden.value = '';
            state.originalSrc = '';
            if (existingImg) existingImg.removeAttribute('src');
            showThumb('');
            title.innerHTML = '<strong>已标记移除</strong>';
            meta.textContent = '保存后将清除此图片';
            clearBtn.style.display = 'none';
        });

        // 选择文件
        input.addEventListener('change', function() {
            var f = input.files && input.files[0];
            if (f) applyFile(f);
        });

        // 拖拽
        ['dragenter', 'dragover'].forEach(function(ev) {
            group.addEventListener(ev, function(e) {
                e.preventDefault();
                e.stopPropagation();
                group.classList.add('is-dragover');
            });
        });
        ['dragleave', 'dragend', 'drop'].forEach(function(ev) {
            group.addEventListener(ev, function(e) {
                e.preventDefault();
                e.stopPropagation();
                group.classList.remove('is-dragover');
            });
        });
        group.addEventListener('drop', function(e) {
            var dt = e.dataTransfer;
            if (!dt || !dt.files || !dt.files.length) return;
            applyFile(dt.files[0]);
        });

        // 暴露接口给保存后回调用：标记已保存到服务端
        group.__dzMarkSaved = function(savedSrc) {
            state.originalSrc = savedSrc || '';
            state.hasNewFile = false;
            thumb.classList.remove('is-pending');
            if (state.originalSrc) {
                showThumb(state.originalSrc);
                title.innerHTML = '当前图片 · <strong>点击或拖拽以替换</strong>';
                clearBtn.textContent = '移除';
                clearBtn.style.display = '';
            }
            resetMeta();
        };
        group.__dzShowError = function(msg) { setError(msg); };
        group.__dzApplyFile = applyFile;

        // 悬停时标记为粘贴目标，支持 Ctrl+V 粘贴图片
        group.addEventListener('mouseenter', function() {
            document.__dzPasteTarget = group;
            if (!state.hasNewFile) meta.textContent = state.hintText + ' / Ctrl+V 粘贴';
        });
        group.addEventListener('mouseleave', function() {
            if (!state.hasNewFile) resetMeta();
        });

        group.dataset.dzReady = '1';
    }

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function cssEscape(s) {
        return String(s == null ? '' : s).replace(/"/g, '\\"');
    }

    function initAll(root) {
        (root || document).querySelectorAll('.image-upload-group').forEach(enhance);
    }

    window.initImageDropzones = initAll;

    // 给 AJAX 响应里的 upload_issues 派发到对应字段的 dropzone
    window.applyUploadIssues = function(form, issues) {
        if (!form || !issues) return;
        var fieldNames = Object.keys(issues);
        var firstSummary = '';
        fieldNames.forEach(function(field) {
            var info = issues[field] || {};
            var input = form.querySelector('input[name="' + field.replace(/"/g, '\\"') + '"]');
            var group = input ? input.closest('.image-upload-group') : null;
            if (group && typeof group.__dzShowError === 'function') {
                var msg = (info.name ? info.name + '：' : '') + (info.message || '上传失败');
                group.__dzShowError(msg);
                if (!firstSummary) firstSummary = msg;
                // 清空 file input，避免下次提交重复触发同样错误
                if (input) { try { input.value = ''; } catch (_) {} }
            }
        });
        if (firstSummary && typeof window.showToast === 'function') {
            var n = fieldNames.length;
            window.showToast(
                n > 1 ? ('有 ' + n + ' 个文件未上传：' + firstSummary) : ('文件未上传：' + firstSummary),
                'error'
            );
        }
    };

    // 全局剪贴板粘贴支持：在已悬停的 dropzone 上 Ctrl+V 粘贴图片
    document.addEventListener('paste', function(e) {
        var g = document.__dzPasteTarget;
        if (!g || typeof g.__dzApplyFile !== 'function') return;
        var active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' ||
                (active.tagName === 'INPUT' && active.type !== 'file'))) return;
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var pi = 0; pi < items.length; pi++) {
            if (items[pi].kind === 'file' && items[pi].type.indexOf('image') !== -1) {
                var f = items[pi].getAsFile();
                if (f) { e.preventDefault(); g.__dzApplyFile(f); }
                break;
            }
        }
    });
})();

function setAdminSidebarOpen(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active', open);
    if (overlay) overlay.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', !!open);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Scroll Reveal Observer ---
    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });

    function observeRevealElements(root) {
        const els = (root || document).querySelectorAll('.form-section, .ad-banner, .alert, .messages-list .message-item');
        els.forEach(el => {
            if (!el.classList.contains('revealed')) {
                revealObserver.observe(el);
            }
        });
    }
    observeRevealElements();
    window.observeRevealElements = observeRevealElements;

    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('mobileMenuBtn');

    if (menuBtn && sidebar) {
        let overlay = document.getElementById('adminSidebarOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'adminSidebarOverlay';
            overlay.className = 'admin-sidebar-overlay';
            document.body.appendChild(overlay);
        }
        overlay.addEventListener('click', () => setAdminSidebarOpen(false));
        menuBtn.addEventListener('click', () => setAdminSidebarOpen(!sidebar.classList.contains('active')));

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    setAdminSidebarOpen(false);
                }
            }
        });
    }

    // Auto-dismiss alerts
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-8px)';
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    });

    // Image preview on file select — 升级为 dropzone（拖入 / 文件名 / 大小 / 客户端校验 / 移除按钮）
    window.initImageDropzones(document);

    // Form unsaved changes warning
    let formChanged = false;
    const forms = document.querySelectorAll('form');
    
    if (forms.length > 0) {
        forms.forEach(form => {
            form.addEventListener('input', () => { formChanged = true; });
            form.addEventListener('change', () => { formChanged = true; });
            form.addEventListener('submit', () => { formChanged = false; });
        });

        window.addEventListener('beforeunload', (e) => {
            if (formChanged) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'site';
        // Manually switch tab logic without pushing state again
        const targetTab = document.getElementById('tab-' + tab);
        if (targetTab) {
            document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');
            animateTabPane(targetTab);
            
            const navItem = document.getElementById('nav-' + tab);
            if (navItem) {
                if (navItem.type === 'radio') {
                    navItem.checked = true;
                } else {
                    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
                    navItem.classList.add('active');
                }
            }

            const titleEl = document.getElementById('page-title');
            if (titleEl && typeof tabLabels !== 'undefined' && tabLabels[tab]) {
                titleEl.textContent = tabLabels[tab];
            }
        }
    });

    // AJAX Form Handling
    let toastTimer;
    
    // Expose showToast globally so dynamic IIFE modules can use it
    window.showToast = showToast;
    function showToast(message, type = 'success') {
        let toast = document.getElementById('ajax-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ajax-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 9999;
                opacity: 0;
                transform: translateY(-12px);
                transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(toast);
        }

        // Clear existing timer
        if (toastTimer) clearTimeout(toastTimer);

        // Update content
        toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
        toast.textContent = message;

        // Show
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Hide after 3s
        toastTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-12px)';
        }, 3000);
    }

    document.querySelectorAll('form[data-ajax="true"]').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">↻</span> 保存中...';
            }

            try {
                const formData = new FormData(form);
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 100));
                }

                let result;
                const text = await response.text();
                try {
                    result = JSON.parse(text);
                } catch (parseErr) {
                    console.error('Non-JSON response:', text.substring(0, 200));
                    showToast('服务器返回异常，请刷新页面后重试', 'error');
                    return;
                }

                if (result.status === 'success') {
                    showToast(result.message || '保存成功！', 'success');

                    // Profile update logic
                    if (result.avatar_url) {
                        const topbarAvatar = document.getElementById('topbarAvatar');
                        if (topbarAvatar) topbarAvatar.src = result.avatar_url;
                        const avatarPreview = document.getElementById('avatarPreview');
                        if (avatarPreview) avatarPreview.src = result.avatar_url;
                    }
                    if (form.id === 'profileForm') {
                        setTimeout(() => {
                            if (window.closeProfileModal) window.closeProfileModal();
                        }, 500);
                        form.reset();
                    }

                    // Update preview images if any were uploaded
                    if (result.uploads) {
                        Object.keys(result.uploads).forEach(field => {
                            const input = form.querySelector(`input[name="${field}"]`);
                            if (!input) return;
                            const group = input.closest('.image-upload-group');
                            if (!group) return;
                            const newSrc = '../' + result.uploads[field];

                            // 兼容旧版 .preview-img（隐藏的兼容性 img）
                            let img = group.querySelector('.preview-img');
                            if (!img) {
                                img = document.createElement('img');
                                img.className = 'preview-img';
                                group.insertBefore(img, group.firstChild);
                            }
                            img.src = newSrc;

                            // 通知 dropzone 进入"已保存"状态
                            if (typeof group.__dzMarkSaved === 'function') {
                                group.__dzMarkSaved(newSrc);
                            }
                            // 清空 file input，避免重复提交
                            try { input.value = ''; } catch (_) {}
                        });
                    }

                    // Per-field upload skip reasons (handleUpload 返回 null 但带原因)
                    if (result.upload_issues && Object.keys(result.upload_issues).length > 0) {
                        applyUploadIssues(form, result.upload_issues);
                    }
                } else {
                    showToast(result.message || '保存失败，请重试', 'error');
                    if (result.upload_issues && Object.keys(result.upload_issues).length > 0) {
                        applyUploadIssues(form, result.upload_issues);
                    }
                }

            } catch (error) {
                console.error('AJAX Error:', error);
                if (error && error.message && error.message.includes('JSON')) {
                    showToast('服务器返回异常，可能登录已过期，请刷新页面', 'error');
                } else {
                    showToast('网络错误，请检查连接', 'error');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    });

    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { 
            100% { transform: rotate(360deg); } 
        }
    `;
    document.head.appendChild(style);
});

// Profile Modal Functions
window.openProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'flex';
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'none';
};

window.previewAvatar = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('avatarPreview');
            if (preview) preview.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('profileModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});


// Mark message as read via AJAX (avoids nested form issues)
window.markRead = async function(msgId, csrf, btn) {
    btn.disabled = true;
    btn.textContent = '处理中...';
    try {
        const fd = new FormData();
        fd.append('csrf', csrf);
        fd.append('tab', 'mark_read');
        fd.append('id', msgId);
        const res = await fetch('save.php', {
            method: 'POST',
            body: fd,
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        if (data.status === 'success') {
            btn.outerHTML = '<span style="color:#94a3b8;font-size:0.9em;">已读</span>';
            if (typeof showToast === 'function') showToast('已标记为已读', 'success');
        } else {
            btn.disabled = false;
            btn.textContent = '标记为已读';
            if (typeof showToast === 'function') showToast(data.message || '操作失败', 'error');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '标记为已读';
        if (typeof showToast === 'function') showToast('网络错误', 'error');
    }
};

// Block/unblock email via AJAX
window.toggleBlock = async function(action, email, csrf, btn) {
    const isBlock = action === 'block_email';
    if (isBlock && !confirm('确定要拉黑此邮箱吗？')) return;
    if (!isBlock && !confirm('确定要解除拉黑此邮箱吗？')) return;

    btn.disabled = true;
    btn.textContent = '处理中...';
    try {
        const fd = new FormData();
        fd.append('csrf', csrf);
        fd.append('tab', action);
        fd.append('email', email);
        const res = await fetch('save.php', {
            method: 'POST',
            body: fd,
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (isBlock) {
                btn.style.background = '#ecfdf5';
                btn.style.color = '#10b981';
                btn.textContent = '解除拉黑';
                btn.disabled = false;
                btn.onclick = function() { toggleBlock('unblock_email', email, csrf, btn); };
            } else {
                btn.style.background = '#fef2f2';
                btn.style.color = '#ef4444';
                btn.textContent = '拉黑邮箱';
                btn.disabled = false;
                btn.onclick = function() { toggleBlock('block_email', email, csrf, btn); };
            }
            if (typeof showToast === 'function') showToast(data.message, 'success');
        } else {
            btn.disabled = false;
            btn.textContent = isBlock ? '拉黑邮箱' : '解除拉黑';
            if (typeof showToast === 'function') showToast(data.message || '操作失败', 'error');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = isBlock ? '拉黑邮箱' : '解除拉黑';
        if (typeof showToast === 'function') showToast('网络错误', 'error');
    }
};
