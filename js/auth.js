/**
 * 认证模块 - 处理用户登录、注册、密码修改、会员系统等功能
 * 已修复自动登录问题：登录后刷新自动保持登录，退出后才清除会话
 * 已修复注册误报问题：移除不可靠的邮箱预检查，让 Supabase 直接返回正确错误
 */

const SUPABASE_URL = 'https://szeedpcuharbupkjrnob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6ZWVkcGN1aGFyYnVwa2pybm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTY3MDAsImV4cCI6MjA4ODEzMjcwMH0.7Qhchq8-NJG_Yqpx40r2idwt9iN98Hg63cHWIZ8lMTY';

let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase 初始化成功');
} catch(e) { console.error('Supabase 初始化失败:', e); }

// 全局状态
let currentUser = null;
let currentUserProfile = null;

// DOM 元素
const elements = {
    authSection: document.getElementById('auth-section'),
    authModal: document.getElementById('auth-modal'),
    authBackdrop: document.getElementById('auth-backdrop'),
    authModalContent: document.getElementById('auth-modal-content'),
    closeAuthModal: document.getElementById('close-auth-modal'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    formToggleText: document.getElementById('form-toggle-text'),
    loginFormElement: document.getElementById('login-form-element'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginSubmit: document.getElementById('login-submit'),
    loginLoading: document.getElementById('login-loading'),
    registerFormElement: document.getElementById('register-form-element'),
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    registerConfirmPassword: document.getElementById('register-confirm-password'),
    registerSubmit: document.getElementById('register-submit'),
    registerLoading: document.getElementById('register-loading'),
    toastContainer: document.getElementById('toast-container')
};

// 工具函数
function showToast(msg, type='success') {
    const colors = { success:'border-green-500/50 bg-green-500/10 text-green-400', error:'border-red-500/50 bg-red-500/10 text-red-400', warning:'border-yellow-500/50 bg-yellow-500/10 text-yellow-400', info:'border-blue-500/50 bg-blue-500/10 text-blue-400' };
    const icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-md transform translate-x-full transition-all duration-300 shadow-lg`;
    toast.innerHTML = `<i class="fa ${icons[type]} text-lg"></i><span class="text-sm font-medium">${msg}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full'), 10);
    setTimeout(() => { toast.classList.add('translate-x-full','opacity-0'); setTimeout(()=>toast.remove(),300); }, 3000);
}

function setButtonLoading(btn, loader, isLoading, origText) {
    const span = btn.querySelector('span');
    btn.disabled = isLoading;
    if(isLoading) { loader.classList.remove('hidden'); if(span) span.textContent='处理中...'; }
    else { loader.classList.add('hidden'); if(span) span.textContent=origText; }
}
function shakeForm(el) { el.classList.add('shake-animation'); setTimeout(()=>el.classList.remove('shake-animation'),500); }
function getTodayDateString() { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; }
function getCurrentTimestamp() { return new Date().toISOString(); }

// 强制清除所有 Supabase 存储（仅在主动退出时使用）
function forceClearSession() { 
    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
    sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
    // 清除所有可能包含 supabase 的键
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    currentUser = null; 
    currentUserProfile = null; 
    updateUIForLoggedOutUser(); 
}

// 弹窗控制
function openModal(modal, backdrop, content) {
    modal.classList.remove('hidden');
    setTimeout(() => { backdrop.classList.remove('opacity-0'); content.classList.remove('scale-95','opacity-0'); content.classList.add('scale-100','opacity-100'); },10);
}
function closeModal(modal, backdrop, content, callback) {
    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100','opacity-100'); content.classList.add('scale-95','opacity-0');
    setTimeout(() => { modal.classList.add('hidden'); if(callback) callback(); },300);
}
function openAuthModal() { openModal(elements.authModal, elements.authBackdrop, elements.authModalContent); }
function closeAuthModal() { closeModal(elements.authModal, elements.authBackdrop, elements.authModalContent, ()=>{ elements.loginFormElement.reset(); elements.registerFormElement.reset(); switchToLogin(); }); }
function switchToLogin() {
    elements.tabLogin.classList.add('tab-active'); elements.tabLogin.classList.remove('text-gray-400');
    elements.tabRegister.classList.remove('tab-active'); elements.tabRegister.classList.add('text-gray-400');
    elements.loginForm.classList.remove('hidden'); elements.registerForm.classList.add('hidden');
    elements.formToggleText.innerHTML = '还没有账号？ <button type="button" id="show-register" class="text-neon-blue hover:underline">立即注册</button>';
    document.getElementById('show-register')?.addEventListener('click',switchToRegister);
}
function switchToRegister() {
    elements.tabRegister.classList.add('tab-active'); elements.tabRegister.classList.remove('text-gray-400');
    elements.tabLogin.classList.remove('tab-active'); elements.tabLogin.classList.add('text-gray-400');
    elements.registerForm.classList.remove('hidden'); elements.loginForm.classList.add('hidden');
    elements.formToggleText.innerHTML = '已有账号？ <button type="button" id="show-login" class="text-neon-purple hover:underline">立即登录</button>';
    document.getElementById('show-login')?.addEventListener('click',switchToLogin);
}

// 忘记密码弹窗
function openForgotPasswordModal() {
    const modal = document.createElement('div'); modal.id='forgot-password-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="forgot-backdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-md p-6 text-center"><button id="close-forgot-modal" class="absolute top-4 right-4 text-gray-400"><i class="fa fa-times"></i></button><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"><i class="fa fa-exclamation-triangle text-2xl text-white"></i></div><h2 class="text-xl font-bold mb-2">账号安全提醒</h2><div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6"><p class="text-yellow-200 mb-2">您的账号可能存在密码风险</p><div class="flex items-center gap-3 bg-dark/50 rounded-lg p-3"><i class="fa fa-weixin text-green-500 text-2xl"></i><div><p class="text-gray-400 text-xs">管理员微信</p><p class="text-white font-mono font-bold">GameTogether1</p></div><button id="copy-wechat" class="ml-auto px-3 py-1 bg-green-600 rounded text-xs">复制</button></div></div><button id="close-forgot-btn" class="w-full py-3 rounded-xl bg-gray-700">我知道了</button></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{ document.getElementById('forgot-backdrop').classList.remove('opacity-0'); },10);
    document.getElementById('copy-wechat')?.addEventListener('click',()=>{ navigator.clipboard.writeText('GameTogether1'); showToast('已复制微信','success'); });
    const close=()=>modal.remove();
    document.getElementById('close-forgot-modal')?.addEventListener('click',close);
    document.getElementById('close-forgot-btn')?.addEventListener('click',close);
    document.getElementById('forgot-backdrop')?.addEventListener('click',close);
}

// 会员资源弹窗
function openMemberRequiredModal() {
    const modal = document.createElement('div'); modal.id='member-required-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="member-backdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-sm p-6 text-center"><button id="close-member-req" class="absolute top-4 right-4 text-gray-400"><i class="fa fa-times"></i></button><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"><i class="fa fa-crown text-2xl text-white"></i></div><h2 class="text-xl font-bold mb-2">会员专属资源</h2><p class="text-gray-400 text-sm mb-6">开通会员后全站资源无限下载</p><button id="gotoVipBtn" class="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 font-bold">开通会员</button><button id="cancelMemberReq" class="w-full mt-3 py-2 text-gray-400 text-sm">暂不开通</button></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{ document.getElementById('member-backdrop').classList.remove('opacity-0'); },10);
    const close=()=>modal.remove();
    document.getElementById('close-member-req')?.addEventListener('click',close);
    document.getElementById('cancelMemberReq')?.addEventListener('click',close);
    document.getElementById('member-backdrop')?.addEventListener('click',close);
    document.getElementById('gotoVipBtn')?.addEventListener('click',()=>{ close(); openVIPModal(); });
}

// VIP开通弹窗
function openVIPModal() {
    const modal = document.createElement('div'); modal.id='vip-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="vip-backdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row"><button id="closeVip" class="absolute top-4 right-4 z-10 text-gray-400"><i class="fa fa-times"></i></button><div class="p-8 md:w-1/2"><h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">开通会员</h2><div class="space-y-3 text-gray-300"><p>打赏一次，终身免费！</p><p>全站资源，无限下载！</p><div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"><p class="text-yellow-300 font-bold">微信扫码支付</p></div></div><button id="paidBtn" class="mt-8 w-full py-3 rounded-xl bg-green-600 font-bold">我已支付</button></div><div class="md:w-1/2 bg-dark/50 p-6 flex justify-center"><img src="https://pub-1f2ba50106ed4026bd217cd777924d22.r2.dev/QR.png" alt="收款码" class="rounded-xl shadow-xl max-w-full"></div></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{ document.getElementById('vip-backdrop').classList.remove('opacity-0'); },10);
    const close=()=>modal.remove();
    document.getElementById('closeVip')?.addEventListener('click',close);
    document.getElementById('vip-backdrop')?.addEventListener('click',close);
    document.getElementById('paidBtn')?.addEventListener('click',()=>{ close(); openOrderInputModal(); });
}

// 订单输入验证弹窗
function openOrderInputModal() {
    const modal = document.createElement('div'); modal.id='order-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="orderBackdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-md p-6 text-center"><h2 class="text-xl font-bold mb-4">输入微信支付订单号</h2><input type="text" id="orderNumber" maxlength="32" class="w-full bg-transparent border-b border-gray-600 text-center text-2xl tracking-widest text-white focus:outline-none font-mono" placeholder=""><div class="flex justify-between mt-3 px-1" id="orderDots">${Array(32).fill().map((_,i)=>`<div class="w-1.5 h-1.5 rounded-full bg-gray-700" data-idx="${i}"></div>`).join('')}</div><p class="text-gray-500 text-xs mt-2"><span id="orderLen">0</span>/32</p><div class="flex gap-3 mt-6"><button id="cancelOrder" class="flex-1 py-2 rounded bg-gray-700">返回</button><button id="submitOrder" class="flex-1 py-2 rounded bg-green-600 font-bold" disabled>提交</button></div></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{ document.getElementById('orderBackdrop').classList.remove('opacity-0'); },10);
    const input = document.getElementById('orderNumber');
    const dots = document.querySelectorAll('#orderDots div');
    const lenSpan = document.getElementById('orderLen');
    const submitBtn = document.getElementById('submitOrder');
    input.addEventListener('input',(e)=>{
        let val = e.target.value.replace(/\D/g,'');
        input.value = val;
        lenSpan.innerText = val.length;
        dots.forEach((dot,i)=>{ if(i<val.length) dot.classList.replace('bg-gray-700','bg-green-500'); else dot.classList.replace('bg-green-500','bg-gray-700'); });
        submitBtn.disabled = val.length !== 32;
    });
    const closeModal = () => modal.remove();
    document.getElementById('cancelOrder').addEventListener('click',closeModal);
    document.getElementById('orderBackdrop').addEventListener('click',closeModal);
    submitBtn.addEventListener('click',async()=>{
        const orderNo = input.value;
        const datePart = orderNo.substring(10,18);
        if(datePart !== getTodayDateString()){ showToast('订单号无效,请检查后重新输入','error'); shakeForm(modal); return; }
        submitBtn.disabled=true; submitBtn.innerText='验证中...';
        try {
            const { error } = await supabaseClient.from('GameTogether').update({ is_member: true, order_id: orderNo }).eq('id', currentUser.id);
            if(error) throw error;
            currentUserProfile.is_member = true;
            showToast('会员开通成功！','success');
            closeModal();
            updateUIForLoggedInUser();
        } catch(e){ showToast('验证失败:'+e.message,'error'); submitBtn.disabled=false; submitBtn.innerText='提交'; }
    });
}

// 修改密码弹窗
function openChangePasswordModal() {
    const modal = document.createElement('div'); modal.id='changePwdModal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="pwdBackdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-md p-6"><h2 class="text-2xl font-bold text-center mb-4">修改密码</h2><form id="changePwdForm"><input type="password" id="newPwd" placeholder="新密码(至少6位)" class="w-full mb-3 p-3 rounded bg-dark/50 border border-gray-700"><input type="password" id="confirmPwd" placeholder="确认新密码" class="w-full mb-4 p-3 rounded bg-dark/50 border border-gray-700"><button type="submit" class="w-full py-3 rounded bg-primary font-bold">确认修改</button></form><button id="closePwdModal" class="absolute top-4 right-4 text-gray-400"><i class="fa fa-times"></i></button></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{ document.getElementById('pwdBackdrop').classList.remove('opacity-0'); },10);
    const close=()=>modal.remove();
    document.getElementById('closePwdModal')?.addEventListener('click',close);
    document.getElementById('pwdBackdrop')?.addEventListener('click',close);
    document.getElementById('changePwdForm').addEventListener('submit',async(e)=>{
        e.preventDefault();
        const pwd = document.getElementById('newPwd').value;
        const cpwd = document.getElementById('confirmPwd').value;
        if(pwd !== cpwd){ showToast('两次密码不一致','error'); return; }
        if(pwd.length<6){ showToast('密码至少6位','error'); return; }
        try {
            await supabaseClient.auth.updateUser({ password: pwd });
            showToast('密码修改成功','success');
            close();
        } catch(err){ showToast('修改失败:'+err.message,'error'); }
    });
}

// UI 更新
function updateUIForLoggedInUser() {
    const email = currentUser.email;
    const name = email.split('@')[0];
    const isMember = currentUserProfile?.is_member;
    elements.authSection.innerHTML = `<div class="relative group"><button id="userMenuBtn" class="flex items-center gap-2 bg-dark-light border border-gray-700 rounded-full pl-2 pr-4 py-1.5"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold">${name.charAt(0).toUpperCase()}</div><span class="text-white text-sm">${name}</span>${isMember?'<i class="fa fa-crown text-yellow-400"></i>':''}<i class="fa fa-chevron-down text-gray-400 text-xs"></i></button><div class="absolute right-0 mt-2 w-48 rounded-xl glass-effect border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"><div class="py-2"><button id="changePwdBtn" class="w-full text-left px-4 py-2 text-sm hover:bg-white/5"><i class="fa fa-key mr-2"></i>修改密码</button>${!isMember?'<button id="vipOpenBtn" class="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10"><i class="fa fa-crown mr-2"></i>开通会员</button>':''}<div class="border-t border-gray-700 my-1"></div><button id="logoutBtn" class="w-full text-left px-4 py-2 text-sm text-red-400"><i class="fa fa-sign-out mr-2"></i>退出登录</button></div></div></div>`;
    document.getElementById('changePwdBtn')?.addEventListener('click', openChangePasswordModal);
    if (!isMember) document.getElementById('vipOpenBtn')?.addEventListener('click', openVIPModal);
    document.getElementById('logoutBtn')?.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        currentUser = null; 
        currentUserProfile = null; 
        updateUIForLoggedOutUser(); 
        showToast('已退出登录', 'info');
    });
}
function updateUIForLoggedOutUser() {
    elements.authSection.innerHTML = `<button id="login-btn" class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-6 rounded-full transition-all flex items-center btn-shine"><i class="fa fa-user-circle mr-2"></i> 登录</button>`;
    document.getElementById('login-btn')?.addEventListener('click', openAuthModal);
}

// 认证逻辑
async function fetchUserProfile() {
    if (!currentUser || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('GameTogether').select('*').eq('id', currentUser.id).single();
        if (!error && data) currentUserProfile = data;
        else currentUserProfile = { is_member: false };
    } catch(e) { currentUserProfile = { is_member: false }; }
}

// 检查登录状态（自动恢复会话，不清除存储）
async function checkAuthStatus() {
    if (!supabaseClient) { updateUIForLoggedOutUser(); return; }
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) {
        currentUser = null;
        currentUserProfile = null;
        updateUIForLoggedOutUser();
        return;
    }
    currentUser = session.user;
    await fetchUserProfile();
    updateUIForLoggedInUser();
}

async function handleLogin(e){
    e.preventDefault();
    if (!supabaseClient) { showToast('系统离线','error'); return; }
    setButtonLoading(elements.loginSubmit, elements.loginLoading, true, '登录');
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email:elements.loginEmail.value, password:elements.loginPassword.value });
        if(error) throw error;
        currentUser = data.user; await fetchUserProfile();
        showToast('登录成功','success'); updateUIForLoggedInUser(); closeAuthModal();
    } catch(err){ 
        let errorMsg = err.message;
        if (errorMsg.includes('Invalid login credentials')) {
            errorMsg = '邮箱或密码错误';
        } else if (errorMsg.includes('Email not confirmed')) {
            errorMsg = '请先验证邮箱后再登录';
        }
        showToast(errorMsg, 'error'); 
        shakeForm(elements.loginFormElement); 
    }
    finally{ setButtonLoading(elements.loginSubmit, elements.loginLoading, false, '登录'); }
}

async function handleRegister(e){
    e.preventDefault();
    if (!supabaseClient) { showToast('系统离线','error'); return; }
    
    const email = elements.registerEmail.value.trim().toLowerCase();
    const pwd = elements.registerPassword.value;
    const confirm = elements.registerConfirmPassword.value;
    
    // 前端验证
    if(pwd !== confirm){ 
        showToast('两次密码不一致','error'); 
        shakeForm(elements.registerFormElement); 
        return; 
    }
    if(pwd.length < 6){ 
        showToast('密码至少需要6位','error'); 
        shakeForm(elements.registerFormElement);
        return; 
    }
    if(!email){ 
        showToast('请输入邮箱地址','error'); 
        return; 
    }
    
    setButtonLoading(elements.registerSubmit, elements.registerLoading, true, '注册');
    
    try {
        // 直接调用 Supabase 注册，让它返回正确的错误信息
        const { data, error } = await supabaseClient.auth.signUp({ 
            email: email, 
            password: pwd
        });
        
        // 处理注册错误
        if(error) {
            let errorMsg = error.message;
            
            // 用户友好的错误提示
            if (errorMsg.includes('User already registered')) {
                errorMsg = '该邮箱已被注册，请直接登录';
            } else if (errorMsg.includes('Password should be at least 6 characters')) {
                errorMsg = '密码长度至少需要6位';
            } else if (errorMsg.includes('Invalid email')) {
                errorMsg = '邮箱格式不正确，请输入有效的邮箱地址';
            } else if (errorMsg.includes('rate limit')) {
                errorMsg = '操作过于频繁，请稍后再试';
            }
            
            showToast(errorMsg, 'error');
            shakeForm(elements.registerFormElement);
            return;
        }
        
        // 注册成功，检查是否需要邮箱验证
        if (data.user) {
            // 创建用户资料记录
            try {
                await supabaseClient.from('GameTogether').insert([{ 
                    id: data.user.id, 
                    email: email, 
                    is_member: false, 
                    created_at: getCurrentTimestamp() 
                }]);
            } catch (dbError) {
                // 如果资料表插入失败，不影响注册流程（可能是重复插入）
                console.warn('创建用户资料失败:', dbError);
            }
            
            showToast('注册成功！请查收验证邮件并登录', 'success');
            elements.registerFormElement.reset();
            switchToLogin();
        } else {
            // 理论上不应该走到这里
            showToast('注册成功，请登录', 'success');
            switchToLogin();
        }
        
    } catch(err){ 
        console.error('注册异常:', err);
        showToast('注册失败，请稍后重试', 'error'); 
        shakeForm(elements.registerFormElement);
    } finally{ 
        setButtonLoading(elements.registerSubmit, elements.registerLoading, false, '注册'); 
    }
}

// 全局下载/访问检查（供 main.js 调用）
window.checkMemberAndAccess = function() {
    if(!currentUser){ showToast('请先登录','warning'); openAuthModal(); return false; }
    if(!currentUserProfile?.is_member){ openMemberRequiredModal(); return false; }
    return true;
};

// 事件初始化
function initAuthEvents() {
    elements.closeAuthModal?.addEventListener('click',closeAuthModal);
    elements.authBackdrop?.addEventListener('click',closeAuthModal);
    elements.tabLogin?.addEventListener('click',switchToLogin);
    elements.tabRegister?.addEventListener('click',switchToRegister);
    elements.loginFormElement?.addEventListener('submit',handleLogin);
    elements.registerFormElement?.addEventListener('submit',handleRegister);
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) forgotLink.addEventListener('click',(e)=>{ e.preventDefault(); openForgotPasswordModal(); });
    switchToLogin();
}
document.addEventListener('DOMContentLoaded',()=>{ 
    initAuthEvents(); 
    checkAuthStatus(); 
});
