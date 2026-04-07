// 游戏瀑布流、标签筛选、会员检查集成（分批次瀑布流版本）
let gamesData = [];
let filteredGames = [];
let loadedBatches = 0;          // 已加载的批次数
const gamesPerBatch = 20;       // 每批游戏数量
let currentTag = 'all';
let currentGame = null;
let currentPreviewIndex = 0;

const gamesGrid = document.getElementById('gamesGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const tagButtons = document.querySelectorAll('.tag-pill');
const gameModal = document.getElementById('gameModal');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const previewImage = document.getElementById('previewImage');
const prevImageBtn = document.getElementById('prevImage');
const nextImageBtn = document.getElementById('nextImage');
const imageCounter = document.getElementById('imageCounter');
const quarkLink = document.getElementById('quark-link');
const thunderLink = document.getElementById('thunder-link');

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
    filteredGames = [...gamesData];
    resetAndRender();
}

// 重置状态并渲染（用于初始加载、标签筛选）
function resetAndRender() {
    loadedBatches = 0;
    gamesGrid.innerHTML = '';
    loadMore(); // 加载第一批
}

// 创建一批游戏的瀑布流容器（与原来 gamesGrid 的 columns 样式完全一致）
function createBatchContainer() {
    const batchDiv = document.createElement('div');
    batchDiv.className = 'waterfall-batch';
    // 应用多列布局，与你原来的 .columns-1.md:columns-2.lg:columns-3 效果相同
    // 注意：gap 需要与原来的 gap-8 对应（2rem）
    batchDiv.style.columnCount = '1';
    batchDiv.style.gap = '2rem';
    // 响应式列数
    const updateColumns = () => {
        if (window.innerWidth >= 1024) batchDiv.style.columnCount = '3';
        else if (window.innerWidth >= 768) batchDiv.style.columnCount = '2';
        else batchDiv.style.columnCount = '1';
    };
    updateColumns();
    // 监听窗口变化，更新该容器的列数（但不会影响已生成的卡片）
    window.addEventListener('resize', updateColumns);
    return batchDiv;
}

// 将一批游戏卡片添加到指定的 batch 容器中
function addGamesToBatch(batchContainer, games) {
    games.forEach(game => {
        const card = createGameCard(game);
        batchContainer.appendChild(card);
    });
}

// 加载更多：每次加载一批（gamesPerBatch 条），创建新的瀑布流容器追加到 gamesGrid 下方
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

// 创建单个游戏卡片（完全保持原有样式）
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card bg-dark-light bg-opacity-70 rounded-xl overflow-hidden cursor-pointer';
    card.setAttribute('data-id', game.id);
    const tagsHtml = game.tags.map(tag => `<span class="inline-block px-2 py-1 text-xs rounded-full bg-primary/80 mr-1 mb-1">${escapeHtml(tag)}</span>`).join('');
    card.innerHTML = `
        <img src="${escapeHtml(game.coverImage)}" class="game-cover w-full rounded-t-xl" loading="lazy">
        <div class="p-4">
            <div class="flex flex-wrap gap-1 mb-2">${tagsHtml}</div>
            <h3 class="text-lg font-semibold text-center">${escapeHtml(game.title)}</h3>
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

// 打开游戏详情（仅会员可进入）
function openGameModal(game) {
    currentGame = game;
    currentPreviewIndex = 0;
    modalTitle.innerText = game.title;
    updatePreviewImage();
    quarkLink.href = game.quarkLink;
    thunderLink.href = game.thunderLink;
    gameModal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function updatePreviewImage() {
    if (!currentGame?.previewImages?.length) return;
    previewImage.src = currentGame.previewImages[currentPreviewIndex];
    imageCounter.innerText = `${currentPreviewIndex + 1}/${currentGame.previewImages.length}`;
    const prevDisabled = currentPreviewIndex === 0;
    const nextDisabled = currentPreviewIndex === currentGame.previewImages.length - 1;
    prevImageBtn.style.opacity = prevDisabled ? '0.5' : '1';
    nextImageBtn.style.opacity = nextDisabled ? '0.5' : '1';
    prevImageBtn.style.pointerEvents = prevDisabled ? 'none' : 'auto';
    nextImageBtn.style.pointerEvents = nextDisabled ? 'none' : 'auto';
}
function prevImage() { if (currentPreviewIndex > 0) { currentPreviewIndex--; updatePreviewImage(); } }
function nextImage() { if (currentGame && currentPreviewIndex < currentGame.previewImages.length - 1) { currentPreviewIndex++; updatePreviewImage(); } }
function closeGameModal() {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => gameModal.classList.add('hidden'), 300);
}

// 标签筛选
function filterByTag(tag) {
    currentTag = tag;
    loadedBatches = 0;
    tagButtons.forEach(btn => {
        if (btn.dataset.tag === tag) {
            btn.classList.add('bg-primary', 'active');
            btn.classList.remove('bg-dark-lighter');
        } else {
            btn.classList.remove('bg-primary', 'active');
            btn.classList.add('bg-dark-lighter');
        }
    });
    let filtered = (tag === 'all') ? [...gamesData] : gamesData.filter(g => g.tags.includes(tag));
    filtered.sort((a, b) => b.id - a.id);
    filteredGames = filtered;
    gamesGrid.innerHTML = '';
    loadMore(); // 重新从第一批开始加载
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

// 事件绑定
loadMoreBtn?.addEventListener('click', loadMore);
tagButtons.forEach(btn => btn.addEventListener('click', () => filterByTag(btn.dataset.tag)));
closeModalBtn?.addEventListener('click', closeGameModal);
gameModal?.addEventListener('click', (e) => { if (e.target === gameModal || e.target.classList.contains('modal-backdrop')) closeGameModal(); });
prevImageBtn?.addEventListener('click', prevImage);
nextImageBtn?.addEventListener('click', nextImage);
document.addEventListener('keydown', (e) => {
    if (!gameModal.classList.contains('hidden')) {
        if (e.key === 'Escape') closeGameModal();
        else if (e.key === 'ArrowLeft') prevImage();
        else if (e.key === 'ArrowRight') nextImage();
    }
});

// 启动
loadGamesData();