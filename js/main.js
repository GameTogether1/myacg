// 游戏瀑布流、标签筛选、会员检查集成（分批次瀑布流版本 + 搜索功能）
let gamesData = [];
let filteredGames = [];
let loadedBatches = 0;          // 已加载的批次数
const gamesPerBatch = 20;       // 每批游戏数量
let currentTag = 'all';
let currentRating = 'all';
let currentGame = null;
let currentPreviewIndex = 0;
// 搜索相关变量
let currentSearchKeyword = '';   // 当前搜索关键词
let isSearchMode = false;         // 是否处于搜索模式
const gamesGrid = document.getElementById('gamesGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const tagButtons = document.querySelectorAll('#tag-filters .tag-pill');
const ratingButtons = document.querySelectorAll('#rating-filters .rating-pill');
const gameModal = document.getElementById('gameModal');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const previewImage = document.getElementById('previewImage');
const prevImageBtn = document.getElementById('prevImage');
const nextImageBtn = document.getElementById('nextImage');
const imageCounter = document.getElementById('imageCounter');
const previewThumbnails = document.getElementById('previewThumbnails');
const backToTopBtn = document.getElementById('back-to-top-btn');
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect fill='%231e293b' width='400' height='240'/%3E%3Ctext fill='%2364748b' font-family='sans-serif' font-size='16' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E暂无封面%3C/text%3E%3C/svg%3E";
const quarkLink = document.getElementById('quark-link');
const thunderLink = document.getElementById('thunder-link');
const quarkQrModal = document.getElementById('quark-qrcode-modal');
const quarkModalOverlay = document.getElementById('quark-modal-overlay');
const quarkModalBox = document.getElementById('quark-modal-box');
const quarkModalCloseBtn = document.getElementById('quark-modal-close-btn');
const quarkQrCanvas = document.getElementById('quark-qrcode-canvas');
// 搜索相关 DOM 元素
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchClear = document.getElementById('search-clear');
const searchResultInfo = document.getElementById('search-result-info');
const searchResultCount = document.getElementById('search-result-count');

// 关闭夸克二维码弹窗
function closeQuarkQrModal() {
    quarkQrModal?.classList.add('hidden');
}

// 打开夸克二维码弹窗（复用静态 DOM，避免重复创建/删除节点）
window.openQuarkQrModal = function(link) {
    if (!quarkQrModal || !quarkQrCanvas) return;
    quarkQrModal.classList.remove('hidden');
    if (window.QRCode) {
        window.QRCode.toCanvas(quarkQrCanvas, link, { width: 220 }, (err) => {
            if (err) console.error('二维码生成失败', err);
        });
    }
};

// 按 id 降序排序（大 id 在前）
function sortGamesByIdDesc(games) {
    return [...games].sort((a, b) => b.id - a.id);
}
// 加载游戏数据
async function loadGamesData() {
    try {
        const res = await fetch('data/game.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rawData = await res.json();
        gamesData = sortGamesByIdDesc(rawData);
    } catch (e) {
        console.error('加载游戏数据失败:', e);
        gamesGrid.innerHTML = '<div class="text-center py-12 text-red-500">加载游戏失败，请刷新重试</div>';
        return;
    }
    // 初始显示全部游戏（标签筛选）
    applyFilterAndRender();
}
// 核心：根据当前标签或搜索词刷新游戏列表并重新渲染
function applyFilterAndRender() {
    loadedBatches = 0;
    gamesGrid.innerHTML = '';
    
    if (isSearchMode && currentSearchKeyword.trim() !== '') {
        // 搜索模式：基于 gamesData 进行模糊匹配（gamesData 已按 id 降序排列，filter 保持顺序）
        const keyword = currentSearchKeyword.trim().toLowerCase();
        filteredGames = gamesData.filter(game => {
            if (game.titleCn && game.titleCn.toLowerCase().includes(keyword)) return true;
            if (game.titleEn && game.titleEn.toLowerCase().includes(keyword)) return true;
            if (game.title && game.title.toLowerCase().includes(keyword)) return true;
            return false;
        });
        
        // 显示搜索结果数量
        searchResultInfo.classList.remove('hidden');
        searchResultCount.innerText = filteredGames.length;
        
        // 清除标签与好评度高亮
        tagButtons.forEach(btn => {
            btn.classList.remove('bg-primary', 'active');
            btn.classList.add('bg-dark-lighter');
        });
        ratingButtons.forEach(btn => {
            btn.classList.remove('bg-accent', 'text-white', 'active');
            btn.classList.add('bg-dark-lighter', 'text-gray-200');
        });
    } else {
        // 标签 + 好评度组合筛选模式
        isSearchMode = false;
        currentSearchKeyword = '';
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.classList.add('hidden');
        searchResultInfo.classList.add('hidden');
        
        filteredGames = gamesData.filter(g => {
            const tags = Array.isArray(g.tags) ? g.tags : [];
            const matchTag = (currentTag === 'all') || tags.includes(currentTag) || (currentTag === '其它' && tags.includes('其他'));
            const matchRating = (currentRating === 'all') || tags.includes(currentRating);
            return matchTag && matchRating;
        });
        
        // 更新类型标签高亮
        tagButtons.forEach(btn => {
            if (btn.dataset.tag === currentTag) {
                btn.classList.add('bg-primary', 'active');
                btn.classList.remove('bg-dark-lighter');
            } else {
                btn.classList.remove('bg-primary', 'active');
                btn.classList.add('bg-dark-lighter');
            }
        });

        // 更新好评度标签高亮
        ratingButtons.forEach(btn => {
            if (btn.dataset.rating === currentRating) {
                btn.classList.add('bg-accent', 'text-white', 'active');
                btn.classList.remove('bg-dark-lighter', 'text-gray-200');
            } else {
                btn.classList.remove('bg-accent', 'text-white', 'active');
                btn.classList.add('bg-dark-lighter', 'text-gray-200');
            }
        });
    }
    
    // 重新加载第一批
    loadMore();
}
// 执行搜索（由搜索按钮或输入框触发）
function performSearch() {
    const keyword = searchInput ? searchInput.value.trim() : '';
    
    if (keyword === '') {
        // 清空搜索，恢复到标签筛选模式
        exitSearchMode();
        return;
    }
    
    isSearchMode = true;
    currentSearchKeyword = keyword;
    applyFilterAndRender();
}
// 退出搜索模式，恢复到标签筛选
function exitSearchMode() {
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.classList.add('hidden');
    isSearchMode = false;
    currentSearchKeyword = '';
    applyFilterAndRender();
}
// 创建一批游戏的瀑布流容器（列数由 style.css 媒体查询响应式控制，避免 resize 监听泄漏）
function createBatchContainer() {
    const batchDiv = document.createElement('div');
    batchDiv.className = 'waterfall-batch';
    return batchDiv;
}
// 将一批游戏卡片添加到指定的 batch 容器中
function addGamesToBatch(batchContainer, games) {
    games.forEach(game => {
        const card = createGameCard(game);
        batchContainer.appendChild(card);
    });
}
// 加载更多：每次加载一批（gamesPerBatch 条）
function loadMore() {
    if (!filteredGames.length) {
        gamesGrid.innerHTML = '<div class="text-center py-12 text-gray-400">暂无游戏</div>';
        loadMoreBtn.style.display = 'none';
        return;
    }
    const start = loadedBatches * gamesPerBatch;
    const end = Math.min(filteredGames.length, start + gamesPerBatch);
    if (start >= filteredGames.length) {
        loadMoreBtn.style.display = 'none';
        return;
    }
    const newGames = filteredGames.slice(start, end);
    const batchContainer = createBatchContainer();
    addGamesToBatch(batchContainer, newGames);
    gamesGrid.appendChild(batchContainer);
    loadedBatches++;
    if (end >= filteredGames.length) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'flex';
    }
}
// 创建单个游戏卡片
// 显示规则：如果存在 titleCn 和 titleEn，则分行显示（中文在上，英文在下，英文小字灰色）
// 否则，使用原有的 title 字段单行显示（样式完全不变）
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.setAttribute('data-id', game.id);
    const tagsHtml = game.tags.map(tag => `<span class="inline-block px-2 py-1 text-xs rounded-full bg-primary/80 mr-1 mb-1">${escapeHtml(tag)}</span>`).join('');
    
    let titleHtml;
    if (game.titleCn && game.titleEn) {
        // 两行显示：中文 + 换行 + 小号灰色英文
        titleHtml = `<h3 class="text-lg font-semibold text-center">${escapeHtml(game.titleCn)}<br><span class="text-sm text-gray-400">${escapeHtml(game.titleEn)}</span></h3>`;
    } else {
        // 兜底：单行显示
        titleHtml = `<h3 class="text-lg font-semibold text-center">${escapeHtml(game.titleCn || game.title)}</h3>`;
    }
    
    card.innerHTML = `
        <img src="${escapeHtml(game.coverImage)}" class="game-cover rounded-t-xl bg-dark-light" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
        <div class="p-4">
            <div class="flex flex-wrap gap-1 mb-2">${tagsHtml}</div>
            ${titleHtml}
        </div>
    `;
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.checkMemberAndAccess && window.checkMemberAndAccess() === true) {
            openGameModal(game);
        }
    });
    return card;
}

// 打开游戏详情
function openGameModal(game) {
    currentGame = game;
    currentPreviewIndex = 0;
    modalTitle.innerText = game.titleCn || game.title || '';
    updatePreviewImage();
    
    // 控制夸克网盘按钮的显示
    if (game.quarkLink && game.quarkLink.trim() !== '' && game.quarkLink !== '#') {
        quarkLink.style.display = 'inline-flex';
        quarkLink.removeAttribute('href'); // 移除跳转链接，不再新标签页打开
        quarkLink.onclick = function(e) {
            e.preventDefault();
            window.openQuarkQrModal(game.quarkLink);
        }
    } else {
        quarkLink.style.display = 'none';
        quarkLink.onclick = null;
    }
    
    // 控制迅雷网盘按钮的显示【迅雷保持原样，继续跳转新标签页】
    if (game.thunderLink && game.thunderLink.trim() !== '' && game.thunderLink !== '#') {
        thunderLink.style.display = 'inline-flex';
        thunderLink.href = game.thunderLink;
        thunderLink.target = "_blank";
    } else {
        thunderLink.style.display = 'none';
    }
    
    gameModal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function updatePreviewImage() {
    if (!currentGame?.previewImages?.length) return;
    const imgs = currentGame.previewImages;
    previewImage.src = imgs[currentPreviewIndex];
    imageCounter.innerText = `${currentPreviewIndex + 1}/${imgs.length}`;
    const prevDisabled = currentPreviewIndex === 0;
    const nextDisabled = currentPreviewIndex === imgs.length - 1;
    prevImageBtn.style.opacity = prevDisabled ? '0.5' : '1';
    nextImageBtn.style.opacity = nextDisabled ? '0.5' : '1';
    prevImageBtn.style.pointerEvents = prevDisabled ? 'none' : 'auto';
    nextImageBtn.style.pointerEvents = nextDisabled ? 'none' : 'auto';

    // 渲染底部缩略图预览条
    if (previewThumbnails) {
        if (imgs.length <= 1) {
            previewThumbnails.innerHTML = '';
        } else {
            previewThumbnails.innerHTML = '';
            imgs.forEach((url, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const active = idx === currentPreviewIndex;
                btn.className = `shrink-0 w-16 h-10 rounded-md overflow-hidden border-2 transition-all ${active ? 'border-neon-blue scale-105 opacity-100' : 'border-white/10 opacity-50 hover:opacity-90'}`;
                btn.innerHTML = `<img src="${escapeHtml(url)}" class="w-full h-full object-cover" loading="lazy">`;
                btn.addEventListener('click', () => {
                    currentPreviewIndex = idx;
                    updatePreviewImage();
                });
                previewThumbnails.appendChild(btn);
            });
        }
    }
}
function prevImage() { if (currentPreviewIndex > 0) { currentPreviewIndex--; updatePreviewImage(); } }
function nextImage() { if (currentGame && currentPreviewIndex < currentGame.previewImages.length - 1) { currentPreviewIndex++; updatePreviewImage(); } }
function closeGameModal() {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => gameModal.classList.add('hidden'), 300);
}
// 标签筛选（点击标签时，退出搜索模式并应用标签，仅渲染一次）
function filterByTag(tag) {
    if (isSearchMode) {
        isSearchMode = false;
        currentSearchKeyword = '';
    }
    currentTag = tag;
    applyFilterAndRender();
}
// 好评度筛选（支持与类型标签组合筛选）
function filterByRating(rating) {
    if (isSearchMode) {
        isSearchMode = false;
        currentSearchKeyword = '';
    }
    currentRating = rating;
    applyFilterAndRender();
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
// 搜索输入框的实时响应（防抖 + 自动搜索）
let searchDebounceTimer;
function setupSearchEvents() {
    if (!searchInput) return;
    
    // 输入时显示/隐藏清除按钮
    searchInput.addEventListener('input', (e) => {
        const hasValue = e.target.value.trim() !== '';
        if (searchClear) {
            if (hasValue) searchClear.classList.remove('hidden');
            else searchClear.classList.add('hidden');
        }
        
        // 防抖自动搜索
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            performSearch();
        }, 300);
    });
    
    // 搜索按钮点击
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            clearTimeout(searchDebounceTimer);
            performSearch();
        });
    }
    
    // 清除按钮
    if (searchClear) {
        searchClear.addEventListener('click', exitSearchMode);
    }
    
    // 支持回车搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchDebounceTimer);
            performSearch();
        }
    });
}
// 事件绑定
function initEvents() {
    loadMoreBtn?.addEventListener('click', loadMore);
    
    // 标签与好评度按钮事件
    tagButtons.forEach(btn => btn.addEventListener('click', () => filterByTag(btn.dataset.tag)));
    ratingButtons.forEach(btn => btn.addEventListener('click', () => filterByRating(btn.dataset.rating)));
    
    closeModalBtn?.addEventListener('click', closeGameModal);
    gameModal?.addEventListener('click', (e) => { if (e.target === gameModal || e.target.classList.contains('modal-backdrop')) closeGameModal(); });
    quarkModalOverlay?.addEventListener('click', closeQuarkQrModal);
    quarkModalBox?.addEventListener('click', (e) => e.stopPropagation());
    quarkModalCloseBtn?.addEventListener('click', closeQuarkQrModal);
    prevImageBtn?.addEventListener('click', prevImage);
    nextImageBtn?.addEventListener('click', nextImage);
    document.addEventListener('keydown', (e) => {
        if (quarkQrModal && !quarkQrModal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeQuarkQrModal();
            return;
        }
        if (!gameModal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeGameModal();
            else if (e.key === 'ArrowLeft') prevImage();
            else if (e.key === 'ArrowRight') nextImage();
        }
    });
    
    // 搜索相关事件
    setupSearchEvents();

    // 返回顶部按钮
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            const show = window.scrollY > 500;
            backToTopBtn.classList.toggle('hidden', !show);
            backToTopBtn.classList.toggle('flex', show);
        }, { passive: true });
        backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
}
// 启动
function init() {
    initEvents();
    loadGamesData();
}
init();
