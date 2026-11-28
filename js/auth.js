/**
 * 认证模块 - 处理用户登录、注册、密码修改、会员系统等功能
 * 修复：移除手动插入 GameTogether 表的代码，完全依赖数据库触发器自动创建用户资料
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
function openAuthModal() {
    const savedEmail = localStorage.getItem('gt_last_email');
    if (savedEmail && elements.loginEmail && !elements.loginEmail.value) elements.loginEmail.value = savedEmail;
    openModal(elements.authModal, elements.authBackdrop, elements.authModalContent);
}
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

// 忘记密码弹窗（邮箱验证码自助重置）
function openForgotPasswordModal() {
    document.getElementById('forgot-password-modal')?.remove();
    const modal = document.createElement('div'); modal.id='forgot-password-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="forgot-backdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-md p-6 text-center relative"><button id="close-forgot-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white"><i class="fa fa-times"></i></button><div class="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center"><i class="fa fa-key text-2xl text-white"></i></div><h2 class="text-xl font-bold mb-1">找回密码</h2><p class="text-xs text-gray-400 mb-4">输入注册邮箱获取验证码，直接在当前页面重置密码</p><form id="forgot-step1-form" class="space-y-3 mb-4 text-left"><input type="email" id="forgot-email" required placeholder="请输入注册时的电子邮箱" class="w-full p-3 rounded-xl bg-dark/50 border border-gray-700 text-sm text-white outline-none focus:border-neon-blue"><button type="submit" id="forgot-send-btn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-bold text-sm text-white disabled:opacity-50">发送验证码</button></form><form id="forgot-step2-form" class="space-y-3 mb-4 text-left hidden"><div class="flex items-center justify-between text-xs text-gray-400 px-1"><span>已发送至：<strong id="forgot-email-display" class="text-neon-blue"></strong></span><button type="button" id="forgot-resend-btn" class="text-neon-blue hover:underline disabled:text-gray-500">重新发送</button></div><input type="text" id="forgot-code" required inputmode="numeric" autocomplete="one-time-code" placeholder="请输入邮件中的验证码" class="w-full p-3 rounded-xl bg-dark/50 border border-gray-700 text-sm text-white tracking-widest font-mono outline-none focus:border-neon-blue"><input type="password" id="forgot-new-pwd" required minlength="6" placeholder="设置新密码（至少6位）" class="w-full p-3 rounded-xl bg-dark/50 border border-gray-700 text-sm text-white outline-none focus:border-neon-blue"><input type="password" id="forgot-confirm-pwd" required minlength="6" placeholder="确认新密码" class="w-full p-3 rounded-xl bg-dark/50 border border-gray-700 text-sm text-white outline-none focus:border-neon-blue"><button type="submit" id="forgot-verify-btn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold text-sm text-white disabled:opacity-50">验证并修改密码</button><button type="button" id="forgot-back-btn" class="w-full py-1.5 text-xs text-gray-400 hover:text-white">更换邮箱</button></form><div class="border-t border-gray-700/70 pt-4"><p class="text-gray-400 text-xs mb-2">收不到邮件？也可联系管理员协助处理</p><div class="flex items-center gap-3 bg-dark/50 rounded-lg p-2.5"><i class="fa fa-weixin text-green-500 text-xl"></i><div class="text-left"><p class="text-gray-400 text-xs">管理员微信</p><p class="text-white font-mono font-bold text-sm">GameTogether1</p></div><button type="button" id="copy-wechat" class="ml-auto px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">复制</button></div></div></div></div>`;
    document.body.appendChild(modal);

    let targetEmail = '';
    let resendTimer = null;
    const close = () => { clearInterval(resendTimer); modal.remove(); };
    const step1 = document.getElementById('forgot-step1-form');
    const step2 = document.getElementById('forgot-step2-form');
    const resendBtn = document.getElementById('forgot-resend-btn');

    const startCooldown = () => {
        let sec = 60;
        clearInterval(resendTimer);
        resendBtn.disabled = true;
        resendBtn.textContent = `${sec}s 后重发`;
        resendTimer = setInterval(() => {
            sec--;
            if (sec <= 0) { clearInterval(resendTimer); resendBtn.disabled = false; resendBtn.textContent = '重新发送'; }
            else resendBtn.textContent = `${sec}s 后重发`;
        }, 1000);
    };

    const sendCode = async (email, btn, origText) => {
        if (!supabaseClient) { showToast('系统离线，请稍后重试', 'error'); return false; }
        btn.disabled = true; btn.textContent = '发送中...';
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) {
                let msg = error.message;
                if (msg.includes('rate limit') || msg.includes('seconds')) msg = '发送过于频繁，请稍后再试';
                else if (msg.includes('Invalid email')) msg = '邮箱格式不正确';
                showToast(msg, 'error');
                return false;
            }
            showToast('验证码已发送，请查收邮箱（注意垃圾箱）', 'success');
            return true;
        } catch {
            showToast('发送失败，请稍后重试', 'error');
            return false;
        } finally {
            btn.disabled = false; btn.textContent = origText;
        }
    };

    document.getElementById('copy-wechat')?.addEventListener('click',()=>{ navigator.clipboard.writeText('GameTogether1'); showToast('已复制微信','success'); });
    document.getElementById('close-forgot-modal')?.addEventListener('click',close);
    document.getElementById('forgot-backdrop')?.addEventListener('click',close);

    step1?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim().toLowerCase();
        if (!email) { showToast('请输入注册邮箱', 'error'); return; }
        const ok = await sendCode(email, document.getElementById('forgot-send-btn'), '发送验证码');
        if (ok) {
            targetEmail = email;
            document.getElementById('forgot-email-display').textContent = email;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            startCooldown();
            document.getElementById('forgot-code')?.focus();
        }
    });

    resendBtn?.addEventListener('click', async () => {
        if (!targetEmail || resendBtn.disabled) return;
        const ok = await sendCode(targetEmail, resendBtn, '重新发送');
        if (ok) startCooldown();
    });

    document.getElementById('forgot-back-btn')?.addEventListener('click', () => {
        clearInterval(resendTimer);
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
    });

    step2?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabaseClient) { showToast('系统离线，请稍后重试', 'error'); return; }
        const token = document.getElementById('forgot-code').value.trim();
        const newPwd = document.getElementById('forgot-new-pwd').value;
        const confirmPwd = document.getElementById('forgot-confirm-pwd').value;
        if (!token) { showToast('请输入邮件中的验证码', 'error'); return; }
        if (newPwd.length < 6) { showToast('新密码至少需要6位', 'error'); return; }
        if (newPwd !== confirmPwd) { showToast('两次输入的密码不一致', 'error'); return; }

        const btn = document.getElementById('forgot-verify-btn');
        btn.disabled = true; btn.textContent = '验证中...';
        try {
            const { data, error: verifyErr } = await supabaseClient.auth.verifyOtp({
                email: targetEmail,
                token,
                type: 'recovery'
            });
            if (verifyErr) {
                let msg = verifyErr.message;
                if (msg.includes('expired') || msg.includes('invalid') || msg.includes('Token')) msg = '验证码无效或已过期，请核对或重新发送';
                showToast(msg, 'error');
                return;
            }
            const { error: updateErr } = await supabaseClient.auth.updateUser({ password: newPwd });
            if (updateErr) {
                let msg = updateErr.message;
                if (msg.includes('same as the old password')) msg = '新密码不能与旧密码相同';
                showToast('密码修改失败：' + msg, 'error');
                return;
            }
            if (data?.user) {
                currentUser = data.user;
                await fetchUserProfile();
                updateUIForLoggedInUser();
            }
            showToast('密码重置成功！已为您自动登录', 'success');
            close();
        } catch {
            showToast('重置失败，请稍后重试', 'error');
        } finally {
            btn.disabled = false; btn.textContent = '验证并修改密码';
        }
    });
}

// 会员资源弹窗
function openMemberRequiredModal() {
    const modal = document.createElement('div'); modal.id='member-required-modal'; modal.className='fixed inset-0 z-[70]';
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="member-backdrop"></div><div class="absolute inset-0 flex items-center justify-center p-4"><div class="glass-effect rounded-2xl w-full max-w-sm p-6 text-center"><button id="close-member-req" class="absolute top-4 right-4 text-gray-400"><i class="fa fa-times"></i></button><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"><i class="fa fa-crown text-2xl text-white"></i></div><h2 class="text-xl font-bold mb-2">会员专属资源</h2><p class="text-gray-400 text-sm mb-6">开通会员后全站资源无限下载</p><button id="gotoVipBtn" class="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 font-bold">开通会员</button><button id="cancelMemberReq" class="w-full mt-3 py-2 text-gray-400 text-sm">暂不开通</button></div></div>`;
    document.body.appendChild(modal);
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
            const { data: existingOrder, error: checkError } = await supabaseClient.from('GameTogether').select('id, order_id').eq('order_id', orderNo).maybeSingle();
            if(checkError) throw checkError;
            if(existingOrder){ showToast('该订单号已被使用','error'); shakeForm(modal); submitBtn.disabled=false; submitBtn.innerText='提交'; return; }
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
            const { error } = await supabaseClient.auth.updateUser({ password: pwd });
            if (error) throw error;
            if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token'))) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
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

// 检查登录状态
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
        localStorage.setItem('gt_last_email', data.user?.email || elements.loginEmail.value.trim());
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

// ========== 修复后的 handleRegister ==========
// 完全移除手动插入 GameTogether 表的代码，让数据库触发器自动处理
async function handleRegister(e){
    e.preventDefault();
    if (!supabaseClient) { showToast('系统离线','error'); return; }
    
    const email = elements.registerEmail.value.trim().toLowerCase();
    const pwd = elements.registerPassword.value;
    const confirm = elements.registerConfirmPassword.value;
    
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
    
    setButtonLoading(elements.registerSubmit, elements.registerLoading, true, '立即注册');
    
    try {
        // 只调用 Supabase 注册，不进行任何额外插入
        const { error } = await supabaseClient.auth.signUp({ 
            email: email, 
            password: pwd
        });
        
        if (error) {
            let errorMsg = error.message;
            if (errorMsg.includes('already registered')) {
                errorMsg = '该邮箱已注册，请直接登录';
                switchToLogin(); // 自动切换到登录界面
            } else if (errorMsg.includes('rate limit')) {
                errorMsg = '操作过于频繁，请稍后再试';
            } else if (errorMsg.includes('Password should be at least 6 characters')) {
                errorMsg = '密码长度至少需要6位';
            } else if (errorMsg.includes('Invalid email')) {
                errorMsg = '邮箱格式不正确，请输入有效的邮箱地址';
            }
            showToast(errorMsg, 'error');
            shakeForm(elements.registerFormElement);
            return;
        }
        
        // 注册成功（数据库触发器会自动创建 GameTogether 记录）
        showToast('注册成功！请查收验证邮件并登录', 'success');
        elements.registerFormElement.reset();
        switchToLogin(); // 自动切换到登录界面
        
    } catch(err){ 
        console.error('注册异常:', err);
        showToast('注册失败，请稍后重试', 'error'); 
        shakeForm(elements.registerFormElement);
    } finally{ 
        setButtonLoading(elements.registerSubmit, elements.registerLoading, false, '立即注册'); 
    }
}
// ========== 修复结束 ==========

// 全局下载/访问检查
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
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                if (session?.user) {
                    currentUser = session.user;
                    await fetchUserProfile();
                    updateUIForLoggedInUser();
                }
                openChangePasswordModal();
                showToast('验证通过，请设置您的新密码', 'info');
            }
        });
    }
});