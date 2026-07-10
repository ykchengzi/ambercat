function updateModeCards() {
    document.querySelectorAll('.server-mode-card').forEach(function(card) {
        var radio = card.querySelector('input[type="radio"]');
        card.classList.toggle('is-active', radio && radio.checked);
    });
    var netEaseRadio = document.querySelector('input[name="site[server_mode]"][value="netease"]');
    var tierSection = document.getElementById('neteaseTierSection');
    if (tierSection) {
        tierSection.style.display = (netEaseRadio && netEaseRadio.checked) ? 'block' : 'none';
    }
}

function updateTierCards() {
    document.querySelectorAll('.tier-card').forEach(function(card) {
        var radio = card.querySelector('input[type="radio"]');
        card.classList.toggle('is-active', radio && radio.checked);
    });
}

function openLightbox(src) {
    var lb = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');
    img.src = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
});

// ============ Monitor Tab ============
(function() {
    var C = 263.9; // 2*PI*42
    var monInited = false;
    var monInterval = null;
    var monPassword = '';
    var monFetching = false;   // prevent concurrent requests
    var lastEtag = '';         // track ETag for 304 support
    var lastJson = '';         // detect unchanged data
    var staticRendered = false; // static fields only need one render

    function setRing(id, pct) {
        var el = document.getElementById(id);
        if (el) el.style.strokeDashoffset = (C * (1 - pct / 100)).toFixed(2);
    }
    function setText(id, val) {
        var el = document.getElementById(id);
        if (el && el.textContent !== String(val)) el.textContent = val;
    }
    function setHtml(id, html) {
        var el = document.getElementById(id);
        if (el && el.innerHTML !== html) el.innerHTML = html;
    }
    function fmtBytes(b) {
        if (b < 1024) return b.toFixed(0) + ' B/s';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB/s';
        return (b / 1048576).toFixed(2) + ' MB/s';
    }
    function fmtSize(bytes) {
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }
    function fmtTs(ts) {
        if (!ts) return '—';
        var d = new Date(ts * 1000);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    function getCsrf() {
        var input = document.querySelector('input[name="csrf"]');
        return input ? input.value : '';
    }

    var statusMap = {
        running: '<span class="mon-dot running"></span><strong style="color:var(--green)">运行中</strong>',
        stopped: '<span class="mon-dot stopped"></span><strong style="color:var(--red)">已停止</strong>',
        starting: '<span class="mon-dot stopped" style="background:var(--amber)"></span><strong style="color:var(--amber)">启动中</strong>',
        stopping: '<span class="mon-dot stopped" style="background:var(--amber)"></span><strong style="color:var(--amber)">停止中</strong>'
    };

    function fetchMonitorData() {
        // Skip if previous request still in-flight or page is hidden
        if (monFetching || document.hidden) return;
        monFetching = true;

        var headers = {};
        if (lastEtag) headers['If-None-Match'] = lastEtag;

        fetch('api.php?act=monitor', { headers: headers })
            .then(function(r) {
                // 304 Not Modified — data unchanged, skip DOM work entirely
                if (r.status === 304) { monFetching = false; return null; }
                var etag = r.headers.get('ETag');
                if (etag) lastEtag = etag;
                return r.json();
            })
            .then(function(res) {
                monFetching = false;
                if (res === null) return; // 304, nothing to do

                var errEl = document.getElementById('monError');
                var liveEl = document.getElementById('monLiveWrap');
                var ncEl = document.getElementById('monNotConfigured');
                var hintEl = document.getElementById('monRefreshHint');

                if (res.code !== 200) {
                    if (errEl) { errEl.textContent = res.message || '获取数据失败'; errEl.style.display = 'block'; }
                    if (res.code === 0 && ncEl) { ncEl.style.display = 'block'; if (liveEl) liveEl.style.display = 'none'; }
                    return;
                }
                if (errEl) errEl.style.display = 'none';
                if (ncEl) ncEl.style.display = 'none';
                if (liveEl) liveEl.style.display = 'flex';
                if (hintEl) hintEl.style.display = 'inline-flex';

                var D = res.data.Data;
                var U = D.UsageData || {};
                var plan = D.Plan || {};
                var os = D.OsInfo || {};
                var node = D.Node || {};
                var natList = res.data.NatList || [];
                monPassword = D.DefaultPass || '';

                // --- Live gauges (always update) ---
                var cpuPct = Math.min(100, Math.max(0, (U.CPU || 0)));
                var maxMem = U.MaxMem || 1;
                var freeMem = U.FreeMem || 0;
                var usedMem = U.UsedMem > 0 ? U.UsedMem : (maxMem - freeMem);
                var memPct = Math.min(100, Math.max(0, (usedMem / maxMem) * 100));

                setRing('gaugeFilCpu', cpuPct);
                setText('gaugePctCpu', cpuPct.toFixed(1) + '%');
                setRing('gaugeFilMem', memPct);
                setText('gaugePctMem', memPct.toFixed(0) + '%');
                setText('gaugeValUp', fmtBytes(U.NetOut || 0));
                setText('gaugeValDown', fmtBytes(U.NetIn || 0));

                // Disks
                var disksHtml = '';
                if (U.Disks) {
                    Object.keys(U.Disks).forEach(function(dk) {
                        var disk = U.Disks[dk];
                        var pct = disk.Total > 0 ? ((disk.Used / disk.Total) * 100) : 0;
                        var cls = pct > 90 ? 'danger' : (pct > 75 ? 'warn' : '');
                        disksHtml += '<div class="mon-disk-item2">'
                            + '<div class="mon-disk-hdr2"><span>' + escHtml(dk) + '</span><span>' + fmtSize(disk.Used) + ' / ' + fmtSize(disk.Total) + '</span></div>'
                            + '<div class="mon-disk-track"><div class="mon-disk-fill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></div></div>'
                            + '</div>';
                    });
                }
                setHtml('monDisksContainer', disksHtml);

                // Status badge
                var badge = document.getElementById('monStatusBadge');
                if (badge) {
                    var newCls = 'mon-status-badge ' + (D.Status || 'stopped');
                    if (badge.className !== newCls) badge.className = newCls;
                    var statusLabels = { running: '运行中', stopped: '已停止', starting: '启动中', stopping: '停止中' };
                    setText('monStatusBadge', statusLabels[D.Status] || D.Status);
                    badge.style.display = 'inline-flex';
                }

                // Status row
                setHtml('monStatus', statusMap[D.Status] || statusMap.stopped);
                setText('monCpuPower', D.CpuPoint !== undefined ? D.CpuPoint.toLocaleString() : '—');

                // --- Static fields: render only once ---
                if (!staticRendered) {
                    staticRendered = true;

                    setText('monProductId', D.ID);
                    setText('monTag', D.Tag || '未设置');
                    setText('monNode', node.ChineseName || '—');
                    setText('monDailyCost', res.data.ConfigPrice ? res.data.ConfigPrice + ' 积分/天' : '—');
                    setText('monCreateDate', fmtTs(D.CreateDate));
                    setText('monExpire', fmtTs(D.ExpDate));

                    // Remote connection
                    var rdpPort = '';
                    var rdpUser = os.os_type === 'windows' ? 'Administrator' : 'root';
                    for (var n = 0; n < natList.length; n++) {
                        if (natList[n].Tag && natList[n].Tag.indexOf('rdp') !== -1) {
                            rdpPort = natList[n].PortOut; break;
                        }
                        if (natList[n].PortIn === 3389 || natList[n].PortIn === 22) {
                            rdpPort = natList[n].PortOut;
                        }
                    }
                    setText('monRdpAddr', rdpPort ? (D.NatPublicDomain + ':' + rdpPort) : (D.NatPublicDomain || '—'));
                    setText('monRdpUser', rdpUser);

                    // Config info
                    setText('monPlan', plan.chinese || '—');
                    setText('monSpecs', D.CPU + ' 核 / ' + D.Memory + ' GB / ' + D.NetOut + ' Mbps 出 / ' + D.NetIn + ' Mbps 入');
                    setText('monOs', os.chinese_name || os.name || '—');
                    setText('monZone', D.Zone || '—');
                    setText('monNatIp', D.NatPublicIP || '—');

                    // NAT list
                    var natHtml = '';
                    if (natList.length === 0) {
                        natHtml = '<div class="mon-row" style="border-bottom:none"><span class="mon-rl" style="color:var(--text-muted);">无端口映射</span></div>';
                    } else {
                        natList.forEach(function(nat, i) {
                            var last = i === natList.length - 1;
                            natHtml += '<div class="mon-row"' + (last ? ' style="border-bottom:none"' : '') + '>'
                                + '<span class="mon-rl">' + escHtml(nat.Tag || ('端口 ' + nat.PortIn)) + ' <span class="mon-nat-tag">' + escHtml(nat.PortType) + '</span></span>'
                                + '<span class="mon-rv">' + escHtml(D.NatPublicDomain + ':' + nat.PortOut) + ' → :' + nat.PortIn
                                + '<button class="mon-copy-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + escHtml(D.NatPublicDomain + ':' + nat.PortOut) + '\')">复制</button>'
                                + '</span></div>';
                        });
                    }
                    setHtml('monNatList', natHtml);
                }
            })
            .catch(function(err) {
                monFetching = false;
                var errEl = document.getElementById('monError');
                if (errEl) { errEl.textContent = '请求失败: ' + err.message; errEl.style.display = 'block'; }
            });
    }

    // Action button helpers (global)
    var actionLabels = { start: '开机', stop: '关机', restart: '重启', reset_pass: '重置密码' };
    var actionConfirm = { stop: '确定要关机吗？', restart: '确定要重启服务器吗？', reset_pass: '确定要重置密码吗？重置后原密码将失效，新密码请在刷新后查看！' };
    var actionOkMsg = {
        start: '开机指令已发送，服务器正在启动中…',
        stop: '关机指令已发送，服务器正在关闭中…',
        restart: '重启指令已发送，服务器正在重启中…',
        reset_pass: '密码重置成功！请等待刷新后在下方查看新密码。'
    };
    var friendlyErrors = {
        401: 'API 密钥无效或已过期，请检查配置',
        403: '无权操作该实例，请确认 API 密钥对应的账号拥有此实例',
        404: '实例不存在，请检查实例 ID 是否正确',
        409: '当前状态不允许此操作（如：服务器已在运行中无法再次开机）',
        429: '操作过于频繁，请稍后再试',
        500: '雨云服务器内部错误，请稍后再试'
    };

    window.monAction = function(action) {
        var label = actionLabels[action] || action;
        if (actionConfirm[action] && !window.confirm(actionConfirm[action])) return;

        var allBtns = document.querySelectorAll('.mon-action-btn');
        allBtns.forEach(function(b) { b.disabled = true; });

        var msgEl = document.getElementById('monActionMsg');
        if (msgEl) { msgEl.className = 'mon-action-msg'; msgEl.textContent = label + ' 指令发送中…'; msgEl.style.display = 'block'; }

        var body = new URLSearchParams();
        body.append('action', action);
        body.append('csrf', getCsrf());

        fetch('api.php?act=monitor_action', { method: 'POST', body: body })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                allBtns.forEach(function(b) { b.disabled = false; });
                if (res.code === 200) {
                    if (msgEl) { msgEl.className = 'mon-action-msg ok'; msgEl.textContent = actionOkMsg[action] || (label + ' 操作成功'); }
                    // Force re-fetch static fields after reset_pass to show new password
                    if (action === 'reset_pass') staticRendered = false;
                    // Refresh data after a short delay to reflect new status
                    setTimeout(function() { lastEtag = ''; monFetching = false; fetchMonitorData(); }, 2500);
                } else {
                    var errText = friendlyErrors[res.code] || res.message || '未知错误（错误码 ' + res.code + '）';
                    if (msgEl) { msgEl.className = 'mon-action-msg err'; msgEl.textContent = label + ' 失败：' + errText; }
                }
                if (msgEl) setTimeout(function() { msgEl.style.display = 'none'; }, 3000);
            })
            .catch(function(err) {
                allBtns.forEach(function(b) { b.disabled = false; });
                if (msgEl) { msgEl.className = 'mon-action-msg err'; msgEl.textContent = '网络请求失败，请检查网络连接后重试'; }
                setTimeout(function() { if (msgEl) msgEl.style.display = 'none'; }, 3000);
            });
    };

    // Password helpers (global)
    window.monCopyPw = function() {
        if (monPassword && navigator.clipboard) {
            navigator.clipboard.writeText(monPassword);
        }
    };
    window.monTogglePw = function() {
        var d = document.getElementById('monPwDots');
        var btn = document.getElementById('monPwToggleBtn');
        if (!d) return;
        var showing = d.getAttribute('data-show');
        if (showing) {
            d.textContent = '••••••••••';
            d.removeAttribute('data-show');
            if (btn) btn.textContent = '查看';
        } else {
            d.textContent = monPassword || '—';
            d.setAttribute('data-show', '1');
            if (btn) btn.textContent = '隐藏';
        }
    };

    function startMonitor() {
        if (!monInited) {
            monInited = true;
            fetchMonitorData();
        } else {
            // Returning to tab — fetch immediately then restart interval
            fetchMonitorData();
        }
        if (!monInterval) {
            monInterval = setInterval(fetchMonitorData, 3000);
        }
    }

    function stopMonitor() {
        if (monInterval) {
            clearInterval(monInterval);
            monInterval = null;
        }
    }

    // Pause/resume polling when browser tab is hidden/visible
    document.addEventListener('visibilitychange', function() {
        if (!monInited) return;
        if (document.hidden) {
            stopMonitor();
        } else {
            startMonitor();
        }
    });

    var _origSwitch = window.switchTab;
    window.switchTab = function(key) {
        if (typeof _origSwitch === 'function') _origSwitch(key);
        if (key === 'monitor') {
            setTimeout(startMonitor, 50);
        } else {
            stopMonitor();
        }
    };
    if (document.getElementById('tab-monitor') &&
        document.getElementById('tab-monitor').style.display !== 'none') {
        setTimeout(startMonitor, 300);
    }
})();
