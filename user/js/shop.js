/**
 * 用户中心 - 商城（商品列表 / 详情 / 结算）
 *
 * 配合 user/tabs.php 中 case 'shop' 的 DOM 使用。
 * CSRF 来自 window.userCsrf，会话状态由 user/panel.php 保证（已登录才能进入）。
 */
(function () {
    'use strict';

    var API = 'api/index.php';

    var _svg = {
        pkg:      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
        tag:      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/></svg>',
        chart:    '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        truck:    '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>',
        info:     '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        card:     '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    };

    var state = {
        categories: [],
        currentCategory: 0,
        currentPage: 1,
        keyword: '',
        checkoutItem: null,
        loaded: false,
        payment: { enabled: false, type: '', types: [], selectedType: '' },
        paymentConfigPromise: null,
    };

    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toast(msg, type) {
        if (window.showToast) return window.showToast(msg, type || 'info');
        // 临时占位
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' + (type === 'error' ? '#dc2626' : (type === 'success' ? '#16a34a' : '#0f172a')) + ';color:#fff;padding:10px 20px;border-radius:10px;z-index:3000;font-size:.94em;box-shadow:0 6px 20px rgba(0,0,0,.2);';
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 2200);
    }

    // ===== 数据加载 =====
    function fetchJson(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    }
    function loadCategories() {
        return fetchJson(API + '?action=shop_categories').then(function (res) {
            if (res.status === 'success') {
                state.categories = res.data || [];
                renderCategoryChips();
            }
        });
    }
    function loadPaymentConfig() {
        if (state.paymentConfigPromise) return state.paymentConfigPromise;
        state.paymentConfigPromise = fetchJson(API + '?action=shop_pay_config').then(function (res) {
            if (res.status === 'success') {
                var d = res.data || {};
                state.payment.enabled = !!d.enabled;
                state.payment.type = d.type || '';
                state.payment.types = d.types || (d.type ? [{ value: d.type, label: d.type }] : []);
                state.payment.selectedType = d.type || '';
            }
            renderPaymentHints();
        }).catch(function () {
            state.payment = { enabled: false, type: '', types: [], selectedType: '' };
            renderPaymentHints();
        }).finally(function () {
            state.paymentConfigPromise = null;
        });
        return state.paymentConfigPromise;
    }
    function renderPayTypeSelector(containerId) {
        var box = document.getElementById(containerId);
        if (!box) return;
        var types = state.payment.types || [];
        if (!state.payment.enabled || types.length <= 1) { box.innerHTML = ''; return; }
        var html = '<div style="margin-bottom:12px;"><div style="font-size:.84em;color:#64748b;margin-bottom:6px;">'
            + '\u9009\u62e9\u652f\u4ed8\u65b9\u5f0f</div><div style="display:flex;gap:8px;flex-wrap:wrap;">';
        types.forEach(function (t) {
            var active = state.payment.selectedType === t.value;
            html += '<button type="button" onclick="shopSelectPayType(\'' + esc(t.value) + '\',\'' + containerId + '\')"'
                + ' style="padding:7px 16px;border-radius:8px;font-size:.88em;font-weight:600;cursor:pointer;border:1.5px solid '
                + (active ? '#16a34a' : '#e2e8f0') + ';background:' + (active ? '#f0fdf4' : '#fff')
                + ';color:' + (active ? '#15803d' : '#64748b') + ';">'
                + esc(t.label) + '</button>';
        });
        html += '</div></div>';
        box.innerHTML = html;
    }
    function renderPaymentHints() {
        var checkoutHint = document.getElementById('shopCheckoutPayHint');
        if (checkoutHint) {
            checkoutHint.innerHTML = state.payment.enabled
                ? '提交订单后可直接跳转在线支付，支付成功后订单会自动变为“已支付”。'
                : '提交订单后会扣除商品库存，请联系群内管理员进行支付，否则订单会一直处于“待支付”状态。';
        }
        renderPayTypeSelector('shopCheckoutPayTypeSelector');
        var ordersHint = document.getElementById('shopOrdersPayHint');
        if (ordersHint) {
            ordersHint.innerHTML = state.payment.enabled
                ? '<strong>支付方式说明：</strong>待支付订单可点击“去支付”在线完成付款，成功后系统会自动确认到账并触发发货。'
                : '<strong>支付方式说明：</strong>下单后请联系群内管理员（QQ / 微信）完成支付，到账后管理员会在后台标记你的订单为“已支付”并发货。';
        }
        renderPayTypeSelector('shopOrdersPayTypeSelector');
    }
    function renderCategoryChips() {
        var box = document.getElementById('shopCategoryChips');
        if (!box) return;
        var html = '<span class="chip ' + (state.currentCategory === 0 ? 'active' : '') + '" onclick="shopSelectCategory(0)" style="padding:6px 14px;border-radius:999px;background:' + (state.currentCategory === 0 ? '#16a34a' : '#fff') + ';color:' + (state.currentCategory === 0 ? '#fff' : '#64748b') + ';border:1px solid ' + (state.currentCategory === 0 ? '#16a34a' : '#e2e8f0') + ';cursor:pointer;font-size:.9em;">全部</span>';
        state.categories.forEach(function (c) {
            var active = state.currentCategory === c.id;
            html += '<span class="chip ' + (active ? 'active' : '') + '" onclick="shopSelectCategory(' + c.id + ')" style="padding:6px 14px;border-radius:999px;background:' + (active ? '#16a34a' : '#fff') + ';color:' + (active ? '#fff' : '#64748b') + ';border:1px solid ' + (active ? '#16a34a' : '#e2e8f0') + ';cursor:pointer;font-size:.9em;">' + esc(c.name) + '</span>';
        });
        box.innerHTML = html;
    }
    function loadProducts() {
        var grid = document.getElementById('shopProductsGrid');
        if (!grid) return;
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;">加载中...</div>';
        var url = API + '?action=shop_products&page=' + state.currentPage
            + '&category_id=' + state.currentCategory
            + '&keyword=' + encodeURIComponent(state.keyword);
        fetchJson(url).then(function (res) {
            if (res.status !== 'success') { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626;">' + esc(res.message || '加载失败') + '</div>'; return; }
            renderProducts(res.data);
        }).catch(function () {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626;">网络错误</div>';
        });
    }
    function renderProducts(data) {
        var grid = document.getElementById('shopProductsGrid');
        if (!data.items || !data.items.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;padding:60px 20px;text-align:center;color:#94a3b8;">' + (state.keyword || state.currentCategory ? '没找到符合条件的商品' : '商城还没有商品') + '</div>';
            renderPagination(data);
            return;
        }
        grid.innerHTML = data.items.map(function (p, idx) {
            var stock = Number(p.stock) || 0;
            var stockOut = stock <= 0;
            var stockLow = !stockOut && stock <= 5;
            var stockDot = stockOut ? '#dc2626' : (stockLow ? '#f59e0b' : '#16a34a');
            var stockText = stockOut ? '已售罄' : (stockLow ? '仅剩 ' + stock : '库存 ' + stock);
            var hasDiscount = Number(p.original_price) > Number(p.price);
            var origPrice = hasDiscount
                ? '<span style="text-decoration:line-through;color:#94a3b8;font-size:.82em;margin-left:5px;">¥' + esc(p.original_price) + '</span>'
                : '';
            var discountBadge = hasDiscount
                ? '<div style="position:absolute;top:8px;left:8px;background:#dc2626;color:#fff;font-size:.7em;font-weight:700;padding:2px 7px;border-radius:999px;line-height:1.6;">优惠</div>'
                : '';
            var soldOutOverlay = stockOut
                ? '<div style="position:absolute;inset:0;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;"><span style="background:#0f172a;color:#fff;font-size:.8em;font-weight:700;padding:4px 12px;border-radius:999px;opacity:.75;">已售罄</span></div>'
                : '';
            var coverImg = p.cover_image
                ? '<img src="' + (p.cover_image.match(/^https?:\/\/|^\//) ? esc(p.cover_image) : '../' + esc(p.cover_image)) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;" onerror="this.outerHTML=\'<div style=&quot;width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;color:#86efac;font-size:42px;&quot;>' + _svg.pkg.replace(/"/g, '&quot;') + '</div>\'">'  
                : '<div style="width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;color:#86efac;font-size:42px;">' + _svg.pkg + '</div>';
            var quickBuyBtn = stockOut
                ? '<button type="button" disabled style="width:100%;margin-top:10px;padding:8px 0;border-radius:8px;border:none;background:#e2e8f0;color:#94a3b8;font-size:.88em;font-weight:600;cursor:not-allowed;">已售罄</button>'
                : '<button type="button" onclick="event.stopPropagation();shopQuickBuy(' + p.id + ',' + JSON.stringify(esc(p.name)) + ',' + JSON.stringify(p.price) + ',' + stock + ',' + (Number(p.min_qty) || 1) + ',' + (Number(p.max_qty) || 0) + ')" style="width:100%;margin-top:10px;padding:8px 0;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:.88em;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(22,163,74,.2);">立即购买</button>';
            var animStyle = 'animation-delay:' + Math.min(idx * 0.05, 0.3) + 's;';
            return '<div onclick="shopOpenDetail(' + p.id + ')" class="shop-card-anim" style="' + animStyle + 'background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .18s,box-shadow .18s;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 8px 28px rgba(15,23,42,.1)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
                + '<div style="position:relative;">'
                + coverImg
                + discountBadge
                + soldOutOverlay
                + '</div>'
                + '<div style="padding:12px 14px;flex:1;display:flex;flex-direction:column;">'
                + '<h3 style="font-weight:700;color:#0f172a;font-size:.96em;margin:0 0 3px;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + esc(p.name) + '</h3>'
                + (p.subtitle ? '<div style="color:#64748b;font-size:.8em;margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">' + esc(p.subtitle) + '</div>' : '<div style="height:6px;"></div>')
                + '<div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">'
                + '<div style="display:flex;align-items:baseline;gap:2px;"><span style="font-size:.82em;color:#16a34a;font-weight:600;">¥</span><span style="font-size:1.15em;font-weight:800;color:#16a34a;">' + esc(p.price) + '</span>' + origPrice + '</div>'
                + '<span style="display:inline-flex;align-items:center;gap:3px;font-size:.76em;color:' + stockDot + ';font-weight:600;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + stockDot + ';"></span>' + stockText + '</span>'
                + '</div>'
                + quickBuyBtn
                + '</div></div>';
        }).join('');
        renderPagination(data);
    }
    function renderPagination(data) {
        var box = document.getElementById('shopProductsPagination');
        if (!box) return;
        var totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.per_page || 24)));
        if (totalPages <= 1) { box.innerHTML = ''; return; }
        var html = '', cur = data.page || 1;
        function btn(p, label, dis, act) {
            return '<button type="button" ' + (dis ? 'disabled' : 'onclick="shopGoPage(' + p + ')"')
                + ' style="border:1px solid #e2e8f0;padding:6px 12px;border-radius:6px;background:' + (act ? '#16a34a' : '#fff') + ';color:' + (act ? '#fff' : '#64748b') + ';cursor:' + (dis ? 'not-allowed' : 'pointer') + ';opacity:' + (dis ? '.4' : '1') + ';">' + label + '</button>';
        }
        html += btn(cur - 1, '上一页', cur <= 1, false);
        for (var i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - cur) <= 2) html += btn(i, String(i), false, i === cur);
            else if (Math.abs(i - cur) === 3) html += '<span style="padding:6px 4px;color:#94a3b8;">…</span>';
        }
        html += btn(cur + 1, '下一页', cur >= totalPages, false);
        box.innerHTML = html;
    }

    // ===== 详情弹窗 =====
    function openDetail(id) {
        var modal = document.getElementById('shopDetailModal');
        var body = document.getElementById('shopDetailBody');
        var footer = document.getElementById('shopDetailFooter');
        if (footer) footer.style.display = 'none';
        body.innerHTML = '<div style="text-align:center;padding:80px 20px;color:#94a3b8;">'
            + '<div style="display:inline-block;width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#16a34a;border-radius:50%;animation:shopSpin .8s linear infinite;margin-bottom:10px;"></div>'
            + '<div>加载中…</div>'
            + '<style>@keyframes shopSpin{to{transform:rotate(360deg)}}</style>'
            + '</div>';
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        var panel = modal.querySelector('div');
        if (panel) { panel.classList.remove('shop-modal-panel'); void panel.offsetWidth; panel.classList.add('shop-modal-panel'); }
        fetchJson(API + '?action=shop_product&id=' + id).then(function (res) {
            if (res.status !== 'success') {
                body.innerHTML = '<div style="padding:40px 22px;text-align:center;color:#dc2626;">' + esc(res.message || '加载失败') + '</div>';
                return;
            }
            var p = res.data;
            var stock = Number(p.stock) || 0;
            var stockOut = stock <= 0;
            var stockLow = !stockOut && stock <= 5;
            var hasDiscount = Number(p.original_price) > Number(p.price);
            var origPrice = hasDiscount
                ? '<span style="text-decoration:line-through;color:#94a3b8;font-size:.92em;margin-left:8px;">¥' + esc(p.original_price) + '</span>'
                : '';
            var discountTag = hasDiscount
                ? '<span style="background:#fee2e2;color:#dc2626;font-size:.74em;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;vertical-align:middle;">优惠</span>'
                : '';

            // 顶部封面区（无封面则显示绿白渐变占位）
            var hero = p.cover_image
                ? '<div style="background:#f0fdf4;"><img src="' + (p.cover_image.match(/^https?:\/\/|^\//) ? esc(p.cover_image) : '../' + esc(p.cover_image)) + '" alt="" style="width:100%;max-height:320px;object-fit:cover;display:block;" onerror="this.parentNode.innerHTML=\'<div style=&quot;height:200px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#86efac;font-size:48px;&quot;>' + _svg.pkg.replace(/"/g, '&quot;') + '</div>\'"></div>'
                : '<div style="height:180px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#86efac;font-size:48px;">' + _svg.pkg + '</div>';

            // 状态徽章（库存）
            var stockBadge;
            if (stockOut) {
                stockBadge = '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#dc2626;font-size:.78em;font-weight:600;padding:3px 10px;border-radius:999px;">● 已售罄</span>';
            } else if (stockLow) {
                stockBadge = '<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#b45309;font-size:.78em;font-weight:600;padding:3px 10px;border-radius:999px;">● 仅剩 ' + stock + ' 件</span>';
            } else {
                stockBadge = '<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#15803d;font-size:.78em;font-weight:600;padding:3px 10px;border-radius:999px;">● 现货充足</span>';
            }

            // 信息行（图标 + 标签 + 值，避免标签压在数字上）
            function infoCell(icon, label, value) {
                return '<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:10px 12px;">'
                    + '<div style="width:32px;height:32px;border-radius:8px;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:1.05em;flex-shrink:0;">' + icon + '</div>'
                    + '<div style="min-width:0;flex:1;">'
                    + '<div style="color:#94a3b8;font-size:.74em;line-height:1.2;margin-bottom:2px;">' + label + '</div>'
                    + '<div style="color:#0f172a;font-weight:600;font-size:.92em;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + value + '</div>'
                    + '</div></div>';
            }
            var infoGrid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px;">'
                + infoCell(_svg.tag, '分类', esc(p.category_name || '未分类'))
                + infoCell(_svg.pkg, '库存', stockOut ? '<span style="color:#dc2626;">已售罄</span>' : (esc(String(stock)) + ' 件'))
                + infoCell(_svg.chart, '已售', (p.sales_count || 0) + ' 件')
                + '</div>';

            var descBlock = p.description
                ? '<div style="margin-bottom:18px;">'
                + '<div style="color:#0f172a;font-weight:700;font-size:.95em;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:3px;height:14px;background:#16a34a;border-radius:2px;"></span>商品介绍</div>'
                + '<div style="color:#334155;white-space:pre-wrap;line-height:1.75;font-size:.92em;">' + esc(p.description) + '</div>'
                + '</div>'
                : '';

            var deliveryBlock = p.delivery_note
                ? '<div style="display:flex;gap:10px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;color:#854d0e;font-size:.88em;line-height:1.6;margin-bottom:6px;">'
                + '<span style="font-size:1.1em;line-height:1.4;flex-shrink:0;">' + _svg.truck + '</span>'
                + '<div><strong style="display:block;margin-bottom:2px;">发货说明</strong>' + esc(p.delivery_note) + '</div>'
                + '</div>'
                : '';

            // 主体内容
            body.innerHTML = hero
                + '<div style="padding:22px 24px 18px;">'
                + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
                + '<h2 style="font-size:1.35em;font-weight:800;margin:0;color:#0f172a;line-height:1.3;flex:1;min-width:0;">' + esc(p.name) + discountTag + '</h2>'
                + stockBadge
                + '</div>'
                + (p.subtitle ? '<p style="color:#64748b;margin:4px 0 14px;font-size:.92em;line-height:1.5;">' + esc(p.subtitle) + '</p>' : '<div style="height:8px;"></div>')
                + '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:18px;padding:14px 16px;background:linear-gradient(135deg,#f0fdf4,#ffffff);border:1px solid #dcfce7;border-radius:12px;">'
                + '<span style="color:#16a34a;font-size:.86em;font-weight:600;">¥</span>'
                + '<span style="font-size:1.85em;font-weight:800;color:#16a34a;line-height:1;">' + esc(p.price) + '</span>'
                + origPrice
                + '</div>'
                + infoGrid
                + descBlock
                + deliveryBlock
                + '</div>';

            // 底部行动栏（吸底）
            if (footer) {
                // 商品级最小 / 最大购买数量；max_qty=0 表示不限（仅受库存约束）
                var minQty = Math.max(1, Number(p.min_qty) || 1);
                var rawMax = Number(p.max_qty) || 0;
                var qtyMax = Math.max(1, stock);
                if (rawMax > 0) qtyMax = Math.min(qtyMax, rawMax);
                var startQty = Math.min(qtyMax, Math.max(minQty, 1));
                footer.style.display = 'flex';
                footer.innerHTML = ''
                    + '<div style="display:flex;align-items:center;gap:10px;">'
                    + '<span style="color:#64748b;font-size:.9em;">购买数量</span>'
                    + '<div style="display:inline-flex;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;">'
                    + '<button type="button" onclick="shopDetailQty(-1)" ' + (stockOut ? 'disabled ' : '') + 'style="background:#fff;border:none;width:34px;height:36px;cursor:' + (stockOut ? 'not-allowed' : 'pointer') + ';color:#15803d;font-size:1.2em;line-height:1;">−</button>'
                    + '<input type="number" id="shopDetailQty" min="' + minQty + '" max="' + qtyMax + '" value="' + startQty + '" ' + (stockOut ? 'disabled ' : '') + 'style="width:54px;height:36px;text-align:center;border:none;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;outline:none;font-weight:600;color:#0f172a;background:#fff;">'
                    + '<button type="button" onclick="shopDetailQty(1)" ' + (stockOut ? 'disabled ' : '') + 'style="background:#fff;border:none;width:34px;height:36px;cursor:' + (stockOut ? 'not-allowed' : 'pointer') + ';color:#15803d;font-size:1.2em;line-height:1;">+</button>'
                    + '</div>'
                    + ((minQty > 1 || rawMax > 0) ? '<span style="color:#94a3b8;font-size:.8em;">' + (minQty > 1 ? ('最少 ' + minQty) : '') + (minQty > 1 && rawMax > 0 ? ' · ' : '') + (rawMax > 0 ? ('最多 ' + rawMax) : '') + '</span>' : '')
                    + '</div>'
                    + '<div style="display:flex;gap:10px;align-items:center;margin-left:auto;">'
                    + '<button type="button" onclick="shopCloseDetail()" style="background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:10px;padding:9px 18px;cursor:pointer;font-size:.94em;">关闭</button>'
                    + '<button type="button" id="shopBuyNowBtn" ' + (stockOut ? 'disabled ' : '') + 'style="color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:700;font-size:.96em;background:' + (stockOut ? '#cbd5e1' : '#16a34a') + ';cursor:' + (stockOut ? 'not-allowed' : 'pointer') + ';box-shadow:' + (stockOut ? 'none' : '0 4px 12px rgba(22,163,74,.25)') + ';transition:transform .12s,box-shadow .12s;" ' + (stockOut ? '' : 'onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 6px 16px rgba(22,163,74,.32)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 12px rgba(22,163,74,.25)\'"') + '>' + (stockOut ? '已售罄' : '立即购买') + '</button>'
                    + '</div>';
                var btn = document.getElementById('shopBuyNowBtn');
                if (btn && !stockOut) {
                    btn.onclick = function () {
                        var input = document.getElementById('shopDetailQty');
                        var max = Number(input.getAttribute('max')) || 99;
                        var min = Number(input.getAttribute('min')) || 1;
                        var qty = Math.max(min, Math.min(max, Number(input.value) || min));
                        state.checkoutItem = { id: p.id, name: p.name, price: p.price, qty: qty, minQty: min, maxQty: max };
                        closeDetail();
                        openCheckout();
                    };
                }
            }
        });
    }
    function closeDetail() {
        document.getElementById('shopDetailModal').style.display = 'none';
        var footer = document.getElementById('shopDetailFooter');
        if (footer) { footer.style.display = 'none'; footer.innerHTML = ''; }
    }

    // ===== 快速购买（跳过详情弹窗直接结算）=====
    function quickBuy(id, name, price, stock, minQty, maxQty) {
        var min = Math.max(1, Number(minQty) || 1);
        var rawMax = Number(maxQty) || 0; // 0 表示不限
        var max = Math.max(1, Number(stock) || 1);
        if (rawMax > 0) max = Math.min(max, rawMax);
        var qty = Math.min(max, Math.max(min, 1));
        state.checkoutItem = { id: id, name: name, price: price, qty: qty, minQty: min, maxQty: max };
        openCheckout();
    }

    // ===== 结算 =====
    function openCheckout() {
        var it = state.checkoutItem;
        if (!it) { toast('请先选择要购买的商品', 'error'); return; }
        renderCheckoutSummary();
        document.getElementById('shopCheckoutForm').style.display = '';
        document.getElementById('shopOrderSuccess').style.display = 'none';
        renderPaymentHints();
        // 记忆上次输入的 MC ID
        var mcInput = document.getElementById('shopContactMc');
        if (mcInput && !mcInput.value) {
            var saved = localStorage.getItem('shop_last_mc_id');
            if (saved) mcInput.value = saved;
        }
        var modal = document.getElementById('shopCheckoutModal');
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        var panel = modal.querySelector('div');
        if (panel) { panel.classList.remove('shop-modal-panel'); void panel.offsetWidth; panel.classList.add('shop-modal-panel'); }
    }
    function renderCheckoutSummary() {
        var it = state.checkoutItem;
        if (!it) return;
        var summary = document.getElementById('shopCheckoutSummary');
        var unit = Number(it.price);
        var total = unit * it.qty;
        summary.innerHTML = ''
            + '<div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px dashed #e2e8f0;margin-bottom:12px;">'
            + '<div style="width:44px;height:44px;border-radius:10px;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:1.3em;flex-shrink:0;">' + _svg.pkg + '</div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:700;color:#0f172a;font-size:.96em;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(it.name) + '</div>'
            + '<div style="color:#94a3b8;font-size:.82em;margin-top:2px;">单价 ¥' + unit.toFixed(2) + '</div>'
            + '</div>'
            + '<div style="display:inline-flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;">'
            + '<button type="button" onclick="shopCheckoutQty(-1)" style="background:#fff;border:none;width:30px;height:30px;cursor:pointer;color:#15803d;font-size:1.1em;line-height:1;">−</button>'
            + '<input type="number" id="shopCheckoutQtyVal" min="' + (it.minQty || 1) + '"' + (it.maxQty ? ' max="' + it.maxQty + '"' : '') + ' value="' + it.qty + '" oninput="shopCheckoutQtyInput(this.value)" onblur="shopCheckoutQtyCommit()" style="width:46px;height:30px;text-align:center;border:none;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;outline:none;font-weight:700;font-size:.9em;color:#0f172a;background:#fff;-moz-appearance:textfield;">'
            + '<button type="button" onclick="shopCheckoutQty(1)" style="background:#fff;border:none;width:30px;height:30px;cursor:pointer;color:#15803d;font-size:1.1em;line-height:1;">+</button>'
            + '</div>'
            + '</div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;color:#475569;font-size:.88em;margin-bottom:4px;"><span>商品小计</span><span data-checkout-total>¥' + total.toFixed(2) + '</span></div>'
            + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;">'
            + '<span style="color:#0f172a;font-weight:700;">合计</span>'
            + '<span style="color:#16a34a;font-weight:800;font-size:1.25em;" data-checkout-total>¥' + total.toFixed(2) + '</span>'
            + '</div>';
    }
    function checkoutQty(delta) {
        if (!state.checkoutItem) return;
        var min = state.checkoutItem.minQty || 1;
        var max = state.checkoutItem.maxQty || Infinity;
        var newQty = Math.max(min, Math.min(max, state.checkoutItem.qty + delta));
        state.checkoutItem.qty = newQty;
        renderCheckoutSummary();
    }
    // 实时输入：仅更新小计/合计，不重渲染输入框以保留焦点
    function checkoutQtyInput(val) {
        if (!state.checkoutItem) return;
        var n = parseInt(val, 10);
        if (!isFinite(n) || n < 1) return; // 允许临时空值，提交时再校正
        var max = state.checkoutItem.maxQty || Infinity;
        n = Math.min(max, n); // 下限在失焦时校正，输入过程中不强制
        if (n < 1) n = 1;
        state.checkoutItem.qty = n;
        var unit = Number(state.checkoutItem.price);
        var total = unit * n;
        document.querySelectorAll('#shopCheckoutSummary [data-checkout-total]').forEach(function (el) {
            el.textContent = '¥' + total.toFixed(2);
        });
    }
    // 失焦校正：钳制范围并重渲染
    function checkoutQtyCommit() {
        if (!state.checkoutItem) return;
        var input = document.getElementById('shopCheckoutQtyVal');
        var min = state.checkoutItem.minQty || 1;
        var max = state.checkoutItem.maxQty || Infinity;
        var n = parseInt(input ? input.value : '', 10);
        if (!isFinite(n) || n < min) n = min;
        n = Math.min(max, Math.max(min, n));
        state.checkoutItem.qty = n;
        renderCheckoutSummary();
    }
    function closeCheckout() { document.getElementById('shopCheckoutModal').style.display = 'none'; }
    var _orderSubmitting = false; // 全局下单锁，防止按钮禁用被脚本绕过
    var _paySubmitting = false;   // 全局支付锁

    function submitOrder(ev) {
        ev.preventDefault();
        if (_orderSubmitting) return false;
        var btn = document.getElementById('shopSubmitOrderBtn');
        if (btn.disabled) return false;
        _orderSubmitting = true;
        btn.disabled = true;
        btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" style="animation:spin .6s linear infinite;"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>提交中...</span>';
        var fd = new FormData();
        fd.append('action', 'shop_create_order');
        fd.append('csrf', window.userCsrf || '');
        if (!state.checkoutItem) {
            _orderSubmitting = false;
            btn.disabled = false; btn.textContent = '提交订单';
            toast('请先选择要购买的商品', 'error');
            return false;
        }
        fd.append('items', JSON.stringify([{ product_id: state.checkoutItem.id, quantity: state.checkoutItem.qty }]));
        var mcVal = document.getElementById('shopContactMc').value;
        fd.append('contact_mc', mcVal);
        fd.append('contact_note', document.getElementById('shopContactNote').value);
        // 记忆 MC ID
        if (mcVal) localStorage.setItem('shop_last_mc_id', mcVal);
        if (state.payment.enabled) {
            fd.append('pay_now', '1');
            fd.append('pay_type', state.payment.selectedType || state.payment.type || '');
        }
        fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                _orderSubmitting = false;
                btn.disabled = false; btn.textContent = '提交订单';
                if (res.status !== 'success') { toast(res.message || '提交失败', 'error'); return; }
                state.checkoutItem = null;
                document.getElementById('shopCheckoutForm').style.display = 'none';
                document.getElementById('shopOrderSuccess').style.display = 'block';
                document.getElementById('shopSuccessOrderNo').textContent = res.order_no || '-';
                loadProducts();
                if (res.payment && res.payment.url) {
                    window.location.href = res.payment.url;
                }
            })
            .catch(function () {
                _orderSubmitting = false;
                btn.disabled = false; btn.textContent = '提交订单';
                toast('网络错误', 'error');
            });
        return false;
    }

    // ===== 进入 shop tab 时初始化 =====
    function initShopTab() {
        if (state.loaded) { loadPaymentConfig(); loadProducts(); return; }
        loadPaymentConfig();
        loadCategories();
        loadProducts();
        state.loaded = true;
    }

    // ===== 我的订单 =====
    var _ordersPage = 1;
    var _ordersStatus = '';
    function _fmtTime(s) { if (!s) return '-'; return String(s).replace('T', ' ').slice(0, 19); }
    function filterOrders(status) {
        _ordersStatus = status;
        // 更新 tab 样式
        var tabs = document.querySelectorAll('.shop-order-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-status') === status);
        });
        loadMyOrders(1);
    }
    function loadMyOrders(page) {
        _ordersPage = page || 1;
        var box = document.getElementById('userOrdersList');
        if (!box) return;
        box.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:30px;">加载中...</div>';
        var url = API + '?action=shop_my_orders&page=' + _ordersPage;
        if (_ordersStatus) url += '&status=' + encodeURIComponent(_ordersStatus);
        fetchJson(url)
            .then(function (res) {
                if (res.status !== 'success') { box.innerHTML = '<div style="color:#dc2626;padding:20px;">' + esc(res.message || '加载失败') + '</div>'; return; }
                renderOrders(res.data);
            }).catch(function () { box.innerHTML = '<div style="color:#dc2626;padding:20px;">网络错误</div>'; });
    }
    function renderOrders(data) {
        var box = document.getElementById('userOrdersList');
        if (!data.items || !data.items.length) {
            box.innerHTML = '<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:40px;text-align:center;color:#94a3b8;">还没有订单，<a href="javascript:void(0)" onclick="if(window.switchUserTab)switchUserTab(\'shop\');" style="color:#16a34a;">去商城看看</a></div>';
            renderOrdersPagination(data);
            return;
        }
        box.innerHTML = data.items.map(function (o, idx) {
            var itemsTxt = (o.items || []).map(function (it) { return esc(it.product_name) + ' ×' + it.quantity; }).join('、');
            var payBtn = (o.status === 'pending_payment' && state.payment.enabled)
                ? '<button type="button" onclick="event.stopPropagation();userPayOrder(' + o.id + ')" style="border:none;background:#16a34a;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.84em;font-weight:600;box-shadow:0 2px 8px rgba(22,163,74,.2);">去支付</button>'
                : '';
            var cancelBtn = o.status === 'pending_payment'
                ? '<button type="button" onclick="event.stopPropagation();userCancelOrder(' + o.id + ')" style="border:1px solid #fecaca;background:#fff;color:#dc2626;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.84em;">取消</button>'
                : '';
            var buyAgainBtn = (o.status === 'completed' || o.status === 'cancelled' || o.status === 'refunded') && o.items && o.items.length === 1
                ? '<button type="button" onclick="event.stopPropagation();shopBuyAgain(' + o.items[0].product_id + ')" style="border:1px solid #dcfce7;background:#f0fdf4;color:#15803d;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.84em;font-weight:600;">再来一单</button>'
                : '';
            var stamps = '';
            if (o.created_at) stamps += '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#cbd5e1;display:flex;">' + _svg.calendar + '</span>下单 ' + _fmtTime(o.created_at) + '</span>';
            if (o.paid_at)    stamps += '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#cbd5e1;display:flex;">' + _svg.card + '</span>支付 ' + _fmtTime(o.paid_at) + '</span>';
            if (o.shipped_at) stamps += '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#cbd5e1;display:flex;">' + _svg.truck + '</span>发货 ' + _fmtTime(o.shipped_at) + '</span>';
            return '<div class="shop-card-anim" style="animation-delay:' + Math.min(idx * 0.05, 0.25) + 's;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;transition:box-shadow .18s,transform .18s;" onmouseover="this.style.boxShadow=\'0 4px 16px rgba(15,23,42,.08)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.boxShadow=\'\';this.style.transform=\'\'">'
                + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">'
                + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0;">'
                + '<span style="font-family:Consolas,monospace;color:#64748b;font-size:.84em;white-space:nowrap;">' + esc(o.order_no) + '</span>'
                + '<span style="background:' + o.status_bg + ';color:' + o.status_color + ';padding:2px 10px;border-radius:999px;font-size:.78em;font-weight:700;white-space:nowrap;">' + esc(o.status_label) + '</span>'
                + '</div>'
                + '<span style="color:#16a34a;font-weight:800;font-size:1.1em;white-space:nowrap;">¥' + esc(o.total) + '</span>'
                + '</div>'
                + '<div style="color:#0f172a;font-size:.9em;font-weight:500;margin-bottom:10px;padding:10px 12px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9;">' + itemsTxt + '</div>'
                + '<div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;">'
                + '<div style="display:flex;gap:12px;color:#94a3b8;font-size:.8em;flex-wrap:wrap;">' + stamps + '</div>'
                + '<div style="display:flex;gap:8px;">' + payBtn + cancelBtn + buyAgainBtn + '</div>'
                + '</div></div>';
        }).join('');
        renderOrdersPagination(data);
    }
    function renderOrdersPagination(data) {
        var box = document.getElementById('userOrdersPagination');
        if (!box) return;
        var totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.per_page || 10)));
        if (totalPages <= 1) { box.innerHTML = ''; return; }
        var html = '', cur = data.page || 1;
        function btn(p, label, dis, act) {
            return '<button type="button" ' + (dis ? 'disabled' : 'onclick="loadMyOrders(' + p + ')"')
                + ' style="border:1px solid #e2e8f0;padding:6px 12px;border-radius:6px;background:' + (act ? '#16a34a' : '#fff') + ';color:' + (act ? '#fff' : '#64748b') + ';cursor:' + (dis ? 'not-allowed' : 'pointer') + ';opacity:' + (dis ? '.4' : '1') + ';">' + label + '</button>';
        }
        html += btn(cur - 1, '上一页', cur <= 1, false);
        for (var i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - cur) <= 2) html += btn(i, String(i), false, i === cur);
            else if (Math.abs(i - cur) === 3) html += '<span style="padding:6px 4px;color:#94a3b8;">…</span>';
        }
        html += btn(cur + 1, '下一页', cur >= totalPages, false);
        box.innerHTML = html;
    }
    function userCancelOrder(id) {
        if (!confirm('确认取消该订单？取消后已购商品会回到商城库存。')) return;
        var fd = new FormData();
        fd.append('action', 'shop_cancel_order');
        fd.append('csrf', window.userCsrf || '');
        fd.append('id', id);
        fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.status === 'success') {
                    toast(res.message || '已取消', 'success');
                    loadMyOrders(_ordersPage);
                } else {
                    toast(res.message || '操作失败', 'error');
                }
            });
    }
    function userPayOrder(id) {
        if (_paySubmitting) return;
        _paySubmitting = true;
        var fd = new FormData();
        fd.append('action', 'shop_pay_order');
        fd.append('csrf', window.userCsrf || '');
        fd.append('id', id);
        fd.append('pay_type', state.payment.selectedType || state.payment.type || '');
        fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                _paySubmitting = false;
                if (res.status !== 'success' || !res.payment || !res.payment.url) {
                    toast(res.message || '创建支付失败', 'error');
                    return;
                }
                window.location.href = res.payment.url;
            })
            .catch(function () { _paySubmitting = false; toast('网络错误', 'error'); });
    }

    // ===== 暴露到 window =====
    window.shopApplyFilters = function () {
        var inp = document.getElementById('shopSearchInput');
        state.keyword = inp ? inp.value.trim() : '';
        state.currentPage = 1;
        _updateSearchClearBtn();
        loadProducts();
    };
    window.shopClearSearch = function () {
        var inp = document.getElementById('shopSearchInput');
        if (inp) inp.value = '';
        state.keyword = '';
        state.currentPage = 1;
        _updateSearchClearBtn();
        loadProducts();
    };
    function _updateSearchClearBtn() {
        var inp = document.getElementById('shopSearchInput');
        var btn = document.getElementById('shopSearchClearBtn');
        if (btn) btn.style.display = (inp && inp.value.trim()) ? 'block' : 'none';
    }
    window.shopFilterOrders = filterOrders;
    window.shopBuyAgain = function (productId) {
        if (window.switchUserTab) switchUserTab('shop');
        setTimeout(function () { openDetail(productId); }, 200);
    };
    window.shopSelectCategory = function (id) {
        state.currentCategory = id; state.currentPage = 1;
        renderCategoryChips(); loadProducts();
    };
    window.shopGoPage = function (p) { state.currentPage = p; loadProducts(); };
    window.shopOpenDetail = openDetail;
    window.shopQuickBuy = quickBuy;
    window.shopCloseDetail = closeDetail;
    window.shopDetailQty = function (delta) {
        var input = document.getElementById('shopDetailQty');
        if (!input) return;
        var min = Number(input.getAttribute('min')) || 1;
        var max = Number(input.getAttribute('max')) || 99;
        var v = (Number(input.value) || min) + delta;
        input.value = Math.min(max, Math.max(min, v));
    };
    window.shopOpenCheckout = openCheckout;
    window.shopCloseCheckout = closeCheckout;
    window.shopSubmitOrder = submitOrder;
    window.shopCheckoutQty = checkoutQty;
    window.shopCheckoutQtyInput = checkoutQtyInput;
    window.shopCheckoutQtyCommit = checkoutQtyCommit;
    window.loadMyOrders = loadMyOrders;
    window.userCancelOrder = userCancelOrder;
    window.userPayOrder = userPayOrder;
    window.shopSelectPayType = function (value, containerId) {
        state.payment.selectedType = value;
        renderPayTypeSelector('shopCheckoutPayTypeSelector');
        renderPayTypeSelector('shopOrdersPayTypeSelector');
    };

    // ===== 进入 tab 时自动加载 =====
    document.addEventListener('DOMContentLoaded', function () {
        var url = new URL(window.location.href);
        var tab = url.searchParams.get('tab') || '';
        loadPaymentConfig();
        if (tab === 'shop') initShopTab();
        if (tab === 'orders') loadMyOrders(1);
        var orig = window.switchUserTab;
        window.switchUserTab = function (key) {
            if (typeof orig === 'function') orig.apply(this, arguments);
            if (key === 'shop') initShopTab();
            if (key === 'orders') loadMyOrders(1);
        };
        // 搜索框输入时显示/隐藏清除按钮
        var searchInp = document.getElementById('shopSearchInput');
        if (searchInp) {
            searchInp.addEventListener('input', _updateSearchClearBtn);
        }
    });
})();
