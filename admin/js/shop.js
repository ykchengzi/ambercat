/**
 * 后台商城 JS
 * 依赖 admin.js 中暴露的 fetchJson / showToast / openModal 等（如不存在则使用本文件回退）
 */
(function (global) {
    'use strict';

    var SHOP_CSRF = (window.adminCsrf || (document.querySelector('input[name="csrf"]') || {}).value || '');
    var STATUS_TRANSITIONS = {
        pending_payment: [['paid', '标记已支付'], ['cancelled', '取消订单']],
        paid: [['shipped', '标记已发货'], ['refunded', '退款']],
        shipped: [['completed', '标记已完成'], ['refunded', '退款']],
        completed: [],
        cancelled: [],
        refunded: [],
    };

    function _toast(msg, type) {
        if (typeof window.showToast === 'function') return window.showToast(msg, type || 'info');
        alert(msg);
    }

    function _esc(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function _formatTime(s) {
        if (!s) return '-';
        return String(s).replace('T', ' ').slice(0, 19);
    }

    function shopFetch(action, data) {
        var body = new FormData();
        body.append('action', action);
        body.append('csrf', SHOP_CSRF);
        if (data) {
            Object.keys(data).forEach(function (k) {
                if (data[k] !== undefined && data[k] !== null) body.append(k, data[k]);
            });
        }
        return fetch('user_actions.php', { method: 'POST', body: body, credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
    }

    function shopPayTypeChanged(radio) {
        var sel = document.getElementById('shopPaymentType');
        if (sel) sel.value = radio.value;
        document.querySelectorAll('.pay-type-tab').forEach(function (tab) {
            var r = tab.querySelector('input[type="radio"]');
            if (r) tab.classList.toggle('is-active', r.value === radio.value);
        });
    }

    function shopPayToggleKeyVisible(btn) {
        var wrap = btn.parentElement;
        var input = wrap ? wrap.querySelector('.pay-key-input') : null;
        if (!input) return;
        var showIcon = btn.querySelector('.pay-eye-show');
        var hideIcon = btn.querySelector('.pay-eye-hide');
        if (input.type === 'password') {
            input.type = 'text';
            if (showIcon) showIcon.style.display = 'none';
            if (hideIcon) hideIcon.style.display = '';
        } else {
            input.type = 'password';
            if (showIcon) showIcon.style.display = '';
            if (hideIcon) hideIcon.style.display = 'none';
        }
    }

    function shopPayCopyUrl(elId, btn) {
        var el = document.getElementById(elId);
        if (!el || !el.textContent.trim()) { _toast('地址为空', 'error'); return; }
        navigator.clipboard.writeText(el.textContent.trim()).then(function () {
            var origHTML = btn.innerHTML;
            btn.classList.add('is-copied');
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已复制';
            setTimeout(function () {
                btn.classList.remove('is-copied');
                btn.innerHTML = origHTML;
            }, 2000);
        }).catch(function () { _toast('复制失败，请手动选取', 'error'); });
    }

    function shopPayUpdateStatusBar(d) {
        var bar = document.getElementById('shopPayStatusBar');
        if (!bar) return;
        var items = bar.querySelectorAll('.pay-status-item');
        if (items.length < 4) return;
        function setItem(item, isOn, val) {
            var dot = item.querySelector('.pay-status-dot');
            var valEl = item.querySelector('.pay-status-val');
            if (dot) dot.className = 'pay-status-dot ' + (isOn ? 'is-on' : 'is-off');
            if (valEl) valEl.textContent = val;
        }
        setItem(items[0], !!d.enabled, d.enabled ? '已启用' : '未启用');
        var pidTail = d.pid ? ('···' + String(d.pid).slice(-4)) : '未填写';
        setItem(items[1], !!d.pid, pidTail);
        setItem(items[2], !!d.key_set, d.key_set ? '已保存' : '未填写');
        var readyDot = items[3].querySelector('.pay-status-dot');
        var readyVal = items[3].querySelector('.pay-status-val');
        if (readyDot) readyDot.className = 'pay-status-dot ' + (d.ready ? 'is-ready' : 'is-warn');
        if (readyVal) readyVal.textContent = d.ready ? '就绪' : '未就绪';
    }

    function shopPaymentLoadSettings() {
        shopFetch('shop_payment_get_settings').then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '加载支付设置失败', 'error'); return; }
            var d = res.data || {};
            var el;
            el = document.getElementById('shopPaymentEnabled'); if (el) el.checked = !!d.enabled;
            el = document.getElementById('shopPaymentBaseUrl'); if (el) el.value = d.base_url || '';
            el = document.getElementById('shopPaymentPid'); if (el) el.value = d.pid || '';
            var keyEl = document.getElementById('shopPaymentKey');
            if (keyEl) { keyEl.value = ''; keyEl.placeholder = d.key_set ? '留空保持不变' : '输入商户密钥'; }
            var keyBadge = document.querySelector('.pay-key-badge');
            if (keyBadge) {
                keyBadge.className = 'pay-key-badge ' + (d.key_set ? 'pay-key-badge--set' : 'pay-key-badge--unset');
                keyBadge.textContent = d.key_set ? '已配置' : '未配置';
            }
            el = document.getElementById('shopPaymentType'); if (el) el.value = d.type || 'alipay';
            document.querySelectorAll('.pay-type-tab input[name="_payTypeRadio"]').forEach(function (r) {
                r.checked = r.value === (d.type || 'alipay');
                r.parentElement.classList.toggle('is-active', r.checked);
            });
            el = document.getElementById('shopPaymentSitename'); if (el) el.value = d.sitename || 'FoxMC 商城';
            var enabledTypes = d.types || ['alipay', 'wxpay', 'qqpay'];
            var elA = document.getElementById('shopPayTypeAlipay'); if (elA) elA.checked = enabledTypes.indexOf('alipay') !== -1;
            var elW = document.getElementById('shopPayTypeWxpay');  if (elW) elW.checked = enabledTypes.indexOf('wxpay')  !== -1;
            var elQ = document.getElementById('shopPayTypeQqpay');  if (elQ) elQ.checked = enabledTypes.indexOf('qqpay')  !== -1;
            el = document.getElementById('shopPaymentNotifyUrl'); if (el) el.textContent = d.notify_url || '';
            el = document.getElementById('shopPaymentReturnUrl'); if (el) el.textContent = d.return_url || '';
            shopPayUpdateStatusBar(d);
        });
    }

    function shopPaymentSaveSettings(ev) {
        ev.preventDefault();
        var btn = document.getElementById('shopPaySaveBtn');
        if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
        var data = {
            shop_pay_enabled: document.getElementById('shopPaymentEnabled').checked ? 1 : 0,
            shop_pay_base_url: document.getElementById('shopPaymentBaseUrl').value || '',
            shop_pay_pid: document.getElementById('shopPaymentPid').value || '',
            shop_pay_key: document.getElementById('shopPaymentKey').value || '',
            shop_pay_type: document.getElementById('shopPaymentType').value || '',
            shop_pay_sitename: document.getElementById('shopPaymentSitename').value || '',
            shop_pay_key_clear: document.getElementById('shopPaymentClearKey').checked ? 1 : 0,
            shop_pay_type_alipay: (document.getElementById('shopPayTypeAlipay') || {}).checked ? 1 : 0,
            shop_pay_type_wxpay:  (document.getElementById('shopPayTypeWxpay')  || {}).checked ? 1 : 0,
            shop_pay_type_qqpay:  (document.getElementById('shopPayTypeQqpay')  || {}).checked ? 1 : 0,
        };
        shopFetch('shop_payment_save_settings', data).then(function (res) {
            if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            if (res.status !== 'success') { _toast(res.message || '保存支付设置失败', 'error'); return; }
            _toast(res.message || '支付设置已保存', 'success');
            document.getElementById('shopPaymentKey').value = '';
            document.getElementById('shopPaymentClearKey').checked = false;
            shopPaymentLoadSettings();
        }).catch(function () {
            if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            _toast('网络错误', 'error');
        });
        return false;
    }

    function shopPaymentRunTest(mode) {
        var out = document.getElementById('shopPaymentTestResult');
        if (out) {
            out.style.display = 'block';
            out.innerHTML = '<div class="pay-test-result-head">测试中…</div>';
        }
        shopFetch('shop_payment_test', {
            mode: mode || 'page',
            money: (document.getElementById('shopPaymentTestMoney') || {}).value || '0.01',
            name: (document.getElementById('shopPaymentTestName') || {}).value || 'FoxMC 支付测试',
            type: (document.getElementById('shopPaymentTestType') || {}).value || '',
        }).then(function (res) {
            if (res.status !== 'success') {
                if (out) out.innerHTML = '<div class="pay-test-result-head" style="color:#fca5a5;">✗ 测试失败</div>'
                    + '<div class="pay-test-result-body"><div class="pay-test-row">'
                    + '<span class="pay-test-row-key">错误</span>'
                    + '<span class="pay-test-row-val" style="color:#fca5a5;">' + _esc(res.message || '未知错误') + '</span>'
                    + '</div></div>';
                _toast(res.message || '测试失败', 'error');
                return;
            }
            var d = res.data || {};
            if (out) {
                var modeLabel = mode === 'api' ? 'API' : '页面跳转';
                var rows = [];
                rows.push({ k: '订单号', v: d.out_trade_no || '-', link: false });
                if (d.submit_url) rows.push({ k: '支付链接', v: d.submit_url, link: true });
                if (d.api_http_code) rows.push({ k: 'HTTP', v: String(d.api_http_code), link: false });
                if (d.api_pay_url) rows.push({ k: '收款码', v: d.api_pay_url, link: true });
                if (d.api_response) rows.push({ k: '响应', v: JSON.stringify(d.api_response, null, 2), link: false });
                out.innerHTML = '<div class="pay-test-result-head">✓ ' + modeLabel + ' 测试结果</div>'
                    + '<div class="pay-test-result-body">'
                    + rows.map(function (row) {
                        return '<div class="pay-test-row">'
                            + '<span class="pay-test-row-key">' + _esc(row.k) + '</span>'
                            + '<span class="pay-test-row-val">'
                            + (row.link
                                ? '<a href="' + _esc(row.v) + '" target="_blank" rel="noopener">' + _esc(row.v) + '</a>'
                                : _esc(row.v))
                            + '</span></div>';
                    }).join('')
                    + '</div>';
            }
            _toast(res.message || '测试完成', 'success');
            if (mode === 'page' && d.submit_url) window.open(d.submit_url, '_blank', 'noopener');
        }).catch(function () {
            if (out) out.innerHTML = '<div class="pay-test-result-head" style="color:#fca5a5;">✗ 网络错误</div>';
            _toast('网络错误', 'error');
        });
    }

    // ========== 商品分类下拉缓存 ==========
    var _categoriesCache = null;
    function shopGetCategories(force) {
        if (_categoriesCache && !force) return Promise.resolve(_categoriesCache);
        return shopFetch('shop_list_categories').then(function (res) {
            if (res.status === 'success') {
                _categoriesCache = res.data || [];
                return _categoriesCache;
            }
            return [];
        });
    }

    function _renderCategoryOptions(selectId, selectedId) {
        var sel = document.getElementById(selectId);
        if (!sel) return;
        shopGetCategories().then(function (cats) {
            var keep = sel.querySelector('option[value=""]');
            sel.innerHTML = '';
            if (keep) sel.appendChild(keep);
            cats.forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name + (c.is_active == 0 ? '（已停用）' : '');
                if (String(selectedId || '') === String(c.id)) opt.selected = true;
                sel.appendChild(opt);
            });
        });
    }

    // ========== 收益概览 ==========
    function shopLoadDashboard() {
        var statsBox = document.getElementById('shopDashboardStats');
        if (statsBox) statsBox.innerHTML = '<div class="shop-loading">加载中...</div>';
        shopFetch('shop_dashboard').then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '加载失败', 'error'); return; }
            var d = res.data;
            var cards = [
                { label: '总订单', value: d.total_orders, color: '#0f172a', tab: 'shop_orders' },
                { label: '待支付', value: d.pending_orders, color: '#f59e0b', tab: 'shop_orders' },
                { label: '进行中（已付/已发货）', value: d.paid_orders, color: '#2563eb', tab: 'shop_orders' },
                { label: '已完成', value: d.completed_orders, color: '#16a34a', tab: 'shop_orders' },
                { label: '累计收入（元）', value: '¥' + d.total_revenue, color: '#16a34a' },
                { label: '今日新订单', value: d.today_orders, color: '#0f172a', tab: 'shop_orders' },
                { label: '今日收入（元）', value: '¥' + d.today_revenue, color: '#16a34a' },
                { label: '上架商品', value: d.active_product_count + ' / ' + d.product_count, color: '#0f172a', tab: 'shop_products' },
                { label: '低库存商品', value: d.low_stock_count, color: d.low_stock_count > 0 ? '#dc2626' : '#94a3b8', tab: 'shop_inventory' },
            ];
            statsBox.innerHTML = cards.map(function (c) {
                var clickAttr = c.tab ? ' onclick="switchTab(\'' + c.tab + '\')" style="cursor:pointer;" title="点击查看"' : '';
                return '<div class="shop-metric-card"' + clickAttr + '>'
                    + '<div class="shop-metric-value" style="color:' + c.color + ';">' + _esc(c.value) + '</div>'
                    + '<div class="shop-metric-label">' + _esc(c.label) + '</div>'
                    + '</div>';
            }).join('');

            // 趋势：简单 SVG 折线（订单数 + 收入双轴）
            var trend = d.daily_trend || [];
            var chart = document.getElementById('shopTrendChart');
            if (chart && trend.length) {
                var maxCnt = Math.max(1, Math.max.apply(null, trend.map(function (t) { return t.count; })));
                var maxRev = Math.max(1, Math.max.apply(null, trend.map(function (t) { return t.revenue_cents; })));
                var W = 600, H = 180, padL = 30, padR = 30, padT = 14, padB = 26;
                var step = (W - padL - padR) / Math.max(1, trend.length - 1);
                var ptsCnt = trend.map(function (t, i) {
                    var x = padL + i * step;
                    var y = padT + (H - padT - padB) * (1 - t.count / maxCnt);
                    return x + ',' + y;
                }).join(' ');
                var ptsRev = trend.map(function (t, i) {
                    var x = padL + i * step;
                    var y = padT + (H - padT - padB) * (1 - t.revenue_cents / maxRev);
                    return x + ',' + y;
                }).join(' ');
                var labels = trend.map(function (t, i) {
                    if (i % 2 !== 0 && i !== trend.length - 1) return '';
                    var x = padL + i * step;
                    var d = t.date.slice(5);
                    return '<text x="' + x + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="#94a3b8">' + d + '</text>';
                }).join('');
                chart.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%">'
                    + '<polyline fill="none" stroke="#16a34a" stroke-width="2" points="' + ptsCnt + '"/>'
                    + '<polyline fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" points="' + ptsRev + '"/>'
                    + labels
                    + '<g font-size="11" font-family="sans-serif">'
                    + '<rect x="' + (W - 150) + '" y="6" width="10" height="2" fill="#16a34a"/><text x="' + (W - 134) + '" y="10" fill="#475569">订单数</text>'
                    + '<rect x="' + (W - 75) + '" y="6" width="10" height="2" fill="#2563eb"/><text x="' + (W - 59) + '" y="10" fill="#475569">收入</text>'
                    + '</g></svg>';
            } else if (chart) {
                chart.innerHTML = '<div class="shop-empty">暂无数据</div>';
            }

            // Top 商品
            var topBox = document.getElementById('shopTopProducts');
            if (topBox) {
                if (!d.top_products || !d.top_products.length) {
                    topBox.innerHTML = '<div class="shop-empty">暂无商品</div>';
                } else {
                    topBox.innerHTML = d.top_products.map(function (p, i) {
                        return '<div class="shop-row">'
                            + '<span class="shop-card-title">#' + (i + 1) + ' ' + _esc(p.name) + '</span>'
                            + '<span class="shop-meta">售 ' + (p.sales_count || 0) + ' · 余 ' + p.stock + '</span>'
                            + '</div>';
                    }).join('');
                }
            }

            // 最近订单
            var roBox = document.getElementById('shopRecentOrders');
            if (roBox) {
                if (!d.recent_orders || !d.recent_orders.length) {
                    roBox.innerHTML = '<div class="shop-empty">暂无订单</div>';
                } else {
                    roBox.innerHTML = d.recent_orders.map(function (o) {
                        return '<div class="shop-row shop-row--clickable" onclick="shopOpenOrderDetail(' + o.id + ')">'
                            + '<span class="shop-mono">' + _esc(o.order_no) + '</span>'
                            + '<span>' + _esc(o.username || '已注销') + '</span>'
                            + '<span style="color:#16a34a;font-weight:700;">¥' + _esc(o.total) + '</span>'
                            + '<span class="shop-badge shop-badge--gray">' + _esc(o.status_label) + '</span>'
                            + '<span class="shop-meta">' + _formatTime(o.created_at) + '</span>'
                            + '</div>';
                    }).join('');
                }
            }
        });
    }

    // ========== 商品管理 ==========
    var _shopProductsPage = 1;

    function shopLoadProducts(page) {
        _shopProductsPage = page || 1;
        var listBox = document.getElementById('shopProductsList');
        if (listBox) listBox.innerHTML = '<div class="shop-loading">加载中...</div>';
        // 顶部分类下拉
        _renderCategoryOptions('shopProductCategoryFilter');
        var filters = {
            page: _shopProductsPage,
            keyword: (document.getElementById('shopProductSearch') || {}).value || '',
            category_id: (document.getElementById('shopProductCategoryFilter') || {}).value || '',
            is_active: (document.getElementById('shopProductActiveFilter') || {}).value || '',
            low_stock: document.getElementById('shopProductLowStockFilter') && document.getElementById('shopProductLowStockFilter').checked ? 1 : '',
        };
        shopFetch('shop_list_products', filters).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '加载失败', 'error'); return; }
            _renderProductsList(res.data);
        });
    }

    function _renderProductsList(data) {
        var listBox = document.getElementById('shopProductsList');
        if (!listBox) return;
        // 批量操作栏
        var batchBar = document.getElementById('shopProductBatchBar');
        if (batchBar) batchBar.style.display = 'none';
        if (!data.items || !data.items.length) {
            listBox.innerHTML = '<div class="shop-empty">暂无商品，点击右上角"新增商品"开始</div>';
        } else {
            listBox.innerHTML = data.items.map(function (p) {
                var stockState = p.stock <= 0 ? 'out' : (p.stock <= 5 ? 'low' : 'ok');
                var cover = p.cover_image
                    ? '<img src="' + (p.cover_image.match(/^https?:\/\/|^\//) ? _esc(p.cover_image) : '../' + _esc(p.cover_image)) + '" class="shop-cover" loading="lazy" alt="" onerror="this.closest(\'.shop-cover-wrap\').classList.add(\'is-broken\')">'
                    : '';
                var nameAttr = _esc(p.name).replace(/'/g, '&#39;');
                var hasDiscount = Number(p.original_price_cents) > 0;
                return '<div class="shop-card shop-product-card' + (p.is_active == 1 ? '' : ' is-inactive') + '" data-pid="' + p.id + '">'
                    + '<div class="shop-cover-wrap' + (p.cover_image ? '' : ' is-broken') + '">'
                    + '<label class="shop-batch-check"><input type="checkbox" class="shop-product-check" value="' + p.id + '" data-active="' + p.is_active + '" onchange="shopBatchSelectionChanged()"></label>'
                    + cover
                    + '<span class="shop-cover-fallback">IMG</span>'
                    + '<span class="shop-cover-status shop-cover-status--' + (p.is_active == 1 ? 'on' : 'off') + '">' + (p.is_active == 1 ? '上架' : '下架') + '</span>'
                    + '</div>'
                    + '<div class="shop-card-main">'
                    + '<div class="shop-card-head">'
                    + '<strong class="shop-card-title">' + _esc(p.name) + '</strong>'
                    + (p.category_name ? '<span class="shop-badge shop-badge--soft-green">' + _esc(p.category_name) + '</span>' : '')
                    + '</div>'
                    + (p.subtitle ? '<div class="shop-subtitle">' + _esc(p.subtitle) + '</div>' : '')
                    + '<div class="shop-price-row">'
                    + '<span class="shop-price">¥' + _esc(p.price) + '</span>'
                    + (hasDiscount ? '<span class="shop-price-original">¥' + _esc(p.original_price) + '</span>' : '')
                    + '</div>'
                    + '<div class="shop-stats">'
                    + '<span class="shop-stat shop-stat--stock-' + stockState + '">库存 ' + p.stock + '</span>'
                    + '<span class="shop-stat">已售 ' + (p.sales_count || 0) + '</span>'
                    + '<span class="shop-stat">排序 ' + (p.sort_order || 0) + '</span>'
                    + '</div>'
                    + '</div>'
                    + '<div class="shop-actions">'
                    + '<button type="button" onclick="shopOpenProductEditor(' + p.id + ')" class="shop-btn shop-btn--primary">编辑</button>'
                    + '<button type="button" onclick="shopOpenStockModal(' + p.id + ',\'' + nameAttr + '\',' + p.stock + ')" class="shop-btn shop-btn--info">库存</button>'
                    + '<button type="button" onclick="shopToggleProductActive(' + p.id + ',' + (p.is_active == 1 ? 0 : 1) + ')" class="shop-btn shop-btn--muted">' + (p.is_active == 1 ? '下架' : '上架') + '</button>'
                    + '<button type="button" onclick="shopDeleteProduct(' + p.id + ')" class="shop-btn shop-btn--danger">删除</button>'
                    + '</div>'
                    + '</div>';
            }).join('');
        }
        _renderPagination('shopProductsPagination', data, shopLoadProducts);
    }

    function _renderPagination(elId, data, onPage) {
        var box = document.getElementById(elId);
        if (!box) return;
        var totalPages = Math.max(1, Math.ceil(data.total / data.per_page));
        if (totalPages <= 1) { box.innerHTML = ''; return; }
        var html = '';
        var cur = data.page;
        var btn = function (p, label, disabled, active) {
            return '<button type="button" ' + (disabled ? 'disabled' : 'onclick="(' + onPage.name + ')(' + p + ')"')
                + ' class="shop-page-btn' + (active ? ' is-active' : '') + '">' + label + '</button>';
        };
        html += btn(cur - 1, '上一页', cur <= 1, false);
        for (var i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - cur) <= 2) {
                html += btn(i, String(i), false, i === cur);
            } else if (Math.abs(i - cur) === 3) {
                html += '<span class="shop-meta" style="padding:6px 4px;">…</span>';
            }
        }
        html += btn(cur + 1, '下一页', cur >= totalPages, false);
        box.innerHTML = html;
    }

    function shopUpdateCoverPreview(url) {
        var wrap = document.getElementById('shopProductCoverPreviewWrap');
        var img  = document.getElementById('shopProductCoverPreview');
        if (!wrap || !img) return;
        var trimmed = (url || '').trim();
        if (trimmed) {
            img.src = trimmed.match(/^https?:\/\/|^\//) ? trimmed : '../' + trimmed;
            wrap.style.display = 'block';
        } else {
            img.src = '';
            wrap.style.display = 'none';
        }
    }

    function shopChooseProductCover() {
        var input = document.getElementById('shopProductCoverFile');
        if (!input) {
            _toast('上传控件未加载，请刷新页面后重试', 'error');
            return;
        }
        input.click();
    }

    function shopUploadProductCover(input) {
        var file = input.files && input.files[0];
        if (!file) return;
        var btn = document.getElementById('shopProductCoverUploadBtn');
        var hint = document.getElementById('shopProductCoverUploadHint');
        if (btn) { btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none'; }
        if (hint) hint.textContent = '上传中...';
        var body = new FormData();
        body.append('action', 'shop_upload_product_image');
        body.append('csrf', SHOP_CSRF);
        body.append('cover_image', file);
        fetch('user_actions.php', { method: 'POST', body: body, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
                if (hint) hint.textContent = 'JPG / PNG / GIF / WebP，上限 5 MB';
                input.value = '';
                if (res.status !== 'success') { _toast(res.message || '上传失败', 'error'); return; }
                var uploadedUrl = res.url || (res.data && res.data.url) || '';
                if (!uploadedUrl) { _toast('上传成功，但接口未返回图片路径', 'error'); return; }
                document.getElementById('shopProductCover').value = uploadedUrl;
                shopUpdateCoverPreview(uploadedUrl);
                _toast('封面图已上传', 'success');
            })
            .catch(function () {
                if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
                if (hint) hint.textContent = 'JPG / PNG / GIF / WebP，上限 5 MB';
                input.value = '';
                _toast('上传请求失败', 'error');
            });
    }

    function shopClearCover() {
        var inp = document.getElementById('shopProductCover');
        if (inp) inp.value = '';
        shopUpdateCoverPreview('');
        var fi = document.getElementById('shopProductCoverFile');
        if (fi) fi.value = '';
    }

    // 弹窗：商品编辑器
    function shopOpenProductEditor(id) {
        var modal = document.getElementById('shopProductModal');
        var titleEl = document.getElementById('shopProductModalTitle');
        var form = document.getElementById('shopProductForm');
        form.reset();
        document.getElementById('shopProductId').value = '';
        _renderCategoryOptions('shopProductCategory');
        if (id) {
            titleEl.textContent = '编辑商品';
            shopFetch('shop_get_product', { id: id }).then(function (res) {
                if (res.status !== 'success') { _toast(res.message || '加载失败', 'error'); return; }
                var p = res.data;
                document.getElementById('shopProductId').value = p.id;
                document.getElementById('shopProductName').value = p.name || '';
                document.getElementById('shopProductSubtitle').value = p.subtitle || '';
                _renderCategoryOptions('shopProductCategory', p.category_id);
                document.getElementById('shopProductSort').value = p.sort_order || 0;
                document.getElementById('shopProductPrice').value = p.price || '';
                document.getElementById('shopProductOriginalPrice').value = (Number(p.original_price_cents) > 0 ? p.original_price : '');
                document.getElementById('shopProductStock').value = p.stock || 0;
                var minQtyEl = document.getElementById('shopProductMinQty');
                if (minQtyEl) minQtyEl.value = (Number(p.min_qty) > 0 ? p.min_qty : 1);
                var maxQtyEl = document.getElementById('shopProductMaxQty');
                if (maxQtyEl) maxQtyEl.value = (Number(p.max_qty) > 0 ? p.max_qty : 0);
                document.getElementById('shopProductCover').value = p.cover_image || '';
                document.getElementById('shopProductDescription').value = p.description || '';
                document.getElementById('shopProductDeliveryNote').value = p.delivery_note || '';
                var dcEl = document.getElementById('shopProductDeliveryCommands');
                if (dcEl) dcEl.value = p.delivery_commands || '';
                var roEl = document.getElementById('shopProductRequireOnline');
                if (roEl) roEl.checked = (p.require_online == 1);
                document.getElementById('shopProductActive').checked = (p.is_active == 1);
                shopUpdateCoverPreview(p.cover_image || '');
                shopRenderDeliveryPreview();
                modal.style.display = 'flex';
            });
        } else {
            titleEl.textContent = '新增商品';
            shopRenderDeliveryPreview();
            modal.style.display = 'flex';
        }
    }

    function shopCloseProductEditor() {
        document.getElementById('shopProductModal').style.display = 'none';
        shopUpdateCoverPreview('');
        var fi = document.getElementById('shopProductCoverFile');
        if (fi) fi.value = '';
    }

    function shopSubmitProduct(ev) {
        ev.preventDefault();
        var form = ev.target;
        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });
        data.is_active = document.getElementById('shopProductActive').checked ? 1 : 0;
        var roEl = document.getElementById('shopProductRequireOnline');
        data.require_online = roEl && roEl.checked ? 1 : 0;
        shopFetch('shop_save_product', data).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '保存失败', 'error'); return; }
            _toast('商品已保存', 'success');
            shopCloseProductEditor();
            shopLoadProducts(_shopProductsPage);
        });
        return false;
    }

    function shopDeleteProduct(id) {
        if (!confirm('确认删除该商品？\n如果该商品已有历史订单，将自动转为下架而不是物理删除。')) return;
        shopFetch('shop_delete_product', { id: id }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '删除失败', 'error'); return; }
            _toast(res.message || '已删除', 'success');
            shopLoadProducts(_shopProductsPage);
        });
    }

    function shopToggleProductActive(id, active) {
        shopFetch('shop_toggle_product_active', { id: id, is_active: active }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast(res.message, 'success');
            shopLoadProducts(_shopProductsPage);
        });
    }

    // ========== 分类管理 ==========
    function shopOpenCategoryManager() {
        document.getElementById('shopCategoryModal').style.display = 'flex';
        _renderCategoriesList();
        _resetCategoryForm();
    }
    function shopCloseCategoryManager() {
        document.getElementById('shopCategoryModal').style.display = 'none';
    }
    function _renderCategoriesList() {
        var box = document.getElementById('shopCategoriesList');
        if (!box) return;
        box.innerHTML = '<div style="color:#94a3b8;padding:10px;">加载中...</div>';
        shopGetCategories(true).then(function (cats) {
            if (!cats.length) { box.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:10px;">暂无分类</div>'; return; }
            box.innerHTML = cats.map(function (c) {
                return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:8px;">'
                    + '<div><b style="color:#0f172a;">' + _esc(c.name) + '</b> <span style="color:#94a3b8;font-size:.82em;">排序 ' + c.sort_order + (c.is_active == 0 ? ' · 已停用' : '') + '</span></div>'
                    + '<div style="display:flex;gap:6px;">'
                    + '<button type="button" onclick="shopEditCategory(' + c.id + ',\'' + _esc(c.name).replace(/'/g, '&#39;') + '\',' + c.sort_order + ',' + c.is_active + ')" style="border:1px solid #16a34a;background:#fff;color:#16a34a;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.82em;">编辑</button>'
                    + '<button type="button" onclick="shopDeleteCategory(' + c.id + ')" style="border:1px solid #fecaca;background:#fff;color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.82em;">删除</button>'
                    + '</div></div>';
            }).join('');
        });
    }
    function _resetCategoryForm() {
        document.getElementById('shopCategoryId').value = '';
        document.getElementById('shopCategoryName').value = '';
        document.getElementById('shopCategorySort').value = 0;
        document.getElementById('shopCategoryActive').checked = true;
    }
    function shopEditCategory(id, name, sort, active) {
        document.getElementById('shopCategoryId').value = id;
        document.getElementById('shopCategoryName').value = name;
        document.getElementById('shopCategorySort').value = sort;
        document.getElementById('shopCategoryActive').checked = (active == 1);
    }
    function shopSubmitCategory(ev) {
        ev.preventDefault();
        var data = {
            id: document.getElementById('shopCategoryId').value || '',
            name: document.getElementById('shopCategoryName').value,
            sort_order: document.getElementById('shopCategorySort').value,
            is_active: document.getElementById('shopCategoryActive').checked ? 1 : 0,
        };
        shopFetch('shop_save_category', data).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '保存失败', 'error'); return; }
            _toast('已保存', 'success');
            _resetCategoryForm();
            _categoriesCache = null;
            _renderCategoriesList();
        });
        return false;
    }
    function shopDeleteCategory(id) {
        if (!confirm('确认删除该分类？')) return;
        shopFetch('shop_delete_category', { id: id }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '删除失败', 'error'); return; }
            _toast('已删除', 'success');
            _categoriesCache = null;
            _renderCategoriesList();
        });
    }

    // ========== 库存管理 ==========
    var _shopInventoryPage = 1;
    function shopLoadInventory(page) {
        _shopInventoryPage = page || 1;
        var listBox = document.getElementById('shopInventoryList');
        if (listBox) listBox.innerHTML = '<div class="shop-loading">加载中...</div>';
        var filters = {
            page: _shopInventoryPage,
            keyword: (document.getElementById('shopInventorySearch') || {}).value || '',
            low_stock: document.getElementById('shopInventoryLowOnly') && document.getElementById('shopInventoryLowOnly').checked ? 1 : '',
        };
        shopFetch('shop_list_products', filters).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '加载失败', 'error'); return; }
            _renderInventoryList(res.data);
        });
    }
    function _renderInventoryList(data) {
        var listBox = document.getElementById('shopInventoryList');
        if (!data.items || !data.items.length) {
            listBox.innerHTML = '<div class="shop-empty">没有符合条件的商品</div>';
        } else {
            listBox.innerHTML = '<div class="shop-table-wrap"><table class="shop-table">'
                + '<thead><tr>'
                + '<th style="text-align:left;">商品</th><th>库存</th><th>已售</th><th>价格</th><th>状态</th><th>操作</th>'
                + '</tr></thead><tbody>'
                + data.items.map(function (p) {
                    var stockColor = p.stock <= 0 ? '#dc2626' : (p.stock <= 5 ? '#f59e0b' : '#16a34a');
                    return '<tr>'
                        + '<td style="text-align:left;color:#0f172a;">' + _esc(p.name) + (p.category_name ? '<span class="shop-meta"> · ' + _esc(p.category_name) + '</span>' : '') + '</td>'
                        + '<td style="text-align:center;font-weight:800;color:' + stockColor + ';">' + p.stock + '</td>'
                        + '<td style="text-align:center;color:#475569;">' + (p.sales_count || 0) + '</td>'
                        + '<td style="text-align:center;color:#16a34a;font-weight:700;">¥' + _esc(p.price) + '</td>'
                        + '<td style="text-align:center;">' + (p.is_active == 1 ? '<span class="shop-badge shop-badge--green">上架中</span>' : '<span class="shop-badge shop-badge--gray">已下架</span>') + '</td>'
                        + '<td style="text-align:center;"><button type="button" onclick="shopOpenStockModal(' + p.id + ',\'' + _esc(p.name).replace(/'/g, '&#39;') + '\',' + p.stock + ')" class="shop-btn shop-btn--info">调整</button></td>'
                        + '</tr>';
                }).join('')
                + '</tbody></table></div>';
        }
        _renderPagination('shopInventoryPagination', data, shopLoadInventory);
    }
    function shopOpenStockModal(id, name, current) {
        document.getElementById('shopStockForm').reset();
        document.getElementById('shopStockProductId').value = id;
        document.getElementById('shopStockProductName').textContent = name;
        document.getElementById('shopStockCurrent').textContent = current;
        document.getElementById('shopStockDelta').value = '';
        document.getElementById('shopStockModal').style.display = 'flex';
    }
    function shopCloseStockModal() {
        document.getElementById('shopStockModal').style.display = 'none';
    }
    function shopSubmitStock(ev) {
        ev.preventDefault();
        var data = {};
        new FormData(ev.target).forEach(function (v, k) { data[k] = v; });
        data.id = document.getElementById('shopStockProductId').value;
        if (!Number(data.delta)) { _toast('调整数量不能为 0', 'error'); return false; }
        shopFetch('shop_adjust_stock', data).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '调整失败', 'error'); return; }
            _toast('库存已更新', 'success');
            shopCloseStockModal();
            shopLoadInventory(_shopInventoryPage);
            // 若商品列表 tab 可见也刷新
            var prodTab = document.getElementById('tab-shop_products');
            if (prodTab && prodTab.style.display !== 'none') shopLoadProducts(_shopProductsPage);
        });
        return false;
    }

    // ========== 订单管理 ==========
    var _shopOrdersPage = 1;
    function shopLoadOrders(page) {
        _shopOrdersPage = page || 1;
        var listBox = document.getElementById('shopOrdersList');
        if (listBox) listBox.innerHTML = '<div class="shop-loading">加载中...</div>';
        var filters = {
            page: _shopOrdersPage,
            keyword: (document.getElementById('shopOrderSearch') || {}).value || '',
            status: (document.getElementById('shopOrderStatusFilter') || {}).value || '',
            date_from: (document.getElementById('shopOrderDateFrom') || {}).value || '',
            date_to: (document.getElementById('shopOrderDateTo') || {}).value || '',
        };
        shopFetch('shop_list_orders', filters).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '加载失败', 'error'); return; }
            _renderOrdersList(res.data);
        });
    }
    function _renderOrdersList(data) {
        var listBox = document.getElementById('shopOrdersList');
        if (!data.items || !data.items.length) {
            listBox.innerHTML = '<div class="shop-empty">没有订单</div>';
        } else {
            listBox.innerHTML = data.items.map(function (o) {
                var itemsTxt = (o.items || []).map(function (it) { return _esc(it.product_name) + ' ×' + it.quantity; }).join('，');
                return '<div class="shop-card shop-order-card">'
                    + '<div class="shop-card-head" style="justify-content:space-between;">'
                    + '<div class="shop-card-head">'
                    + '<span class="shop-mono" style="font-weight:700;">' + _esc(o.order_no) + '</span>'
                    + '<span class="shop-badge" style="background:' + o.status_bg + ';color:' + o.status_color + ';">' + _esc(o.status_label) + '</span>'
                    + '</div>'
                    + '<span style="color:#16a34a;font-weight:800;font-size:1.1em;">¥' + _esc(o.total) + '</span>'
                    + '</div>'
                    + '<div class="shop-subtitle">' + itemsTxt + '</div>'
                    + '<div class="shop-meta" style="align-items:center;">'
                    + '<span>用户：' + _esc(o.user_name || '已注销') + (o.user_email ? '（' + _esc(o.user_email) + '）' : '') + '</span>'
                    + (o.contact_mc ? '<span>MC：' + _esc(o.contact_mc) + '</span>' : '')
                    + '<span>下单：' + _formatTime(o.created_at) + '</span>'
                    + '<span class="shop-actions" style="margin-left:auto;">'
                    + '<button type="button" onclick="shopOpenOrderDetail(' + o.id + ')" class="shop-btn shop-btn--primary">详情</button>'
                    + _renderOrderActions(o)
                    + '</span></div></div>';
            }).join('');
        }
        _renderPagination('shopOrdersPagination', data, shopLoadOrders);
    }
    function _renderOrderActions(o) {
        var transitions = STATUS_TRANSITIONS[o.status] || [];
        return transitions.map(function (t) {
            var cls = t[0] === 'cancelled' || t[0] === 'refunded' ? 'shop-btn--danger' : 'shop-btn--info';
            return '<button type="button" onclick="shopChangeOrderStatus(' + o.id + ',\'' + t[0] + '\')" class="shop-btn ' + cls + '">' + t[1] + '</button>';
        }).join('');
    }
    function shopChangeOrderStatus(id, status) {
        var labels = { paid: '标记为已支付', shipped: '标记为已发货', completed: '标记为已完成', cancelled: '取消该订单', refunded: '退款（会回滚库存）' };
        if (!confirm('确认' + (labels[status] || '执行此操作') + '？')) return;
        var note = '';
        if (status === 'cancelled' || status === 'refunded') {
            note = prompt('请填写备注（可选）：', '') || '';
        }
        shopFetch('shop_update_order_status', { id: id, status: status, admin_note: note }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast('状态已更新', 'success');
            shopLoadOrders(_shopOrdersPage);
            // 详情弹窗若打开则刷新
            var modal = document.getElementById('shopOrderModal');
            if (modal && modal.style.display !== 'none') shopOpenOrderDetail(id);
        });
    }
    function shopOpenOrderDetail(id) {
        var modal = document.getElementById('shopOrderModal');
        var body = document.getElementById('shopOrderModalBody');
        document.getElementById('shopOrderModalTitle').textContent = '订单详情';
        body.innerHTML = '<div class="shop-loading">加载中...</div>';
        modal.style.display = 'flex';
        shopFetch('shop_get_order', { id: id }).then(function (res) {
            if (res.status !== 'success') { body.innerHTML = '<div class="shop-error">' + _esc(res.message || '加载失败') + '</div>'; return; }
            var o = res.data;
            document.getElementById('shopOrderModalTitle').textContent = '订单 ' + o.order_no;
            var itemsHtml = (o.items || []).map(function (it) {
                return '<tr>'
                    + '<td style="color:#0f172a;">' + _esc(it.product_name) + '</td>'
                    + '<td style="text-align:center;color:#475569;">×' + it.quantity + '</td>'
                    + '<td style="text-align:right;color:#475569;">¥' + _esc(it.unit_price) + '</td>'
                    + '<td style="text-align:right;color:#16a34a;font-weight:700;">¥' + _esc(it.subtotal) + '</td>'
                    + '</tr>';
            }).join('');
            body.innerHTML = '<div class="shop-list">'
                + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
                + '<div class="shop-badge" style="background:' + o.status_bg + ';color:' + o.status_color + ';">当前状态：' + _esc(o.status_label) + '</div>'
                + '<span class="shop-mono" style="user-select:all;cursor:pointer;" title="点击复制订单号" onclick="navigator.clipboard.writeText(\'' + _esc(o.order_no) + '\').then(function(){showToast&&showToast(\'已复制订单号\',\'success\')})">' + _esc(o.order_no) + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>'
                + '</div>'
                + '<div class="shop-form-grid shop-note-text">'
                + '<div><b>用户：</b>' + _esc(o.user_name || '已注销') + '</div>'
                + '<div><b>邮箱：</b>' + _esc(o.user_email || '-') + '</div>'
                + '<div><b>MC ID：</b>' + _esc(o.contact_mc || '-') + '</div>'
                + '<div><b>下单时间：</b>' + _formatTime(o.created_at) + '</div>'
                + (o.paid_at ? '<div><b>支付时间：</b>' + _formatTime(o.paid_at) + '</div>' : '')
                + (o.shipped_at ? '<div><b>发货时间：</b>' + _formatTime(o.shipped_at) + '</div>' : '')
                + (o.completed_at ? '<div><b>完成时间：</b>' + _formatTime(o.completed_at) + '</div>' : '')
                + (o.cancelled_at ? '<div><b>取消/退款时间：</b>' + _formatTime(o.cancelled_at) + '</div>' : '')
                + '</div>'
                + (o.contact_note ? '<div class="shop-row"><b>用户留言：</b><span>' + _esc(o.contact_note) + '</span></div>' : '')
                + (o.admin_note ? '<div class="shop-row" style="background:#fef3c7;color:#854d0e;"><b>管理员备注：</b><span>' + _esc(o.admin_note) + '</span></div>' : '')
                + '<div class="shop-table-wrap"><table class="shop-table">'
                + '<thead><tr><th style="text-align:left;">商品</th><th>数量</th><th style="text-align:right;">单价</th><th style="text-align:right;">小计</th></tr></thead>'
                + '<tbody>' + itemsHtml + '</tbody>'
                + '<tfoot><tr style="background:#f8fafc;"><td colspan="3" style="text-align:right;color:#475569;">合计</td><td style="text-align:right;color:#16a34a;font-weight:800;font-size:1.05em;">¥' + _esc(o.total) + '</td></tr></tfoot>'
                + '</table></div>'
                + '<div class="shop-actions">' + _renderOrderActions(o) + '</div>'
                + '</div>';
        });
    }
    function shopCloseOrderModal() {
        document.getElementById('shopOrderModal').style.display = 'none';
    }

    // ============================================================
    //  发货链路（RCON 自动发货 + 失败重试队列）
    // ============================================================
    var _shopDeliveryPage = 1;

    function shopDeliveryLoadAll() {
        shopDeliveryLoadSettings();
        shopDeliveryLoadQueue(1);
    }

    function shopDeliveryLoadSettings() {
        shopFetch('shop_delivery_get_settings').then(function (res) {
            if (res.status !== 'success') return;
            var d = res.data || {};
            document.getElementById('shopDeliveryEnabled').checked = !!d.enabled;
            document.getElementById('shopDeliveryAutoShip').checked = !!d.auto_ship;
            document.getElementById('shopDeliveryMaxAttempts').value = d.max_attempts || 30;
            document.getElementById('shopDeliveryRetrySeconds').value = d.retry_seconds || 60;
            document.getElementById('shopDeliveryCronToken').value = d.cron_token || '';
            var expEl = document.getElementById('shopOrderExpireMinutes');
            if (expEl) expEl.value = d.order_expire_minutes || 0;
        });
    }

    function shopDeliverySaveSettings(ev) {
        ev.preventDefault();
        var expEl = document.getElementById('shopOrderExpireMinutes');
        var data = {
            shop_rcon_delivery_enabled: document.getElementById('shopDeliveryEnabled').checked ? 1 : 0,
            shop_delivery_auto_ship: document.getElementById('shopDeliveryAutoShip').checked ? 1 : 0,
            shop_delivery_max_attempts: document.getElementById('shopDeliveryMaxAttempts').value || 30,
            shop_delivery_retry_seconds: document.getElementById('shopDeliveryRetrySeconds').value || 60,
            shop_delivery_cron_token: document.getElementById('shopDeliveryCronToken').value || '',
            shop_order_expire_minutes: expEl ? (parseInt(expEl.value, 10) || 0) : 0,
        };
        shopFetch('shop_delivery_save_settings', data).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '保存失败', 'error'); return; }
            _toast('设置已保存', 'success');
            if (res.cron_token) document.getElementById('shopDeliveryCronToken').value = res.cron_token;
        });
        return false;
    }

    function shopDeliveryCopyCron(btn) {
        var pre = document.getElementById('shopDeliveryCronScript');
        if (!pre) return;
        var txt = pre.textContent || '';
        var done = function () {
            _toast('已复制 Shell 脚本，请到宝塔 → 计划任务 粘贴', 'success');
            if (btn) {
                var old = btn.textContent;
                btn.textContent = '已复制 ✓';
                setTimeout(function () { btn.textContent = old; }, 1500);
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(done, function () {
                _fallbackCopy(txt); done();
            });
        } else {
            _fallbackCopy(txt); done();
        }
    }
    function _fallbackCopy(txt) {
        try {
            var ta = document.createElement('textarea');
            ta.value = txt; ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        } catch (e) {}
    }

    function shopDeliveryRegenToken() {
        if (!confirm('生成新 Token 后，旧 Token 的 cron 调用会立即失效，请同步更新计划任务里的 token 参数。继续？')) return;
        shopFetch('shop_delivery_save_settings', { regen_cron_token: 1 }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            document.getElementById('shopDeliveryCronToken').value = res.cron_token || '';
            _toast('新 Token 已生成', 'success');
        });
    }

    function shopDeliveryTestRcon() {
        _toast('正在测试 RCON ...', 'info');
        shopFetch('shop_delivery_test_rcon').then(function (res) {
            if (res.status !== 'success') { _toast(res.message || 'RCON 测试失败', 'error'); return; }
            _toast('RCON 连接成功：' + (res.response || ''), 'success');
        });
    }

    function shopDeliveryRunNow(btn) {
        btn = btn || (window.event && window.event.target);
        if (btn) { btn.disabled = true; btn.textContent = '处理中...'; }
        shopFetch('shop_delivery_run_now', { limit: 100 }).then(function (res) {
            if (btn) { btn.disabled = false; btn.textContent = '立即处理队列'; }
            if (res.status !== 'success') { _toast(res.message || '处理失败', 'error'); return; }
            var s = res.stat || {};
            var msg = '处理 ' + (s.processed || 0) + ' 条：成功 ' + (s.success || 0)
                + '，等待重试 ' + (s.requeued || 0)
                + '，玩家不在线 ' + (s.skipped_offline || 0)
                + '，永久失败 ' + (s.failed || 0)
                + (s.orders_shipped && s.orders_shipped.length ? '；自动发货订单 ' + s.orders_shipped.length + ' 个' : '');
            _toast(msg, (s.failed && s.failed > 0) ? 'error' : 'success');
            if (s.errors && s.errors.length) alert('错误：\n' + s.errors.join('\n'));
            shopDeliveryLoadQueue(_shopDeliveryPage);
        });
    }

    function _renderDeliveryStats(stats) {
        var box = document.getElementById('shopDeliveryStats');
        if (!box || !stats) return;
        function card(label, val, color) {
            return '<div class="shop-metric-card" style="text-align:center;">'
                + '<div class="shop-metric-value" style="color:' + color + ';">' + (val || 0) + '</div>'
                + '<div class="shop-metric-label">' + label + '</div></div>';
        }
        box.innerHTML =
            card('待发送', stats.pending, '#f59e0b')
            + card('其中等玩家上线', stats.waiting_online, '#0ea5e9')
            + card('已发送', stats.success, '#16a34a')
            + card('永久失败', stats.failed, '#dc2626')
            + card('已取消', stats.cancelled, '#94a3b8');
    }

    function shopDeliveryLoadQueue(page) {
        _shopDeliveryPage = page || 1;
        var box = document.getElementById('shopDeliveryQueueList');
        if (!box) return;
        box.innerHTML = '<div class="shop-loading">加载中...</div>';
        var filters = {
            page: _shopDeliveryPage,
            status: (document.getElementById('shopDeliveryStatusFilter') || {}).value || '',
            keyword: (document.getElementById('shopDeliveryKeyword') || {}).value || '',
        };
        shopFetch('shop_delivery_list', filters).then(function (res) {
            if (res.status !== 'success') { box.innerHTML = '<div class="shop-error">' + _esc(res.message || '加载失败') + '</div>'; return; }
            _renderDeliveryStats(res.stats);
            _renderDeliveryQueue(res.data || {});
        });
    }

    function _renderDeliveryQueue(data) {
        var box = document.getElementById('shopDeliveryQueueList');
        if (!data.items || !data.items.length) {
            box.innerHTML = '<div class="shop-empty">没有匹配的发货记录</div>';
            _renderPagination('shopDeliveryQueuePagination', data, shopDeliveryLoadQueue);
            return;
        }
        var STATUS = {
            pending: ['待发送', '#fef3c7', '#92400e'],
            success: ['已发送', '#dcfce7', '#15803d'],
            failed:  ['失败',   '#fee2e2', '#b91c1c'],
            cancelled:['已取消','#e2e8f0', '#475569'],
        };
        box.innerHTML = data.items.map(function (q) {
            var s = STATUS[q.status] || ['?', '#e2e8f0', '#475569'];
            var actions = '';
            if (q.status === 'pending') {
                actions += '<button type="button" onclick="shopDeliveryCancelItem(' + q.id + ')" class="shop-btn shop-btn--danger">取消</button>';
            }
            if (q.status === 'failed' || q.status === 'cancelled') {
                actions += '<button type="button" onclick="shopDeliveryRetryItem(' + q.id + ')" class="shop-btn shop-btn--primary">重新入队</button>';
            }
            return '<div class="shop-card shop-delivery-card">'
                + '<div class="shop-card-head" style="justify-content:space-between;">'
                + '<div class="shop-card-head">'
                + '<span class="shop-badge" style="background:' + s[1] + ';color:' + s[2] + ';">' + s[0] + '</span>'
                + '<span class="shop-mono" style="font-weight:700;">#' + q.id + '</span>'
                + (q.order_no ? '<span class="shop-meta">订单 ' + _esc(q.order_no) + '</span>' : '')
                + '<span class="shop-meta">玩家 <b>' + _esc(q.mc_name || '-') + '</b></span>'
                + '<span class="shop-meta">商品 ' + _esc(q.product_name || '-') + '</span>'
                + '</div>'
                + '<div class="shop-actions">' + actions + '</div>'
                + '</div>'
                + '<div class="shop-command">' + _esc(q.command) + '</div>'
                + '<div class="shop-status-line">'
                + '<span>尝试 ' + q.attempts + ' / ' + q.max_attempts + '</span>'
                + '<span>下次：' + _formatTime(q.next_attempt_at) + '</span>'
                + (q.last_attempt_at ? '<span>上次：' + _formatTime(q.last_attempt_at) + '</span>' : '')
                + (q.delivered_at ? '<span>完成：' + _formatTime(q.delivered_at) + '</span>' : '')
                + (q.require_online == 1 ? '<span style="color:#0ea5e9;">需在线</span>' : '')
                + '</div>'
                + (q.last_error ? '<div class="shop-error" style="margin-top:8px;padding:10px;text-align:left;">! ' + _esc(q.last_error) + '</div>' : '')
                + '</div>';
        }).join('');
        _renderPagination('shopDeliveryQueuePagination', data, shopDeliveryLoadQueue);
    }

    function shopDeliveryRetryItem(id) {
        shopFetch('shop_delivery_retry', { id: id }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast('已重新入队', 'success');
            shopDeliveryLoadQueue(_shopDeliveryPage);
        });
    }

    function shopDeliveryCancelItem(id) {
        if (!confirm('确认取消这条待发送命令？取消后不会再尝试，需要时可点「重新入队」恢复。')) return;
        shopFetch('shop_delivery_cancel', { id: id }).then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast('已取消', 'success');
            shopDeliveryLoadQueue(_shopDeliveryPage);
        });
    }

    function shopDeliveryBatchRetryFailed() {
        if (!confirm('确认将所有「失败」状态的发货命令重新入队？')) return;
        shopFetch('shop_delivery_batch_retry_failed').then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast(res.message || '批量重试完成', 'success');
            shopDeliveryLoadQueue(1);
        });
    }

    function shopDeliveryBatchCancelPending() {
        if (!confirm('确认取消所有「待发送」状态的发货命令？此操作不可自动恢复。')) return;
        shopFetch('shop_delivery_batch_cancel_pending').then(function (res) {
            if (res.status !== 'success') { _toast(res.message || '操作失败', 'error'); return; }
            _toast(res.message || '批量取消完成', 'success');
            shopDeliveryLoadQueue(1);
        });
    }

    // ========== 商品批量操作 ==========
    function shopBatchSelectionChanged() {
        var checks = document.querySelectorAll('.shop-product-check:checked');
        var bar = document.getElementById('shopProductBatchBar');
        if (!bar) return;
        if (checks.length > 0) {
            bar.style.display = 'flex';
            bar.querySelector('.shop-batch-count').textContent = '已选 ' + checks.length + ' 件';
        } else {
            bar.style.display = 'none';
        }
    }
    function shopBatchSelectAll() {
        var checks = document.querySelectorAll('.shop-product-check');
        var allChecked = Array.prototype.every.call(checks, function (c) { return c.checked; });
        checks.forEach(function (c) { c.checked = !allChecked; });
        shopBatchSelectionChanged();
    }
    function shopBatchAction(action) {
        var checks = document.querySelectorAll('.shop-product-check:checked');
        if (!checks.length) { _toast('请先勾选商品', 'error'); return; }
        var ids = Array.prototype.map.call(checks, function (c) { return c.value; });
        var label = action === 'activate' ? '上架' : '下架';
        if (!confirm('确认批量' + label + ' ' + ids.length + ' 件商品？')) return;
        var active = action === 'activate' ? 1 : 0;
        var done = 0, fail = 0;
        var total = ids.length;
        ids.forEach(function (id) {
            shopFetch('shop_toggle_product_active', { id: id, is_active: active }).then(function (res) {
                if (res.status === 'success') done++; else fail++;
                if (done + fail === total) {
                    _toast('批量' + label + '完成：成功 ' + done + (fail ? '，失败 ' + fail : ''), fail ? 'error' : 'success');
                    shopLoadProducts(_shopProductsPage);
                }
            }).catch(function () {
                fail++;
                if (done + fail === total) {
                    _toast('批量' + label + '完成：成功 ' + done + '，失败 ' + fail, 'error');
                    shopLoadProducts(_shopProductsPage);
                }
            });
        });
    }

    // ========== 发货命令模板：新手友好辅助 ==========
    var SHOP_DELIVERY_TEMPLATES = {
        give:  '# 给物品：把 minecraft:diamond 换成你要发的物品 ID\ngive {mc_name} minecraft:diamond {qty}',
        money: '# 给游戏币：根据你服使用的经济插件调整指令\neco give {mc_name} {qty}',
        lp:    '# 给会员组（LuckPerms）：把 vip 换成你的权限组名\nlp user {mc_name} parent add vip'
    };

    // 把模板填入命令框（覆盖原内容）
    function shopApplyDeliveryTemplate(key) {
        var el = document.getElementById('shopProductDeliveryCommands');
        if (!el) return;
        if (key === 'clear') {
            el.value = '';
        } else {
            el.value = SHOP_DELIVERY_TEMPLATES[key] || '';
        }
        el.focus();
        shopRenderDeliveryPreview();
    }

    // 把占位符插入到光标处
    function shopInsertDeliveryPlaceholder(ph) {
        var el = document.getElementById('shopProductDeliveryCommands');
        if (!el) return;
        var start = el.selectionStart, end = el.selectionEnd;
        if (typeof start !== 'number') { start = end = el.value.length; }
        el.value = el.value.slice(0, start) + ph + el.value.slice(end);
        var pos = start + ph.length;
        el.focus();
        try { el.setSelectionRange(pos, pos); } catch (e) {}
        shopRenderDeliveryPreview();
    }

    // 实时预览：用示例值替换占位符，注释行 / 空行忽略
    function shopRenderDeliveryPreview() {
        var el = document.getElementById('shopProductDeliveryCommands');
        var out = document.getElementById('shopDeliveryPreview');
        if (!out) return;
        var raw = el ? (el.value || '') : '';
        var sample = {
            '{mc_name}': 'Steve',
            '{qty}': '2',
            '{product}': '示例商品',
            '{user}': 'demo_user',
            '{order_no}': 'SP20240601XXXX'
        };
        var lines = raw.split('\n');
        var rendered = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.replace(/^\s+/, '');
            if (trimmed === '' || trimmed.charAt(0) === '#') continue; // 忽略空行 / 注释
            for (var k in sample) { line = line.split(k).join(sample[k]); }
            rendered.push(line);
        }
        out.textContent = rendered.length ? rendered.join('\n') : '(留空 = 不自动发货)';
    }

    // 绑定占位符标签点击（事件委托，弹窗内动态存在也安全）
    (function bindDeliveryPlaceholderGrid() {
        function bind() {
            var grid = document.getElementById('shopDeliveryPlaceholderGrid');
            if (!grid || grid._shopBound) return;
            grid._shopBound = true;
            grid.addEventListener('click', function (ev) {
                var chip = ev.target.closest ? ev.target.closest('[data-placeholder]') : null;
                if (!chip) return;
                shopInsertDeliveryPlaceholder(chip.getAttribute('data-placeholder'));
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bind);
        } else {
            bind();
        }
    })();

    // ========== 暴露到 window ==========
    global.shopLoadDashboard = shopLoadDashboard;
    global.shopLoadProducts = shopLoadProducts;
    global.shopOpenProductEditor = shopOpenProductEditor;
    global.shopCloseProductEditor = shopCloseProductEditor;
    global.shopSubmitProduct = shopSubmitProduct;
    global.shopDeleteProduct = shopDeleteProduct;
    global.shopApplyDeliveryTemplate = shopApplyDeliveryTemplate;
    global.shopInsertDeliveryPlaceholder = shopInsertDeliveryPlaceholder;
    global.shopRenderDeliveryPreview = shopRenderDeliveryPreview;
    global.shopToggleProductActive = shopToggleProductActive;
    global.shopOpenCategoryManager = shopOpenCategoryManager;
    global.shopCloseCategoryManager = shopCloseCategoryManager;
    global.shopEditCategory = shopEditCategory;
    global.shopSubmitCategory = shopSubmitCategory;
    global.shopDeleteCategory = shopDeleteCategory;
    global.shopLoadInventory = shopLoadInventory;
    global.shopOpenStockModal = shopOpenStockModal;
    global.shopCloseStockModal = shopCloseStockModal;
    global.shopSubmitStock = shopSubmitStock;
    global.shopLoadOrders = shopLoadOrders;
    global.shopOpenOrderDetail = shopOpenOrderDetail;
    global.shopCloseOrderModal = shopCloseOrderModal;
    global.shopChangeOrderStatus = shopChangeOrderStatus;
    global.shopDeliveryLoadQueue = shopDeliveryLoadQueue;
    global.shopDeliveryRetryItem = shopDeliveryRetryItem;
    global.shopDeliveryCancelItem = shopDeliveryCancelItem;
    global.shopDeliveryBatchRetryFailed = shopDeliveryBatchRetryFailed;
    global.shopDeliveryBatchCancelPending = shopDeliveryBatchCancelPending;
    global.shopDeliveryRunNow = shopDeliveryRunNow;
    global.shopDeliveryTestRcon = shopDeliveryTestRcon;
    global.shopDeliverySaveSettings = shopDeliverySaveSettings;
    global.shopDeliveryRegenToken = shopDeliveryRegenToken;
    global.shopDeliveryCopyCron = shopDeliveryCopyCron;
    global.shopPaymentLoadSettings = shopPaymentLoadSettings;
    global.shopPaymentSaveSettings = shopPaymentSaveSettings;
    global.shopPaymentRunTest = shopPaymentRunTest;
    global.shopPayTypeChanged = shopPayTypeChanged;
    global.shopPayToggleKeyVisible = shopPayToggleKeyVisible;
    global.shopPayCopyUrl = shopPayCopyUrl;
    global.shopChooseProductCover = shopChooseProductCover;
    global.shopUploadProductCover = shopUploadProductCover;
    global.shopClearCover = shopClearCover;
    global.shopUpdateCoverPreview = shopUpdateCoverPreview;
    global.shopBatchSelectionChanged = shopBatchSelectionChanged;
    global.shopBatchSelectAll = shopBatchSelectAll;
    global.shopBatchAction = shopBatchAction;

    // ========== Tab 切换钩子：进入商城 tab 时自动加载 ==========
    document.addEventListener('DOMContentLoaded', function () {
        var _origSwitch = global.switchTab;
        global.switchTab = function (key) {
            if (typeof _origSwitch === 'function') _origSwitch.apply(this, arguments);
            if (key === 'shop_revenue') shopLoadDashboard();
            else if (key === 'shop_products') shopLoadProducts(1);
            else if (key === 'shop_orders') shopLoadOrders(1);
            else if (key === 'shop_inventory') shopLoadInventory(1);
            else if (key === 'shop_delivery') shopDeliveryLoadAll();
            else if (key === 'shop_payments') shopPaymentLoadSettings();
        };
        // 首屏即为商城 tab 时
        var url = new URL(window.location.href);
        var tab = url.searchParams.get('tab') || '';
        if (tab === 'shop_revenue') shopLoadDashboard();
        else if (tab === 'shop_products') shopLoadProducts(1);
        else if (tab === 'shop_orders') shopLoadOrders(1);
        else if (tab === 'shop_inventory') shopLoadInventory(1);
        else if (tab === 'shop_delivery') shopDeliveryLoadAll();
        else if (tab === 'shop_payments') shopPaymentLoadSettings();

        // Ctrl+S 快捷保存：商品编辑器打开时触发提交
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                var productModal = document.getElementById('shopProductModal');
                if (productModal && productModal.style.display !== 'none') {
                    e.preventDefault();
                    var form = document.getElementById('shopProductForm');
                    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });
    });

})(window);
