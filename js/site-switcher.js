/**
 * GameTogether 全站悬浮圆形导航模块（零依赖，自动适配暗黑玻璃风）
 * 用法：<script src="js/site-switcher.js" data-current-site="mygame"></script>
 */
(function () {
    // 客户端内嵌模式自动隐藏
    const isEmbedded =
        window.self !== window.top ||
        new URLSearchParams(window.location.search).get('embed') === 'modtogether';
    if (isEmbedded) return;

    const currentScript = document.currentScript;
    const currentSite = currentScript?.getAttribute('data-current-site') || '';

    const SITES = [
        { id: 'home',     name: '官网主页',     icon: '🏠', color: '#06b6d4', url: 'https://gametogether1.github.io/' },
        { id: 'mygame',   name: '单机游戏',     icon: '🎮', color: '#00f3ff', url: 'https://gametogether1.github.io/mygame/' },
        { id: 'myswitch', name: 'Switch 掌机',  icon: '🕹️', color: '#8b5cf6', url: 'https://gametogether1.github.io/myswitch/' },
        { id: 'myacg',    name: '外网 ACG',     icon: '🌸', color: '#ec4899', url: 'https://gametogether1.github.io/myacg/' },
        { id: 'myemu',    name: '复古模拟',     icon: '👾', color: '#6366f1', url: 'https://gametogether1.github.io/myemu/' },
        { id: 'mymod',    name: '游戏 MOD 库',  icon: '🧩', color: '#10b981', url: 'https://gametogether1.github.io/mymod/', comingSoon: true, badge: '搭建中' },
        { id: 'gamebox',  name: '一块游戏盒子', icon: '📦', color: '#f59e0b', url: 'https://gitee.com/GameTogether1/game-together-release/releases/download/v1.0.6/GameTogether_v1.0.6.zip', badge: '下载' }
    ];

    // 注入独立作用域样式，不与任何站点 CSS 冲突
    const style = document.createElement('style');
    style.textContent = `
        #gt-float-nav {
            position: fixed;
            right: 18px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 9990;
            font-family: Inter, system-ui, -apple-system, sans-serif;
        }
        #gt-float-trigger {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.92));
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 14px rgba(6, 182, 212, 0.35);
            transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
            outline: none;
            padding: 0;
        }
        #gt-float-trigger:hover,
        #gt-float-nav.open #gt-float-trigger {
            transform: scale(1.08);
            border-color: rgba(0, 243, 255, 0.8);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), 0 0 22px rgba(0, 243, 255, 0.55);
        }
        #gt-float-trigger svg {
            width: 22px;
            height: 22px;
            transition: transform 0.3s ease;
        }
        #gt-float-nav.open #gt-float-trigger svg {
            transform: rotate(45deg);
        }
        #gt-float-menu {
            position: absolute;
            right: 60px;
            top: 50%;
            transform: translateY(-50%) scale(0.92);
            transform-origin: right center;
            width: 204px;
            padding: 8px;
            border-radius: 16px;
            background: rgba(11, 17, 32, 0.94);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.22s;
        }
        #gt-float-nav.open #gt-float-menu {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(-50%) scale(1);
        }
        .gt-float-header {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            color: #94a3b8;
            padding: 6px 10px 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .gt-float-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 10px;
            color: #e2e8f0;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
            position: relative;
        }
        .gt-float-item::after {
            display: none !important;
        }
        .gt-float-item:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            transform: translateX(-2px);
        }
        .gt-float-item.active {
            background: rgba(6, 182, 212, 0.16);
            color: #fff;
            font-weight: 700;
            border: 1px solid rgba(6, 182, 212, 0.35);
        }
        .gt-float-icon {
            font-size: 15px;
            line-height: 1;
            width: 20px;
            text-align: center;
        }
        .gt-float-badge {
            margin-left: auto;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 9999px;
            font-weight: 700;
        }
        .gt-float-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.08);
            margin: 6px 4px;
        }
        @media (max-width: 640px) {
            #gt-float-nav { right: 12px; }
            #gt-float-trigger { width: 44px; height: 44px; }
            #gt-float-menu { right: 54px; width: 190px; }
        }
        #gt-cs-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.78);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: Inter, system-ui, -apple-system, sans-serif;
        }
        #gt-cs-card {
            width: 100%;
            max-width: 340px;
            background: #10172a;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 18px;
            padding: 26px 24px;
            text-align: center;
            color: #fff;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
        }
        #gt-cs-card h3 { margin: 0 0 8px; font-size: 19px; font-weight: 800; }
        #gt-cs-card p { margin: 0 0 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
        #gt-cs-ok {
            width: 100%;
            padding: 10px 0;
            border: none;
            border-radius: 12px;
            background: linear-gradient(90deg, #10b981, #06b6d4);
            color: #060913;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    function mount() {
        if (document.getElementById('gt-float-nav')) return;

        const wrap = document.createElement('div');
        wrap.id = 'gt-float-nav';

        const itemsHtml = SITES.map((s) => {
            const isActive = s.id === currentSite;
            const divider = s.id === 'gamebox' ? '<div class="gt-float-divider"></div>' : '';
            const isComingSoon = Boolean(s.comingSoon) && !isActive;
            const badge = isActive
                ? `<span class="gt-float-badge" style="background:rgba(6,182,212,0.22);color:#22d3ee;">当前</span>`
                : (s.badge ? `<span class="gt-float-badge" style="background:rgba(245,158,11,0.22);color:#fbbf24;">${s.badge}</span>` : '');
            const href = (isActive || isComingSoon) ? 'javascript:void(0)' : s.url;
            const csAttr = isComingSoon ? ' data-gt-coming-soon="true"' : '';
            return `${divider}<a class="gt-float-item${isActive ? ' active' : ''}" href="${href}"${csAttr}>
                <span class="gt-float-icon">${s.icon}</span>
                <span>${s.name}</span>
                ${badge}
            </a>`;
        }).join('');

        wrap.innerHTML = `
            <button type="button" id="gt-float-trigger" title="全站快捷导航" aria-label="全站快捷导航">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                </svg>
            </button>
            <div id="gt-float-menu">
                <div class="gt-float-header">
                    <span>一块游戏 · 全站导航</span>
                </div>
                ${itemsHtml}
            </div>
        `;

        document.body.appendChild(wrap);

        const trigger = document.getElementById('gt-float-trigger');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        wrap.querySelectorAll('[data-gt-coming-soon]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                wrap.classList.remove('open');
                showComingSoonModal();
            });
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) wrap.classList.remove('open');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                wrap.classList.remove('open');
                document.getElementById('gt-cs-overlay')?.remove();
            }
        });
    }

    function showComingSoonModal() {
        document.getElementById('gt-cs-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'gt-cs-overlay';
        overlay.innerHTML = `
            <div id="gt-cs-card">
                <div style="font-size:34px;margin-bottom:10px;">🛠️</div>
                <h3>正在搭建中</h3>
                <p>游戏 MOD 库正在紧锣密鼓搭建与完善中，敬请期待！</p>
                <button type="button" id="gt-cs-ok">我知道了</button>
            </div>
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
        document.getElementById('gt-cs-ok')?.addEventListener('click', () => overlay.remove());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
