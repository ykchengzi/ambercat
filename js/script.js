/**
 * FoxMC 前台主脚本（静态版）
 * ============================================================
 * 模块结构（按初始化顺序）：
 *   1. State          —— 跨模块共享状态
 *   2. DOM            —— 安全 DOM / URL 辅助（XSS 防护）
 *   3. Announce       —— 首页公告（来自 data.js）
 *   4. LazyReveal     —— 图片懒加载 + 滚动渐显
 *   5. Gallery        —— 相册轮播
 *   6. Nav            —— 移动端导航汉堡菜单
 *   7. CMS            —— 读取并应用静态 CMS 内容
 *   8. ServerStatus   —— 在线人数（来自 data.js）
 *   9. TeamCarousel   —— 团队卡片无缝滚动
 *  10. ContactForm    —— 联系表单（静态版：mailto / Formspree）
 *
 * 入口：DOMContentLoaded → 各模块 init()
 * ============================================================
 */
(function () {
    'use strict';

    // ---- 静态数据 ----
    var DATA = window.__FOXMC_STATIC_DATA__ || {};

    // ============================================================
    // 1. State —— 跨模块共享状态
    // ============================================================
    var state = {
        serverIP: 'play.example.com',
        siteMode: 'international',
        neteaseTierCap: 4,
        io: null   // IntersectionObserver 实例
    };

    // ============================================================
    // 2. DOM —— 安全 DOM / URL 辅助
    // ============================================================
    var $ = function (sel) { return document.querySelector(sel); };

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g,  '\x26amp;')
            .replace(/</g,  '\x26lt;')
            .replace(/>/g,  '\x26gt;')
            .replace(/"/g,  '\x26quot;')
            .replace(/'/g,  '\x26#39;');
    }

    function normalizeMediaUrl(url) {
        if (typeof url !== 'string') return '';
        var value = url.trim().replace(/\\/g, '/');
        var cssUrlMatch = value.match(/^url\((['\x22]?)(.*?)\1\)$/i);
        if (cssUrlMatch) value = cssUrlMatch[2].trim();
        if (!value || /^(javascript|data):/i.test(value)) return '';
        value = value.replace(/^\.\.\/\.?\//, './');
        if (/^\.\.\/(uploads|png|egg|assets|user\/uploads)\//i.test(value)) value = './' + value.replace(/^\.\.\//, '');
        if (/^admin\/(uploads|assets)\//i.test(value)) value = './' + value;
        if (/^https?:\/\//i.test(value) || value.startsWith('#')) return value;
        if (value.startsWith('./') || value.startsWith('/') || value.startsWith('../')) return value.replace(/ /g, '%20');
        if (/^[A-Za-z0-9_\-.\/% ]+$/.test(value) && (value.indexOf('/') !== -1 || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(value))) return './' + value.replace(/^\/+/, '').replace(/ /g, '%20');
        return '';
    }

    function safeText(el, text) {
        if (el && text != null) el.textContent = text;
    }

    function safeImgSrc(el, url) {
        if (!el || !url) return;
        var safeUrl = normalizeMediaUrl(url);
        if (!safeUrl) return;
        if (!el.dataset.defaultSrc) {
            var originalSrc = el.getAttribute('data-src') || el.getAttribute('src') || '';
            if (originalSrc && !originalSrc.startsWith('data:')) el.dataset.defaultSrc = originalSrc;
        }
        if (!el.dataset.fallbackBound) {
            el.dataset.fallbackBound = '1';
            el.addEventListener('error', function () {
                var fallback = normalizeMediaUrl(el.dataset.defaultSrc || '');
                if (fallback && el.getAttribute('src') !== fallback) {
                    el.setAttribute('data-src', fallback);
                    el.setAttribute('src', fallback);
                }
            });
        }
        el.setAttribute('data-src', safeUrl);
        el.setAttribute('src', safeUrl);
    }

    function createSafeImg(url, alt, className) {
        var img = document.createElement('img');
        if (className) img.className = className;
        img.alt = alt || '';
        safeImgSrc(img, url);
        return img;
    }

    function safeBg(el, url) {
        if (!el || !url) return;
        var safeUrl = normalizeMediaUrl(url);
        if (!safeUrl) return;
        el.style.backgroundImage = "url('" + safeUrl.replace(/'/g, "\\'") + "')";
        if (el.hasAttribute('data-bg')) el.removeAttribute('data-bg');
    }

    function safeLink(el, url) {
        if (!el || !url) return;
        if (typeof url === 'string') {
            if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('#') || url.startsWith('/')) {
                el.href = url;
            } else if (/^[a-zA-Z0-9]/.test(url) && url.indexOf('.') !== -1) {
                el.href = 'https://' + url;
            }
        }
    }

    function copyServerIP() {
        navigator.clipboard.writeText(state.serverIP).then(function () {
            setTimeout(function () {
                var toggle = document.getElementById('toggle');
                if (toggle) toggle.checked = false;
            }, 2000);
        }).catch(function () {});
    }

    // 3. UserSession —— 已移除，纯静态站点无需登录

    // ============================================================
    // 4. Announce —— 首页公告（来自静态数据）
    // ============================================================
    var announce = {
        STORAGE_KEY: 'foxmc_announcement_popup_hidden',
        LEVEL_LABELS: { info: '服务器公告', success: '活动通知', warning: '维护通知', danger: '紧急通知' },
        els: null,
        activeId: '',

        init: function () {
            var els = {
                wrap:    document.getElementById('homeAnnouncements'),
                list:    document.getElementById('homeAnnouncementsList'),
                popup:   document.getElementById('announcementPopup'),
                close:   document.getElementById('announcementPopupClose'),
                badge:   document.getElementById('announcementPopupBadge'),
                title:   document.getElementById('announcementPopupTitle'),
                time:    document.getElementById('announcementPopupTime'),
                content: document.getElementById('announcementPopupContent')
            };
            for (var k in els) { if (!els[k]) return; }
            this.els = els;

            els.close.addEventListener('click', this._close.bind(this));
            els.popup.addEventListener('click', function (e) {
                if (e.target && e.target.getAttribute('data-close-popup') === '1') announce._close();
            });

            this._load();
        },

        _load: function () {
            // 从静态数据读取公告
            var annData = (DATA.announcements) || {};
            var homeList  = Array.isArray(annData.home)  ? annData.home  : [];
            var popupList = Array.isArray(annData.popup) ? annData.popup : [];

            this.els.wrap.hidden = true;
            this.els.list.innerHTML = '';

            // 弹窗公告
            var popupItem = popupList.length ? popupList[0] : (homeList.length ? homeList[0] : null);
            if (popupItem) {
                var popupId = String(popupItem.id || '');
                if (popupId && localStorage.getItem(this.STORAGE_KEY) !== popupId) {
                    this._open(popupItem);
                }
            }
        },

        _open: function (item) {
            if (!item) return;
            var els = this.els;
            this.activeId = String(item.id || '');
            els.badge.textContent   = this.LEVEL_LABELS[item.level] || '服务器公告';
            els.title.textContent   = item.title || '服务器公告';
            els.time.textContent    = item.start_at || item.publish_at || item.created_at || '';
            els.content.innerHTML   = escapeHtml(item.content || '').replace(/\n/g, '<br>');
            els.popup.hidden = false;
            document.body.classList.add('has-announcement-popup');
        },

        _close: function () {
            this.els.popup.hidden = true;
            document.body.classList.remove('has-announcement-popup');
            if (this.activeId) localStorage.setItem(this.STORAGE_KEY, this.activeId);
        }
    };

    // ============================================================
    // 5. LazyReveal —— 图片懒加载 + 滚动渐显
    // ============================================================
    var lazyReveal = {
        SELECTOR: '[data-src], [data-bg], .scroll-fade-up, .section-header, .spec-card',
        REVEAL_CLASSES: ['scroll-fade-up', 'section-header', 'spec-card'],

        init: function () {
            if (!('IntersectionObserver' in window)) {
                this._fallback();
                return;
            }
            var self = this;
            state.io = new IntersectionObserver(function (entries, obs) { self._onIntersect(entries, obs); }, {
                rootMargin: '200px 0px',
                threshold: 0.01
            });
            document.querySelectorAll(this.SELECTOR).forEach(function (el) { state.io.observe(el); });

            setTimeout(function () {
                document.querySelectorAll('.hero .scroll-fade-up:not(.revealed)').forEach(function (el) {
                    el.classList.add('revealed');
                });
            }, 300);
        },

        _onIntersect: function (entries, obs) {
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                if (!entry.isIntersecting) continue;
                var el = entry.target;

                if (el.tagName === 'IMG' && el.dataset.src) {
                    el.src = el.dataset.src;
                    el.removeAttribute('data-src');
                }
                if (el.dataset.bg) {
                    safeBg(el, el.dataset.bg);
                }
                if (this.REVEAL_CLASSES.some(function (c) { return el.classList.contains(c); })) {
                    el.classList.add('revealed');
                }
                obs.unobserve(el);
            }
        },

        _fallback: function () {
            document.querySelectorAll('.scroll-fade-up, .section-header, .spec-card').forEach(function (el) {
                el.classList.add('revealed');
            });
            document.querySelectorAll('img[data-src]').forEach(function (img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
            document.querySelectorAll('[data-bg]').forEach(function (el) {
                safeBg(el, el.dataset.bg);
            });
        }
    };

    // ============================================================
    // 6. Gallery —— 相册轮播
    // ============================================================
    var gallery = {
        AUTO_INTERVAL: 5000,
        FADE_MS: 300,
        images: [
            { src: './png/f5ea0ca06bf5ac36704b7277536ab53d.jpg', desc: '宏伟的主城大厅' },
            { src: './png/5e1e1be033cbd911e62327519886379f.jpg', desc: '精美的玩家建筑' },
            { src: './png/9cca3afcca8c0a79eac6a39aad5d65ec.jpg', desc: '广阔的生存世界' },
            { src: './egg/img1_bcd004c0.jpg',                    desc: '热闹的活动现场' },
            { src: './egg/img2_ab032cdc.jpg',                    desc: '激情的PVP对战' }
        ],
        currentIndex: 0,
        isTransitioning: false,
        autoPlayTimer: null,
        preloaded: false,
        els: {},

        init: function () {
            this.els.image = document.getElementById('galleryImage');
            this.els.desc  = document.getElementById('galleryDescription');
            this.els.prev  = document.getElementById('prevBtn');
            this.els.next  = document.getElementById('nextBtn');

            this._lazyPreload();

            if (!this._ready()) return;
            var self = this;
            this.els.next.addEventListener('click', function () { self.next(); });
            this.els.prev.addEventListener('click', function () { self.prev(); });

            this._startAutoPlay();

            var container = document.querySelector('.gallery-carousel-container');
            if (container) {
                container.addEventListener('mouseenter', function () { self._stopAutoPlay(); }, { passive: true });
                container.addEventListener('mouseleave', function () { self._startAutoPlay(); }, { passive: true });
            }

            document.addEventListener('visibilitychange', function () {
                if (document.hidden) self._stopAutoPlay();
                else self._startAutoPlay();
            });
        },

        replaceFromCms: function (items) {
            var next = [];
            (items || []).forEach(function (g) {
                var src = normalizeMediaUrl(g.src);
                if (src) next.push({ src: src, desc: g.caption });
            });
            if (next.length) {
                this.images = next;
                this.currentIndex = 0;
            }
            if (this.images.length && this.els.image && this.els.desc) {
                safeImgSrc(this.els.image, this.images[0].src);
                this.els.desc.textContent = this.images[0].desc || '';
            }
        },

        next: function () {
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this._update(this.currentIndex);
        },

        prev: function () {
            this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
            this._update(this.currentIndex);
        },

        _ready: function () {
            return this.els.image && this.els.desc && this.els.prev && this.els.next;
        },

        _update: function (index) {
            if (this.isTransitioning) return;
            this.isTransitioning = true;
            var self = this;
            this.els.image.classList.add('fade-out');
            setTimeout(function () {
                self.els.image.src = self.images[index].src;
                self.els.desc.textContent = self.images[index].desc;
                self.els.image.classList.remove('fade-out');
                self.isTransitioning = false;
            }, this.FADE_MS);
        },

        _startAutoPlay: function () {
            this._stopAutoPlay();
            var self = this;
            this.autoPlayTimer = setInterval(function () { self.next(); }, this.AUTO_INTERVAL);
        },

        _stopAutoPlay: function () {
            if (this.autoPlayTimer) {
                clearInterval(this.autoPlayTimer);
                this.autoPlayTimer = null;
            }
        },

        _lazyPreload: function () {
            var sec = document.getElementById('gallery');
            var self = this;
            var doPreload = function () {
                if (self.preloaded) return;
                self.preloaded = true;
                self.images.forEach(function (item) { var img = new Image(); img.src = item.src; });
            };
            if (sec && 'IntersectionObserver' in window) {
                var io = new IntersectionObserver(function (entries, obs) {
                    if (entries[0].isIntersecting) { doPreload(); obs.unobserve(sec); }
                }, { rootMargin: '400px 0px' });
                io.observe(sec);
            } else if (sec) {
                doPreload();
            }
        }
    };

    // ============================================================
    // 7. Nav —— 移动端导航汉堡菜单
    // ============================================================
    var nav = {
        hamburger: null,
        links: null,
        backdrop: null,

        init: function () {
            this.hamburger = document.querySelector('.hamburger');
            this.links     = document.querySelector('.nav-links');
            if (!this.hamburger || !this.links) return;

            this.backdrop = document.createElement('div');
            this.backdrop.className = 'nav-backdrop';
            this.backdrop.setAttribute('aria-hidden', 'true');
            document.body.appendChild(this.backdrop);

            var self = this;
            this.hamburger.addEventListener('click', function () { self._toggle(); });
            this.backdrop.addEventListener('click', function () { self._setOpen(false); });

            this.links.addEventListener('click', function (e) {
                if (e.target.tagName === 'A') self._setOpen(false);
            });

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') self._setOpen(false);
            });
            window.addEventListener('resize', function () {
                if (window.innerWidth > 768) self._setOpen(false);
            });
        },

        _toggle: function () {
            this._setOpen(!this.links.classList.contains('active'));
        },

        _setOpen: function (open) {
            this.hamburger.classList.toggle('active', open);
            this.links.classList.toggle('active', open);
            this.backdrop.classList.toggle('active', open);
            document.body.classList.toggle('nav-open', open);
        }
    };

    // ============================================================
    // 8. CMS —— 读取并应用静态内容（原 PHP: public_api.php?act=content）
    // ============================================================
    var cms = {
        init: function () {
            // 直接从嵌入式 data.js 读取，无需 fetch
            if (DATA.site)      this.applySite(DATA.site);
            if (DATA.hero)      this.applyHero(DATA.hero);
            if (DATA.specs)     this.applySpecs(DATA.specs);
            if (DATA.help)      this.applyHelp(DATA.help);
            if (DATA.features)  this.applyFeatures(DATA.features);
            if (DATA.gallery)   this.applyGallery(DATA.gallery);
            if (DATA.team)      this.applyTeam(DATA.team);
            if (DATA.community) this.applyCommunity(DATA.community);
            if (DATA.footer)    this.applyFooter(DATA.footer);
            serverStatus.init();
        },

        applySite: function (data) {
            var siteLogo   = document.getElementById('siteLogo');
            var footerLogo = document.getElementById('footerLogo');

            if (data.logo_image) {
                if (siteLogo) {
                    siteLogo.textContent = '';
                    siteLogo.appendChild(createSafeImg(data.logo_image, 'Logo', 'logo-img'));
                }
                if (footerLogo) {
                    footerLogo.textContent = '';
                    footerLogo.appendChild(createSafeImg(data.logo_image, 'Logo', 'footer-logo-img'));
                }
            } else if (data.logo_text) {
                var logoText = siteLogo && siteLogo.querySelector('.logo-text');
                if (logoText) logoText.textContent = data.logo_text;
                var footerText = footerLogo && footerLogo.querySelector('.footer-logo-text');
                if (footerText) footerText.textContent = data.logo_text;
            }

            if (data.server_ip) {
                state.serverIP = data.server_ip;
                safeText(document.getElementById('server-ip'), state.serverIP);
                safeText(document.getElementById('help-ip'),   state.serverIP);

                document.querySelectorAll('.copy-btn').forEach(function (btn) {
                    btn.onclick = function () {
                        navigator.clipboard.writeText(state.serverIP).then(function () {
                            var orig = btn.innerHTML;
                            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                            setTimeout(function () { btn.innerHTML = orig; }, 2000);
                        });
                    };
                });
            }

            if (data.server_mode === 'netease') {
                state.siteMode = 'netease';
                var tierCaps = { shangyao: 4, shanfeng: 12, yunding: 40 };
                state.neteaseTierCap = tierCaps[data.netease_tier] || 4;
                var copyLabel = document.querySelector('.boton-minecraft .texto-boton span:first-child');
                if (copyLabel) copyLabel.textContent = '复制山头链接';
            }
        },

        applyHero: function (data) {
            safeBg($('#home'), data.bg_image);
            var badge = $('.hero-badge');
            if (badge && data.badge) badge.lastChild.textContent = ' ' + data.badge;

            var h1 = $('.hero h1');
            if (h1 && data.title_line1 && data.title_highlight) {
                h1.textContent = '';
                h1.appendChild(document.createTextNode(data.title_line1));
                h1.appendChild(document.createElement('br'));
                var span = document.createElement('span');
                span.className = 'highlight';
                span.textContent = data.title_highlight;
                h1.appendChild(span);
            }
            safeText($('.hero-subtitle'), data.subtitle);

            if (data.features && data.features.length) {
                var container = $('.hero-features');
                if (container) {
                    var frag = document.createDocumentFragment();
                    data.features.forEach(function (f) {
                        var div = document.createElement('div');
                        div.className = 'h-feature';
                        div.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                        div.appendChild(document.createTextNode(f));
                        frag.appendChild(div);
                    });
                    container.textContent = '';
                    container.appendChild(frag);
                }
            }
        },

        applySpecs: function (data) {
            safeBg($('#specs'), data.bg_image);
            safeText($('#specs .section-title'),    data.title);
            safeText($('#specs .section-subtitle'), data.subtitle);
            var cards = document.querySelectorAll('.spec-card');
            (data.items || []).forEach(function (item, i) {
                var c = cards[i];
                if (!c) return;
                safeText(c.querySelector('.spec-title'), item.title);
                safeText(c.querySelector('.spec-desc'),  item.desc);
                safeText(c.querySelector('.spec-value'), item.value);
            });
        },

        applyHelp: function (data) {
            safeBg($('#help-docs'), data.bg_image);
            safeText($('#help-docs .section-title'),    data.title);
            safeText($('#help-docs .section-subtitle'), data.subtitle);
            var cards = document.querySelectorAll('.step-card');
            (data.steps || []).forEach(function (step, i) {
                if (!cards[i]) return;
                safeText(cards[i].querySelector('.step-title'), step.title);
                safeText(cards[i].querySelector('.step-desc'),  step.desc);
            });
        },

        applyFeatures: function (data) {
            safeBg($('#features'), data.bg_image);
            safeText($('#features .section-title'),    data.title);
            safeText($('#features .section-subtitle'), data.subtitle);
            var cards = document.querySelectorAll('.feature-card');
            (data.items || []).forEach(function (item, i) {
                if (!cards[i]) return;
                safeText(cards[i].querySelector('h3'), item.title);
                safeText(cards[i].querySelector('p'),  item.desc);
                safeImgSrc(cards[i].querySelector('.feature-icon'), item.icon);
            });
        },

        applyGallery: function (data) {
            safeBg($('#gallery'), data.bg_image);
            safeText($('#gallery .section-title'),    data.title);
            safeText($('#gallery .section-subtitle'), data.subtitle);
            if (data.items && data.items.length) {
                gallery.replaceFromCms(data.items);
            }
        },

        applyTeam: function (data) {
            safeBg($('#team'), data.bg_image);
            safeText($('#team .section-title'),    data.title);
            safeText($('#team .section-subtitle'), data.subtitle);
            var originals = document.querySelectorAll('.team-card:not(.team-card-clone)');
            (data.members || []).forEach(function (m, i) {
                var c = originals[i];
                if (!c) return;
                safeText(c.querySelector('.team-name'), m.name);
                safeText(c.querySelector('.team-role'), m.role);
                safeText(c.querySelector('.team-desc'), m.desc);
                safeImgSrc(c.querySelector('.team-avatar img'), m.avatar);
                var contactBtn = c.querySelector('.team-contact-btn');
                if (contactBtn && m.contact_link) safeLink(contactBtn, m.contact_link);
            });
            var wrapper = document.getElementById('teamWrapper');
            if (wrapper) {
                wrapper.querySelectorAll('.team-card-clone').forEach(function (c) { c.remove(); });
                wrapper.querySelectorAll('.team-card').forEach(function (card) {
                    var clone = card.cloneNode(true);
                    clone.classList.add('team-card-clone');
                    wrapper.appendChild(clone);
                });
            }
        },

        applyCommunity: function (data) {
            var community = $('#community');
            safeBg(community, data.bg_image);
            if (community && !data.bg_image && !community.style.backgroundImage) {
                safeBg(community, community.getAttribute('data-bg') || 'png/wj_Narcissa_3.png');
            }
            safeText($('#community .section-title'),    data.title);
            safeText($('#community .section-subtitle'), data.subtitle);
            var cards = document.querySelectorAll('.community-card');
            [0, 1].forEach(function (i) {
                if (!cards[i]) return;
                var prefix = i === 0 ? 'qq' : 'wechat';
                safeText(cards[i].querySelector('h3'), data[prefix + '_text'] || '');
                safeText(cards[i].querySelector('p'),  data[prefix + '_desc'] || '');
                var qr = cards[i].querySelector('.qr-code');
                if (qr && data[prefix + '_qr']) {
                    qr.textContent = '';
                    var img = createSafeImg(data[prefix + '_qr'], '二维码');
                    img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                    qr.appendChild(img);
                    qr.style.opacity = '1';
                    qr.style.background = 'none';
                }
                safeLink(cards[i].querySelector('a'), data[prefix + '_link']);
            });
        },

        applyFooter: function (data) {
            safeText($('.footer-desc'), data.desc);
            var copy = document.querySelector('.footer-bottom .container p:first-child');
            if (copy && data.copyright) copy.textContent = data.copyright;

            if (data.friend_links && data.friend_links.length) {
                var list = document.getElementById('footerFriendLinks');
                if (list) {
                    list.textContent = '';
                    data.friend_links.forEach(function (link) {
                        var li = document.createElement('li');
                        var a  = document.createElement('a');
                        a.textContent = link.name;
                        safeLink(a, link.url);
                        if (!a.href) a.href = '#';
                        li.appendChild(a);
                        list.appendChild(li);
                    });
                }
            }
        }
    };

    // ============================================================
    // 9. ServerStatus —— 在线人数（来自静态数据）
    // ============================================================
    var serverStatus = {
        init: function () {
            var dot       = $('.status-dot');
            var container = $('.status-text');
            var text      = $('.highlight-green');
            var ss        = (DATA.server_status) || {};
            var mode      = ss.mode || 'static';

            if (state.siteMode === 'netease') {
                if (container) {
                    container.textContent = '';
                    container.append('最多可支持 ');
                    var span = document.createElement('span');
                    span.className = 'highlight-green';
                    span.textContent = state.neteaseTierCap;
                    container.appendChild(span);
                    container.append(' 名玩家');
                }
                return;
            }

            if (mode === 'api') {
                if (text) text.textContent = '加载中...';
                fetch('admin/public_api.php?act=server_status')
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (res) {
                        if (res && res.success && res.data) {
                            if (text) text.textContent = res.data.p;
                        } else {
                            if (text) text.textContent = '离线';
                            if (dot)  dot.style.backgroundColor = '#ef4444';
                        }
                    })
                    .catch(function () {
                        if (text) text.textContent = '离线';
                        if (dot) { dot.style.backgroundColor = '#ef4444'; dot.style.boxShadow = '0 0 10px #ef4444'; }
                    });
            } else {
                // 静态模式
                if (container && ss.static_text) {
                    var val = ss.static_value || '--';
                    container.textContent = '';
                    container.append(ss.static_text + ': ');
                    var s = document.createElement('span');
                    s.className = 'highlight-green';
                    s.textContent = val;
                    container.appendChild(s);
                    container.append(' 玩家');
                }
            }
        }
    };

    // ============================================================
    // 10. TeamCarousel —— 团队卡片无缝滚动
    // ============================================================
    var teamCarousel = {
        init: function () {
            var wrapper = document.getElementById('teamWrapper');
            if (!wrapper) return;

            var originals = wrapper.querySelectorAll('.team-card');
            for (var i = 0; i < originals.length; i++) {
                var clone = originals[i].cloneNode(true);
                clone.classList.add('team-card-clone');
                wrapper.appendChild(clone);
            }

            if (state.io) {
                wrapper.querySelectorAll('img[data-src]').forEach(function (img) { state.io.observe(img); });
            }

            var section = document.getElementById('team');
            if (section && 'IntersectionObserver' in window) {
                var io = new IntersectionObserver(function (entries) {
                    wrapper.style.animationPlayState = entries[0].isIntersecting ? 'running' : 'paused';
                }, { rootMargin: '100px 0px' });
                io.observe(section);
            }
        }
    };

    // ============================================================
    // 11. ContactForm —— 联系表单（静态版：mailto / Formspree / none）
    // ============================================================
    var contactForm = {
        MAX_FILES: 3,
        MAX_SIZE: 5 * 1024 * 1024,
        selectedFiles: [],
        els: {},

        init: function () {
            var form = document.getElementById('contactForm');
            if (!form) return;
            this.els = {
                form:    form,
                area:    document.getElementById('uploadArea'),
                input:   document.getElementById('attachment'),
                preview: document.getElementById('uploadPreview'),
                editor:  document.getElementById('msgEditor'),
                hint:    document.getElementById('attachHint')
            };

            this._bindUpload();
            this._bindDragDrop();

            var self = this;
            form.addEventListener('submit', function (e) { self._submit(e); });
        },

        _bindUpload: function () {
            var area  = this.els.area;
            var input = this.els.input;
            if (!area || !input) return;
            var self = this;
            area.addEventListener('click', function () { input.click(); });
            input.addEventListener('change', function () {
                self._addFiles(input.files);
                input.value = '';
            });
        },

        _bindDragDrop: function () {
            var editor = this.els.editor;
            if (!editor) return;
            var self = this;
            editor.addEventListener('dragover', function (e) {
                e.preventDefault();
                editor.style.borderColor = '#10b981';
            });
            editor.addEventListener('dragleave', function (e) {
                if (!editor.contains(e.relatedTarget)) editor.style.borderColor = '';
            });
            editor.addEventListener('drop', function (e) {
                e.preventDefault();
                editor.style.borderColor = '';
                self._addFiles(e.dataTransfer.files);
            });
        },

        _addFiles: function (files) {
            for (var i = 0; i < files.length; i++) {
                if (this.selectedFiles.length >= this.MAX_FILES) break;
                var file = files[i];
                if (!file.type.startsWith('image/')) continue;
                if (file.size > this.MAX_SIZE) {
                    alert('图片 "' + file.name + '" 超过5MB限制');
                    continue;
                }
                this.selectedFiles.push(file);
            }
            this._renderPreview();
        },

        _renderPreview: function () {
            var preview = this.els.preview;
            var hint    = this.els.hint;
            preview.innerHTML = '';
            for (var i = 0; i < this.selectedFiles.length; i++) {
                (function (file, idx) {
                    var item = document.createElement('div');
                    item.className = 'upload-preview-item';
                    var img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.alt = file.name;
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'remove-btn';
                    btn.textContent = '\xD7';
                    btn.setAttribute('aria-label', '移除图片');
                    btn.addEventListener('click', function () {
                        contactForm.selectedFiles.splice(idx, 1);
                        contactForm._renderPreview();
                    });
                    item.appendChild(img);
                    item.appendChild(btn);
                    preview.appendChild(item);
                })(this.selectedFiles[i], i);
            }
            if (hint) hint.textContent = this.selectedFiles.length > 0
                ? this.selectedFiles.length + '/3 张'
                : '最多3张，每张≤5MB';
        },

        _submit: function (e) {
            e.preventDefault();
            var contactCfg = (DATA.contact) || {};
            var method = contactCfg.method || 'mailto';

            if (method === 'none') {
                return;
            }

            var form    = this.els.form;
            var nameVal    = (document.getElementById('name')    || {}).value || '';
            var emailVal   = (document.getElementById('email')   || {}).value || '';
            var subjectVal = (document.getElementById('subject') || {}).value || '';
            var messageVal = (document.getElementById('message') || {}).value || '';

            if (method === 'mailto') {
                var toEmail = contactCfg.mailto_email || 'admin@example.com';
                var body = encodeURIComponent(
                    '发件人: ' + nameVal + '\n' +
                    '邮箱: ' + emailVal + '\n' +
                    '主题: ' + subjectVal + '\n' +
                    '内容:\n' + messageVal
                );
                var mailtoUrl = 'mailto:' + encodeURIComponent(toEmail)
                    + '?subject=' + encodeURIComponent('[玩家反馈] ' + subjectVal)
                    + '&body=' + body;

                window.location.href = mailtoUrl;

                var submitBtn = form.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.innerHTML = '<span>' + (contactCfg.success_message || '已打开邮件客户端！') + '</span>';
                    submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    submitBtn.style.opacity = '1';
                    submitBtn.disabled = true;
                    setTimeout(function () {
                        submitBtn.innerHTML = '<span>发送邮件</span><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                    }, 3000);
                }
                form.reset();
                this.selectedFiles = [];
                this._renderPreview();
                return;
            }

            if (method === 'formspree') {
                var formId = contactCfg.formspree_id;
                if (!formId) {
                    alert('请在 data.js 中配置 formspree_id');
                    return;
                }

                var submitBtn = form.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.innerHTML = '<span>发送中...</span>';
                    submitBtn.style.opacity = '0.8';
                    submitBtn.disabled = true;
                }

                var formData = new FormData();
                formData.append('name', nameVal);
                formData.append('email', emailVal);
                formData.append('subject', subjectVal);
                formData.append('message', messageVal);

                var self = this;
                fetch('https://formspree.io/f/' + formId, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                })
                .then(function (r) { return r.json(); })
                .then(function (result) {
                    if (result.ok) {
                        if (submitBtn) {
                            submitBtn.innerHTML = '<span>发送成功！</span>';
                            submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                            submitBtn.style.opacity = '1';
                        }
                        form.reset();
                        self.selectedFiles = [];
                        self._renderPreview();
                        setTimeout(function () {
                            if (submitBtn) {
                                submitBtn.innerHTML = '<span>发送邮件</span><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                                submitBtn.style.background = '';
                                submitBtn.disabled = false;
                            }
                        }, 3000);
                    } else {
                        alert('发送失败，请稍后重试');
                        if (submitBtn) {
                            submitBtn.innerHTML = '<span>发送邮件</span><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                            submitBtn.style.opacity = '';
                            submitBtn.disabled = false;
                        }
                    }
                })
                .catch(function () {
                    alert('发送出错，请稍后重试');
                    if (submitBtn) {
                        submitBtn.innerHTML = '<span>发送邮件</span><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                        submitBtn.style.opacity = '';
                        submitBtn.disabled = false;
                    }
                });
            }
        }
    };

    // ============================================================
    // Entry —— 启动入口
    // ============================================================
    document.addEventListener('DOMContentLoaded', function () {
        announce.init();

        var toggle = document.getElementById('toggle');
        if (toggle) toggle.addEventListener('change', function () { if (toggle.checked) copyServerIP(); });

        lazyReveal.init();
        gallery.init();
        nav.init();
        cms.init();
        teamCarousel.init();
        contactForm.init();
    });
})();
