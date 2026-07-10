// ==================== 备份与恢复 ====================
// 由 panel.php 的"系统 / 备份恢复"标签页使用，依赖页面中已存在的隐藏 CSRF 输入框
(function () {
    const ENDPOINT = 'backup.php';

    let _csrf = '';
    function getCsrf() {
        if (_csrf) return _csrf;
        const input = document.querySelector('input[name="csrf"]');
        if (input) _csrf = input.value;
        return _csrf;
    }

    function fmtSize(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
        return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function toast(msg, type) {
        if (typeof window.showToast === 'function') return window.showToast(msg, type || 'info');
        alert(msg);
    }
    function postBackup(action, body) {
        const fd = body instanceof FormData ? body : new FormData();
        if (!(body instanceof FormData) && body) {
            Object.keys(body).forEach(k => fd.append(k, body[k]));
        }
        fd.append('csrf', getCsrf());
        fd.append('action', action);
        return fetch(ENDPOINT, {
            method: 'POST', body: fd, credentials: 'same-origin'
        }).then(r => r.json());
    }

    async function loadList() {
        const tbody = document.getElementById('backupListBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="padding:18px;text-align:center;color:#94a3b8;">加载中...</td></tr>';
        try {
            const res = await postBackup('list');
            if (res.status !== 'ok') throw new Error(res.message || '加载失败');
            const items = res.items || [];
            if (!items.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">暂无备份。点击上方按钮立即创建一份吧。</td></tr>';
                return;
            }
            tbody.innerHTML = items.map(it => {
                const labelTag = it.label ? ' <span style="background:#fef3c7;color:#92400e;border-radius:6px;padding:2px 6px;font-size:.78em;margin-left:6px;">' + esc(it.label) + '</span>' : '';
                // 完整性徽章
                let badge;
                if (it.integrity_ok === false) {
                    const tip = (it.integrity_errors || []).join('\n');
                    badge = '<span title="' + esc(tip) + '" style="background:#fee2e2;color:#b91c1c;border-radius:6px;padding:3px 8px;font-size:.78em;font-weight:600;">⚠ 已损坏</span>';
                } else if (it.legacy) {
                    badge = '<span title="旧格式备份，无 manifest 校验" style="background:#fef3c7;color:#92400e;border-radius:6px;padding:3px 8px;font-size:.78em;">旧格式</span>';
                } else if (it.integrity_ok === true) {
                    badge = '<span title="ZIP 结构校验通过" style="background:#dcfce7;color:#166534;border-radius:6px;padding:3px 8px;font-size:.78em;">✓ 完整</span>';
                } else {
                    badge = '<span style="color:#94a3b8;">—</span>';
                }
                if (it.has_uploads) {
                    badge += ' <span title="包含 uploads/ 附件" style="background:#e0f2fe;color:#075985;border-radius:6px;padding:3px 8px;font-size:.78em;margin-left:4px;">附件</span>';
                }
                // 额外对象（视图/触发器/存储过程）数量，便于确认备份的完整性
                const extras = [];
                if (it.views_count)    extras.push('视图 ' + it.views_count);
                if (it.triggers_count) extras.push('触发器 ' + it.triggers_count);
                if (it.routines_count) extras.push('过程/函数 ' + it.routines_count);
                const extrasText = extras.length ? '<div style="color:#94a3b8;font-size:.78em;margin-top:2px;">含 ' + esc(extras.join(' · ')) + '</div>' : '';
                const restoreDisabled = it.integrity_ok === false ? 'disabled' : '';
                const restoreStyle = it.integrity_ok === false
                    ? 'padding:6px 12px;font-size:.85em;background:#94a3b8;color:#fff;border-color:#94a3b8;cursor:not-allowed;'
                    : 'padding:6px 12px;font-size:.85em;background:#16a34a;color:#fff;border-color:#16a34a;';
                return '<tr style="border-top:1px solid #f1f5f9;">'
                    + '<td style="padding:10px 12px;font-family:Menlo,Consolas,monospace;font-size:.85em;color:#334155;">' + esc(it.file) + labelTag + '</td>'
                    + '<td style="padding:10px 12px;color:#475569;">' + esc(it.mtime_human) + '</td>'
                    + '<td style="padding:10px 12px;color:#475569;">' + esc(fmtSize(it.size)) + '</td>'
                    + '<td style="padding:10px 12px;color:#475569;">' + (it.tables_count|0) + ' 张 / ' + (it.rows_total|0) + ' 行' + extrasText + '</td>'
                    + '<td style="padding:10px 12px;">' + badge + '</td>'
                    + '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">'
                    +   '<a href="' + ENDPOINT + '?action=download&file=' + encodeURIComponent(it.file) + '" class="btn-secondary" style="padding:6px 12px;font-size:.85em;text-decoration:none;display:inline-block;" title="下载 ZIP">下载</a> '
                    +   '<a href="' + ENDPOINT + '?action=download_sha256&file=' + encodeURIComponent(it.file) + '" class="btn-secondary" style="padding:6px 12px;font-size:.85em;text-decoration:none;display:inline-block;" title="下载 SHA-256 校验文件">SHA</a> '
                    +   '<button type="button" class="btn-secondary" style="padding:6px 12px;font-size:.85em;" data-action="verify" data-file="' + esc(it.file) + '">校验</button> '
                    +   '<button type="button" class="btn-secondary" style="' + restoreStyle + '" data-action="restore" data-file="' + esc(it.file) + '" data-uploads="' + (it.has_uploads ? '1' : '0') + '" ' + restoreDisabled + '>恢复</button> '
                    +   '<button type="button" class="btn-secondary" style="padding:6px 12px;font-size:.85em;color:#dc2626;border-color:#fca5a5;" data-action="delete" data-file="' + esc(it.file) + '">删除</button>'
                    + '</td>'
                    + '</tr>';
            }).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:18px;text-align:center;color:#dc2626;">加载失败：' + esc(e.message) + '</td></tr>';
        }
    }

    async function createBackup(download) {
        const btn = download
            ? document.getElementById('backupCreateAndDownloadBtn')
            : document.getElementById('backupCreateBtn');
        const hint = document.getElementById('backupCreateHint');
        const includeUploads = document.getElementById('backupIncludeUploads').checked;
        if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = '正在备份...'; }
        if (hint) hint.textContent = '请稍候，正在导出全部数据...';
        try {
            const body = {};
            if (includeUploads) body.include_uploads = '1';
            const res = await postBackup('create', body);
            if (res.status !== 'ok') throw new Error(res.message || '备份失败');
            if (hint) hint.textContent = '✓ 已生成 ' + res.file + ' (' + fmtSize(res.size) + ')';
            toast('备份创建成功', 'success');
            if (download) {
                window.location.href = ENDPOINT + '?action=download&file=' + encodeURIComponent(res.file);
            }
            await loadList();
        } catch (e) {
            if (hint) hint.textContent = '✗ ' + e.message;
            toast('备份失败：' + e.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset._t || (download ? '创建并下载到本地' : '创建备份并保存到服务器'); }
        }
    }

    async function doRestore(file, hasUploads) {
        const pwd = prompt('恢复操作会覆盖当前数据库！\n请输入管理员密码以确认：');
        if (pwd === null) return;
        if (!pwd) { toast('已取消', 'info'); return; }
        let restoreUploads = '0';
        if (hasUploads === '1' && confirm('该备份包含 uploads/ 文件。\n是否同时还原上传文件？')) {
            restoreUploads = '1';
        }
        try {
            const res = await postBackup('restore', {
                file: file,
                admin_password: pwd,
                restore_uploads: restoreUploads
            });
            if (res.status !== 'ok') throw new Error(res.message || '恢复失败');
            let msg = '✓ 恢复完成，共执行 ' + res.executed + ' 条 SQL';
            if (res.pre_snapshot) msg += '\n已自动创建恢复前快照：' + res.pre_snapshot;
            if (res.errors && res.errors.length) msg += '\n⚠ ' + res.errors.length + ' 条语句失败，请检查日志';
            alert(msg);
            await loadList();
        } catch (e) {
            toast('恢复失败：' + e.message, 'error');
        }
    }

    async function doVerify(file) {
        try {
            toast('正在逐条目校验哈希，请稍候...', 'info');
            const res = await postBackup('verify', { file: file });
            if (res.status !== 'ok') throw new Error(res.message || '校验失败');
            let msg = '文件：' + file + '\nSHA-256: ' + (res.file_sha256 || '未计算');
            if (res.ok) {
                msg += res.legacy
                    ? '\n\n✓ ZIP 结构完整（旧格式备份，无 manifest 哈希索引）'
                    : '\n\n✓ 全部条目哈希校验通过，文件未被污染。';
            } else {
                msg += '\n\n✗ 检测到问题：\n - ' + (res.errors || []).join('\n - ');
            }
            alert(msg);
            await loadList();
        } catch (e) {
            toast('校验失败：' + e.message, 'error');
        }
    }

    async function doDelete(file) {
        if (!confirm('确定要删除备份 ' + file + ' 吗？此操作不可恢复。')) return;
        try {
            const res = await postBackup('delete', { file: file });
            if (res.status !== 'ok') throw new Error(res.message || '删除失败');
            toast('已删除', 'success');
            await loadList();
        } catch (e) {
            toast('删除失败：' + e.message, 'error');
        }
    }

    async function doUploadRestore() {
        const fileInput = document.getElementById('backupUploadFile');
        const f = fileInput && fileInput.files && fileInput.files[0];
        if (!f) { toast('请先选择 .zip 备份文件', 'error'); return; }
        const pwd = prompt('上传并恢复将覆盖当前数据库！\n请输入管理员密码以确认：');
        if (pwd === null) return;
        if (!pwd) { toast('已取消', 'info'); return; }
        const restoreUploads = document.getElementById('backupUploadRestoreUploads').checked ? '1' : '0';
        const fd = new FormData();
        fd.append('backup_file', f);
        fd.append('admin_password', pwd);
        fd.append('restore_uploads', restoreUploads);
        const btn = document.getElementById('backupUploadRestoreBtn');
        if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = '正在上传并恢复...'; }
        try {
            const res = await postBackup('upload_restore', fd);
            if (res.status !== 'ok') throw new Error(res.message || '恢复失败');
            let msg = '✓ 恢复完成，共执行 ' + res.executed + ' 条 SQL';
            if (res.pre_snapshot) msg += '\n已自动创建恢复前快照：' + res.pre_snapshot;
            if (res.errors && res.errors.length) msg += '\n⚠ ' + res.errors.length + ' 条语句失败';
            alert(msg);
            if (fileInput) fileInput.value = '';
            await loadList();
        } catch (e) {
            toast('恢复失败：' + e.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset._t || '上传并恢复'; }
        }
    }

    function renderRepairResult(res) {
        const box = document.getElementById('dbRepairResult');
        if (!box) return;
        const stepIcon = { ok: '✓', warn: '⚠', error: '✗', skip: '–' };
        const stepColor = { ok: '#16a34a', warn: '#b45309', error: '#dc2626', skip: '#94a3b8' };
        const steps = res.steps || [];
        let html = '';
        if (res.pre_snapshot) {
            html += '<div style="font-size:.85em;color:#475569;margin-bottom:8px;">已生成修复前快照：<code>' + esc(res.pre_snapshot) + '</code></div>';
        }
        html += '<div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">';
        steps.forEach(s => {
            const st = s.status || 'ok';
            const details = [];
            const d = s.details || {};
            ['removed','converted','optimized','cleaned','problems'].forEach(k => {
                if (Array.isArray(d[k])) d[k].forEach(x => details.push(x));
            });
            html += '<div style="padding:10px 12px;border-top:1px solid #f1f5f9;">'
                + '<div style="display:flex;align-items:center;gap:8px;">'
                +   '<span style="color:' + (stepColor[st] || '#475569') + ';font-weight:700;">' + (stepIcon[st] || '') + '</span>'
                +   '<span style="font-weight:600;color:#334155;">' + esc(s.name) + '</span>'
                +   '<span style="color:#64748b;font-size:.88em;">' + esc(s.message || '') + '</span>'
                + '</div>';
            if (details.length) {
                html += '<ul style="margin:6px 0 0 26px;padding:0;color:#64748b;font-size:.82em;line-height:1.6;">'
                    + details.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
            }
            html += '</div>';
        });
        html += '</div>';
        box.innerHTML = html;
    }

    async function doRepair() {
        const opts = {
            check_repair:      document.getElementById('repairCheckRepair'),
            normalize_charset: document.getElementById('repairNormalizeCharset'),
            optimize:          document.getElementById('repairOptimize'),
            clean_orphans:     document.getElementById('repairCleanOrphans'),
        };
        const cleanOrphans = opts.clean_orphans && opts.clean_orphans.checked;
        let confirmMsg = '将执行数据库修复 / 优化，并在执行前自动生成一份快照。\n是否继续？';
        if (cleanOrphans) {
            confirmMsg = '⚠ 你勾选了「清理孤儿数据」，将永久删除引用了不存在父记录的脏数据。\n执行前会自动生成快照。\n确定继续吗？';
        }
        if (!confirm(confirmMsg)) return;
        const pwd = prompt('数据库修复属于结构级操作。\n请输入管理员密码以确认：');
        if (pwd === null) return;
        if (!pwd) { toast('已取消', 'info'); return; }

        const btn = document.getElementById('dbRepairBtn');
        const box = document.getElementById('dbRepairResult');
        if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = '正在修复...'; }
        if (box) box.innerHTML = '<div style="color:#94a3b8;font-size:.88em;">正在执行，请稍候（大库可能耗时较长）...</div>';
        try {
            const res = await postBackup('repair', {
                admin_password:    pwd,
                check_repair:      opts.check_repair && opts.check_repair.checked ? '1' : '0',
                normalize_charset: opts.normalize_charset && opts.normalize_charset.checked ? '1' : '0',
                optimize:          opts.optimize && opts.optimize.checked ? '1' : '0',
                clean_orphans:     cleanOrphans ? '1' : '0',
            });
            // 即使后端返回 error，只要带 steps 也展示明细
            if (res.steps) renderRepairResult(res);
            if (res.status !== 'ok') {
                toast(res.message || '修复过程中出现错误', 'error');
            } else {
                toast('修复 / 优化完成', 'success');
            }
            await loadList();
        } catch (e) {
            toast('修复失败：' + e.message, 'error');
            if (box) box.innerHTML = '<div style="color:#dc2626;font-size:.88em;">请求失败：' + esc(e.message) + '</div>';
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset._t || '开始修复 / 优化'; }
        }
    }

    function init() {
        const pane = document.getElementById('tab-backup');
        if (!pane || pane.dataset._inited) return;
        pane.dataset._inited = '1';

        const c1 = document.getElementById('backupCreateBtn');
        if (c1) c1.addEventListener('click', () => createBackup(false));
        const c2 = document.getElementById('backupCreateAndDownloadBtn');
        if (c2) c2.addEventListener('click', () => createBackup(true));
        const c3 = document.getElementById('backupUploadRestoreBtn');
        if (c3) c3.addEventListener('click', doUploadRestore);
        const c4 = document.getElementById('dbRepairBtn');
        if (c4) c4.addEventListener('click', doRepair);

        const tbody = document.getElementById('backupListBody');
        if (tbody) tbody.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const file = btn.dataset.file;
            if (action === 'delete') doDelete(file);
            else if (action === 'restore') doRestore(file, btn.dataset.uploads);
            else if (action === 'verify') doVerify(file);
        });

        loadList();
    }

    function maybeInit() {
        const pane = document.getElementById('tab-backup');
        if (pane && pane.style.display !== 'none') init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', maybeInit);
    } else {
        maybeInit();
    }

    // 切换到备份 tab 时初始化
    const _origSwitchTab = window.switchTab;
    window.switchTab = function (tabKey) {
        if (typeof _origSwitchTab === 'function') _origSwitchTab(tabKey);
        if (tabKey === 'backup') init();
    };
})();
