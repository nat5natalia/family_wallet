const AUTH = { register:'/auth/register', login:'/auth/login', me:'/auth/me' };
const FAM = {
    waiters:'/family/family-waiters.json',
    createWaiter:'/family/family-waiters',
    accept:id=>`/family/family-waiters/${id}/accept`,
    reject:id=>`/family/family-waiters/${id}/reject`,
    myFamily:'/family/my',
    members: '/family/members'   // ← новый
};

let token = localStorage.getItem('authToken');
let user = null;
let hasFamily = false;  // Ключевой флаг
let familyMembers = [];
let tasks = [];
let goals = [];
let calDate = new Date();

const roleNames = {organizer:'Организатор',spouse:'Супруг(а)',senior:'55+',teen:'Подросток',child:'Ребёнок'};
const avatarColors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = t => { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; };

function showLoading() { const e=$('#loading'); if(e) e.classList.remove('hidden'); }
function hideLoading() { const e=$('#loading'); if(e) e.classList.add('hidden'); }
function toast(msg, type='success') {
    const t=$('#toast'); if(!t) return;
    t.textContent=msg; t.className=`toast ${type} show`;
    setTimeout(()=>t.classList.remove('show'),3000);
}
function closeModal(id) { const m=$(`#${id}`); if(m) m.classList.add('hidden'); }

async function api(url, opts={}) {
    const h = {'Content-Type':'application/json', ...opts.headers};
    if(token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(url, {...opts, headers:h});
    if(!r.ok) { const d=await r.json().catch(()=>null); throw new Error((d&&d.detail)||`Ошибка ${r.status}`); }
    return r.status===204 ? null : r.json();
}

// ===== AUTH =====
async function doLogin(email, pass) {
    showLoading();
    try {
        const d = await api(AUTH.login, {method:'POST', body:JSON.stringify({email,password:pass})});
        token = d.access_token;
        localStorage.setItem('authToken', token);
        try {
            user = await api(AUTH.me);
            await checkFamilyStatus();
            showApp();
        } catch {}
        toast('Добро пожаловать!');
        return true;
    } catch(e) { const el=$('#login-error'); if(el) el.textContent=e.message; return false; }
    finally { hideLoading(); }
}

async function doRegister(username, email, pass, role) {
    showLoading();
    try {
        await api(AUTH.register, {method:'POST', body:JSON.stringify({username,email,password:pass,role})});
        const s=$('#register-success'), e=$('#register-error');
        if(s) s.textContent='Регистрация успешна!'; if(e) e.textContent='';
        setTimeout(()=>{ switchAuthTab('login'); const l=$('#login-email'); if(l) l.value=email; },1000);
        toast('Регистрация успешна!');
        return true;
    } catch(e) { const s=$('#register-success'), er=$('#register-error'); if(er) er.textContent=e.message; if(s) s.textContent=''; return false; }
    finally { hideLoading(); }
}

function doLogout() {
    token=null; user=null; hasFamily=false; familyMembers=[]; tasks=[]; goals=[];
    localStorage.removeItem('authToken');
    showAuth(); toast('Вы вышли из системы');
}

function switchAuthTab(tab) {
    $$('.auth-tab').forEach(t=>t.classList.remove('active'));
    $$('.auth-form').forEach(f=>f.classList.remove('active'));
    const t=$(`.auth-tab[data-tab="${tab}"]`);
    const f=$(`#${tab}-form`);
    if(t) t.classList.add('active');
    if(f) f.classList.add('active');
}

function showAuth() { $('#auth-screen').classList.remove('hidden'); $('#app-screen').classList.add('hidden'); }
function showApp() {
    $('#auth-screen').classList.add('hidden');
    $('#app-screen').classList.remove('hidden');
    applyNavVisibility();
    navigateTo(hasFamily ? 'dashboard' : 'no-family');
}
async function loadFamilyMembers() {
    try {
        const members = await api(FAM.members);
        familyMembers = members;
    } catch (e) {
        console.warn('Не удалось загрузить участников', e);
        // fallback: хотя бы текущий пользователь
        familyMembers = [{
            id: user.id,
            name: user.username,
            email: user.email,
            role: user.role || 'organizer',
            status: 'member'
        }];
    }
    updateFamilyMembersCount();
    refreshUI();
}
// ===== CHECK FAMILY STATUS =====
async function checkFamilyStatus() {
    try {
        const data = await api(FAM.waiters);
        const accepted = (data.waiters||[]).filter(w => w.status === 'accepted');
        hasFamily = accepted.length > 0;
    } catch {
        hasFamily = false;
    }

    if (hasFamily) {
        await loadFamilyMembers();  // загружаем реальных участников
        try {
            const fam = await api(FAM.myFamily);
            if (fam) {
                $('#family-name-dash').textContent = fam.name;
            }
        } catch {}
    }
}

// ===== NAV VISIBILITY =====
function applyNavVisibility() {
    // Разделы, доступные только членам семьи
    const familyOnly = ['dashboard','members','cashback','tasks','subscriptions','calendar','junior'];
    // Разделы, доступные всем
    const alwaysVisible = ['profile'];

    familyOnly.forEach(id => {
        const nav = $(`.nav-item[data-section="${id}"]`);
        const page = $(`#${id}-section`);
        if(nav) nav.style.display = hasFamily ? '' : 'none';
        if(page) page.style.display = hasFamily ? '' : 'none';
    });

    alwaysVisible.forEach(id => {
        const nav = $(`.nav-item[data-section="${id}"]`);
        if(nav) nav.style.display = '';
    });

    // Показываем/скрываем заглушку "Нет семьи"
    const noFamilyPage = $('#no-family-section');
    if(noFamilyPage) noFamilyPage.style.display = hasFamily ? 'none' : '';

    // Если нет семьи — убедиться что только Профиль активен
    if(!hasFamily) {
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        const profNav = $('.nav-item[data-section="profile"]');
        if(profNav) profNav.classList.add('active');
    }
}

// ===== NAVIGATION =====
function navigateTo(section) {
    // Если нет семьи — блокируем семейные разделы
    const familyOnly = ['dashboard','members','cashback','tasks','subscriptions','calendar','junior'];
    if(familyOnly.includes(section) && !hasFamily) {
        toast('Присоединитесь к семье, чтобы получить доступ','error');
        navigateTo('profile');
        return;
    }

    $$('.nav-item').forEach(n => n.classList.remove('active'));
    $$('.page').forEach(p => p.classList.remove('active'));
    const tab = $(`.nav-item[data-section="${section}"]`);
    const page = $(`#${section}-section`);
    if(tab) tab.classList.add('active');
    if(page) page.classList.add('active');

    // Load data
    if(section==='dashboard') loadDashboard();
    if(section==='members') loadMembers();
    if(section==='cashback') loadCashback();
    if(section==='tasks') renderTasks();
    if(section==='subscriptions') loadSubs();
    if(section==='calendar') renderCal();
    if(section==='junior') loadJunior();
    if(section==='profile') { refreshUI(); loadInvitations(); }
}

// ===== UI =====
function refreshUI() {
    if(!user) return;
    const el = id => $(`#${id}`);
    if(el('user-display')) el('user-display').textContent = user.username;
    if(el('prof-init')) el('prof-init').textContent = user.username[0].toUpperCase();
    if(el('prof-name')) el('prof-name').textContent = user.username;
    if(el('prof-email')) el('prof-email').textContent = user.email;
    if(el('prof-role')) el('prof-role').textContent = roleNames[user.role||'organizer'] || 'Организатор';
    if(el('prof-tier')) el('prof-tier').textContent = hasFamily ? getTierName() : '—';
    if(el('prof-family')) el('prof-family').textContent = hasFamily ? getTierName() : 'Не подключена';
    if(el('user-tier')) el('user-tier').textContent = hasFamily ? getTierName() : '—';
}

function getTierName() {
    const n = familyMembers.filter(m=>m.status==='member').length;
    if(n>=6) return 'Расширенная семья';
    if(n>=3) return 'Семья';
    return 'Старт';
}

function updateFamilyMembersCount() {
    const n = familyMembers.filter(m=>m.status==='member').length;
    $('#d-members').textContent = n;
    if($('#prof-tier')) $('#prof-tier').textContent = getTierName();
    if($('#user-tier')) $('#user-tier').textContent = getTierName();
}

// ===== DASHBOARD =====
function loadDashboard() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const n = familyMembers.filter(m=>m.status==='member').length;
    $('#d-members').textContent = n;
    $('#d-tasks').textContent = tasks.length;
    $('#d-subs').textContent = '0';
    $('#d-cashback').textContent = '0 ₽';

    const tier = getTierName();
    $('#tier-name').textContent = tier;
    if(tier==='Старт') {
        $('#tier-desc').textContent = 'Бесплатный тариф. До 3 участников, кешбэк 5%, 1 общая цель.';
        $('#tier-fill').style.width = Math.min(n/3*100,100)+'%';
        $('#tier-next-text').textContent = `Пригласите ещё ${3-n} участников для тарифа «Семья»`;
    } else if(tier==='Семья') {
        $('#tier-desc').textContent = 'ВТБ Плюс: до 6 участников, кешбэк 7%, до 5 целей.';
        $('#tier-fill').style.width = Math.min(n/6*100,100)+'%';
        $('#tier-next-text').textContent = `Ещё ${6-n} участников для «Расширенной семьи»`;
    } else {
        $('#tier-desc').textContent = 'Премиум: до 10 участников, кешбэк 10%, без ограничений.';
        $('#tier-fill').style.width = '100%';
        $('#tier-next-text').textContent = 'Максимальный тариф!';
    }
}

// ===== MEMBERS =====
function loadMembers() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const list = $('#members-list');
    if(!familyMembers.length) {
        list.innerHTML='<p style="color:var(--text-muted)">Пока нет участников</p>';
        return;
    }
    list.innerHTML = familyMembers.map((m,i) => `
        <div class="member-card">
            <div class="member-avatar" style="background:${avatarColors[i%avatarColors.length]}">
                ${m.name[0].toUpperCase()}
            </div>
            <div class="member-name">${esc(m.name)}</div>
            <div class="member-email">${esc(m.email)}</div>
            <span class="member-role">${roleNames[m.role] || m.role}</span>
            ${m.status === 'pending' ? '<div class="member-status">Ожидает</div>' : ''}
        </div>
    `).join('');
}

// ===== CASHBACK =====
function loadCashback() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const cats = [{name:'Супермаркеты',pct:'5%'},{name:'Аптеки',pct:'5%'},{name:'Рестораны',pct:'3%'},
        {name:'Транспорт',pct:'3%'},{name:'Развлечения',pct:'2%'},{name:'Онлайн',pct:'5%'}];
    $('#cb-cats').innerHTML = cats.map(c=>`<div class="cat-card"><div class="cat-pct">${c.pct}</div><div class="cat-name">${c.name}</div></div>`).join('');
}

// ===== TASKS =====
function renderTasks(filter='all') {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const all = [...goals,...tasks];
    const filtered = filter==='all' ? all : all.filter(t=>t._type===filter);
    const list = $('#tasks-list');
    const empty = $('#no-tasks');
    if(!filtered.length) { list.innerHTML=''; if(empty) empty.style.display='block'; return; }
    if(empty) empty.style.display='none';
    list.innerHTML = filtered.map(t => {
        const pct = t.amount && t.current ? Math.round(t.current/t.amount*100) : 0;
        const tl = {goal:'Цель',payment:'Платёж',ai:'AI'}[t._type]||'';
        return `<div class="task-card ${t._type}">
            <div class="task-header"><span class="task-title">${esc(t.title)}</span><span class="task-type">${tl}</span></div>
            <div class="task-desc">${esc(t.desc||'')}</div>
            <div class="task-meta">
                ${t.amount?`<span>${t.amount.toLocaleString()} ₽</span>`:''}
                ${t.deadline?`<span>${t.deadline}</span>`:''}
                ${t.current!==undefined?`<span>${t.current}/${t.amount} ₽ (${pct}%)</span>`:''}
            </div>
            ${t.current!==undefined?`<div class="task-progress"><div class="task-progress-bar"><div class="task-progress-fill" style="width:${pct}%"></div></div></div>`:''}
        </div>`;
    }).join('');
}

function openGoalModal() { if(!hasFamily){toast('Присоединитесь к семье','error');return;} openModal('goal-modal'); }
function openTaskModal() { if(!hasFamily){toast('Присоединитесь к семье','error');return;} openModal('task-modal'); }

function addGoal(name, amount, deadline, desc) {
    goals.push({_type:'goal',id:goals.length+1,title:name,desc:desc||'',amount,current:0,deadline});
    renderTasks(); loadDashboard();
}
function addTask(name, amount, deadline, desc) {
    tasks.push({_type:'payment',id:tasks.length+1,title:name,desc:desc||'',amount:amount||0,deadline});
    renderTasks(); loadDashboard();
}

// ===== SUBS =====
function loadSubs() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const subs = [{name:'Яндекс Плюс',price:399,next:'2026-04-15',cat:'Развлечения',users:3},
        {name:'Netflix',price:1190,next:'2026-04-20',cat:'Развлечения',users:2},{name:'2ГИС Про',price:299,next:'2026-04-10',cat:'Навигация',users:1}];
    const m = subs.reduce((a,b)=>a+b.price,0);
    $('#sub-monthly').textContent = m.toLocaleString()+' ₽';
    $('#sub-yearly').textContent = (m*12).toLocaleString()+' ₽';
    const dups = subs.filter(s=>s.users>1);
    if(dups.length) { $('#subs-dups').style.display='flex'; $('#dups-text').textContent=`${dups.length} сервисов с дубликатами`; }
    $('#subs-list').innerHTML = subs.map(s=>`<div class="sub-card"><div class="sub-header"><span class="sub-name">${s.name}</span><span class="sub-price">${s.price} ₽/мес</span></div><div class="sub-meta">${s.cat} · ${s.next} · ${s.users} польз.</div></div>`).join('');
}

// ===== CALENDAR =====
function renderCal() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const y=calDate.getFullYear(),m=calDate.getMonth();
    const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    $('#cal-label').textContent=`${months[m]} ${y}`;
    const fd=new Date(y,m,1).getDay()||7, dim=new Date(y,m+1,0).getDate(), dip=new Date(y,m,0).getDate();
    const evts={5:['ЖКХ 8 500₽'],10:['Интернет 600₽','Кружок 3 000₽'],15:['Яндекс 399₽'],20:['Netflix 1 190₽'],25:['Страховка 2 400₽']};
    let h=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-day-header">${d}</div>`).join('');
    for(let i=fd-1;i>0;i--) h+=`<div class="cal-day other"><div class="dn">${dip-i+1}</div></div>`;
    for(let d=1;d<=dim;d++){const e=evts[d]||[];h+=`<div class="cal-day"><div class="dn">${d}</div>${e.map(x=>`<div class="cal-event">${x}</div>`).join('')}</div>`;}
    const total=fd-1+dim,rem=(7-total%7)%7;
    for(let i=1;i<=rem;i++) h+=`<div class="cal-day other"><div class="dn">${i}</div></div>`;
    $('#cal-grid').innerHTML=h;
    const up=[{d:'10 апр',t:'ЖКХ — 8 500 ₽'},{d:'10 апр',t:'Кружок — 3 000 ₽'},{d:'15 апр',t:'Яндекс Плюс — 399 ₽'},{d:'20 апр',t:'Netflix — 1 190 ₽'}];
    $('#upcoming').innerHTML=up.map(u=>`<div class="upcoming-item"><span>${u.t}</span><span style="color:var(--text-muted)">${u.d}</span></div>`).join('');
}

// ===== JUNIOR =====
const jQuests=[{num:1,name:'Что такое деньги?',desc:'Комикс',reward:'+100 ₽'},{num:2,name:'Сила процентов',desc:'Симулятор вкладов',reward:'Мини-вклад'},{num:3,name:'Хочу vs Нужно',desc:'Сортировка',reward:'Анализ AI'},{num:4,name:'Как работают банки?',desc:'Анимация',reward:'Кешбэк +0.5%'},{num:5,name:'Первый бюджет',desc:'5 000 ₽ на месяц',reward:'Бонус 200 ₽'}];
const jLevels=[{n:1,name:'Новичок',cond:'Карта + 1 покупка',reward:'Базовый'},{n:2,name:'Копилка',cond:'Накопить 1 000 ₽',reward:'Лимит 1 500 ₽'},{n:3,name:'Инвестор',cond:'10 задач + 2 квеста',reward:'Кешбэк 1%'},{n:4,name:'Финансист',cond:'10 000 ₽',reward:'Категория кешбэка'},{n:5,name:'Эксперт',cond:'Все квесты',reward:'Бонус 500 ₽'}];
let jTasks=[{name:'Убраться в комнате',reward:50,deadline:'2026-04-10',status:'pending'},{name:'Прочитать книгу',reward:150,deadline:'2026-04-15',status:'completed'}];
let jReqs=[{child:'Саша',amount:500,reason:'Кроссовки',status:'pending',date:'2026-04-08'}];

function loadJunior() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    $('#jt-list').innerHTML=jTasks.map(t=>`<div class="jtask-card"><div><div style="font-weight:600">${esc(t.name)}</div><div style="font-size:13px;color:var(--success);font-weight:600">+${t.reward} ₽</div></div><span class="task-type">${t.status==='completed'?'Выполнено':'Ожидает'}</span></div>`).join('');
    $('#jq-list').innerHTML=jQuests.map(q=>`<div class="quest-card"><div class="qn">${q.num}</div><div style="font-weight:600;margin:8px 0">${esc(q.name)}</div><div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">${esc(q.desc)}</div><div class="qr">${q.reward}</div></div>`).join('');
    const cur=2;
    $('#jl-list').innerHTML=jLevels.map(l=>`<div class="level-item ${l.n===cur?'cur':''} ${l.n<cur?'done':''}"><div class="level-num">${l.n}</div><div style="flex:1"><div style="font-weight:600">${esc(l.name)}</div><div style="font-size:12px;color:var(--text-muted)">${esc(l.cond)}</div><div style="font-size:12px;color:var(--success);font-weight:600">${esc(l.reward)}</div></div></div>`).join('');
    $('#jr-list').innerHTML=jReqs.map(r=>`<div class="jrequest-card"><div><div style="font-weight:600">${esc(r.child)} просит ${r.amount} ₽</div><div style="font-size:13px;color:var(--text-muted)">${esc(r.reason)} · ${r.date}</div></div>${r.status==='pending'?`<div style="display:flex;gap:6px"><button class="btn-accept" onclick="this.parentElement.innerHTML='<span style=color:var(--success)>Одобрено</span>';toast('Одобрено')">Одобрить</button><button class="btn-reject" onclick="this.parentElement.innerHTML='<span style=color:var(--error)>Отказано</span>';toast('Отказ','error')">Отказ</button></div>`:''}</div>`).join('');
}
function openJTaskModal() { if(!hasFamily){toast('Присоединитесь к семье','error');return;} openModal('jtask-modal'); }

// ===== INVITATIONS =====
async function loadInvitations() {
    showLoading();
    try {
        const data = await api(FAM.waiters);
        const waiters = data.waiters || [];
        const list = $('#inv-list');
        const empty = $('#no-inv');
        if(!waiters.length) { list.innerHTML=''; if(empty) empty.style.display='block'; return; }
        if(empty) empty.style.display='none';
        list.innerHTML = waiters.map(w=>`
            <div class="waiter-card">
                <div class="waiter-header"><span class="waiter-family">Семья «${esc(w.invited_by_name||'Семья')}»</span><span class="waiter-status ${w.status}">${translateStatus(w.status)}</span></div>
                <div class="waiter-details"><span>Пригласил: <b>${esc(w.invited_by_name||'#'+w.invited_by)}</b></span><span>Отправлено: ${new Date(w.created_at).toLocaleString('ru-RU')}</span></div>
                ${w.status==='pending'?`<div class="waiter-actions"><button class="btn-accept" onclick="doAccept(${w.id})">✓ Принять</button><button class="btn-reject" onclick="doReject(${w.id})">✕ Отклонить</button></div>`:''}
            </div>
        `).join('');
    } catch {} finally { hideLoading(); }
}

function translateStatus(s) { return {pending:'Ожидает',accepted:'Принято',rejected:'Отклонено'}[s]||s; }

async function doAccept(id) {
    try {
        await api(FAM.accept(id), {method:'POST'});
        toast('Приглашение принято!');
        hasFamily = true;
        await loadFamilyMembers();      // загружаем реальный список
        applyNavVisibility();
        loadInvitations();
        navigateTo('dashboard');
    } catch(e) { toast(e.message,'error'); }
}

async function doReject(id) {
    try {
        await api(FAM.reject(id), {method:'POST'});
        toast('Отклонено','error');
        loadInvitations();
    } catch(e) { toast(e.message,'error'); }
}

async function createWaiter(email) {
    showLoading();
    try {
        await api(FAM.createWaiter, {method:'POST', body:JSON.stringify({email})});
        const s=$('#invite-success'), e=$('#invite-error');
        if(s) s.textContent='Приглашение отправлено!'; if(e) e.textContent='';
        toast('Приглашение создано');
        // НЕ добавляем участника в familyMembers – он появится только после принятия
        const f=$('#invite-form'); if(f) f.reset();
    } catch(err) {
        const s=$('#invite-success'), e=$('#invite-error');
        if(e) e.textContent=err.message; if(s) s.textContent='';
        toast('Ошибка: '+err.message,'error');
    } finally { hideLoading(); }
}
function focusInviteForm() {
    navigateTo('profile');
    setTimeout(() => {
        const input = $('#invite-email');
        if (input) input.focus();
    }, 100);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    $$('.auth-tab').forEach(t=>t.addEventListener('click',()=>{switchAuthTab(t.dataset.tab);['#login-error','#register-error','#register-success'].forEach(s=>{const e=$(s);if(e)e.textContent='';})}));
    $('#login-form')?.addEventListener('submit',async e=>{e.preventDefault();$('#login-error').textContent='';await doLogin($('#login-email').value,$('#login-password').value)});
    $('#register-form')?.addEventListener('submit',async e=>{e.preventDefault();$('#register-error').textContent='';await doRegister($('#reg-username').value,$('#reg-email').value,$('#reg-password').value,$('#reg-role').value)});
    $('#logout-btn')?.addEventListener('click',doLogout);
    $$('.nav-item').forEach(n=>n.addEventListener('click',()=>navigateTo(n.dataset.section)));
    $('#refresh-inv')?.addEventListener('click',loadInvitations);
    const inviteForm=$('#invite-form');
    if(inviteForm) inviteForm.addEventListener('submit',async e=>{e.preventDefault();$('#invite-error').textContent='';$('#invite-success').textContent='';await createWaiter($('#invite-email').value)});
    $$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{$$('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTasks(b.dataset.filter)}));
    $('#goal-form')?.addEventListener('submit',e=>{e.preventDefault();addGoal($('#g-name').value,parseFloat($('#g-amount').value),$('#g-deadline').value,$('#g-desc').value);closeModal('goal-modal');toast('Цель создана!');e.target.reset()});
    $('#task-form')?.addEventListener('submit',e=>{e.preventDefault();addTask($('#t-name').value,parseFloat($('#t-amount').value)||0,$('#t-deadline').value,$('#t-desc').value);closeModal('task-modal');toast('Задача создана!');e.target.reset()});
    $('#jtask-form')?.addEventListener('submit',e=>{e.preventDefault();jTasks.push({name:$('#jt-name').value,reward:parseInt($('#jt-reward').value),deadline:$('#jt-deadline').value,status:'pending'});closeModal('jtask-modal');loadJunior();toast('Задача создана!');e.target.reset()});
    $$('.junior-tab').forEach(t=>t.addEventListener('click',()=>{$$('.junior-tab').forEach(x=>x.classList.remove('active'));$('.jtab-content').forEach(x=>x.classList.remove('active'));t.classList.add('active');const v=$(`#${t.dataset.jtab}-view`);if(v)v.classList.add('active')}));
    $('#cal-prev')?.addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()-1);renderCal()});
    $('#cal-next')?.addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()+1);renderCal()});

    // Auto-login
    if(token) {
        showLoading();
        try {
            user = await api(AUTH.me);
            await checkFamilyStatus();
            showApp();
        } catch { token=null; localStorage.removeItem('authToken'); showAuth(); }
        finally { hideLoading(); }
    } else { showAuth(); }
});
