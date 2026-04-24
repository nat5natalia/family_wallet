const AUTH = { register:'/auth/register', login:'/auth/login', me:'/auth/me' };
const FAM = {
    waiters:'/family/family-waiters',
    createWaiter:'/family/family-waiters',
    accept:id=>`/family/family-waiters/${id}/accept`,
    reject:id=>`/family/family-waiters/${id}/reject`,
    myFamily:'/family/my',
    members: '/family/members'
};

let token = localStorage.getItem('authToken');
let user = null;
let hasFamily = localStorage.getItem('hasFamily') === 'true';
let familyMembers = [];
let tasks = [];
let goals = [];
let calDate = new Date();

// Восстановление списка семьи из localStorage
const savedFamilyMembers = localStorage.getItem('family_members_local');
if (hasFamily && savedFamilyMembers) {
    familyMembers = JSON.parse(savedFamilyMembers);
}

const roleNames = {organizer:'Организатор',member: 'Участник',spouse:'Супруг(а)',senior:'55+',teen:'Подросток',child:'Ребёнок'};
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
function openModal(id) { const m=$(`#${id}`); if(m) m.classList.remove('hidden'); refreshIcons(); }
function refreshIcons() { if(typeof lucide !== 'undefined') lucide.createIcons(); }

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
        user = await api(AUTH.me);
        
        console.log('Пользователь вошёл:', user);
        
        // ВАЖНО: Проверяем статус семьи ПОСЛЕ получения пользователя
        await checkFamilyStatus();
        
        // Применяем видимость навигации
        applyNavVisibility();
        
        // Переходим на нужную страницу
        if (hasFamily) {
            navigateTo('dashboard');
        } else {
            navigateTo('no-family');
        }
        
        showApp();
        toast('Добро пожаловать!');
        return true;
    } catch(e) { 
        const el=$('#login-error'); 
        if(el) el.textContent=e.message; 
        return false;
    }
    finally { hideLoading(); }
}

async function doRegister(username, email, pass, role) {
    showLoading();
    try {
        // Если роль не передана или не найдена, используем 'Участник'
        const userRole = (role && role !== 'undefined') ? role : 'Участник';
        await api(AUTH.register, {method:'POST', body:JSON.stringify({username, email, password: pass, role: userRole})});
        const s=$('#register-success'), e=$('#register-error');
        if(s) s.textContent='Регистрация успешна!'; if(e) e.textContent='';
        setTimeout(()=>{ switchAuthTab('login'); const l=$('#login-email'); if(l) l.value=email; },1000);
        toast('Регистрация успешна!');
        return true;
    } catch(e) { 
        const er=$('#register-error'); 
        if(er) er.textContent=e.message; 
        return false;
    }
    finally { hideLoading(); }
}

function doLogout() {
    token=null; user=null; hasFamily=false; familyMembers=[]; tasks=[]; goals=[];
    localStorage.removeItem('authToken');
    localStorage.removeItem('hasFamily');
    localStorage.removeItem('family_members_local');
    localStorage.removeItem('last_user_email');
    showAuth(); toast('Вы вышли из системы');
}

function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(t => {
        if (t.getAttribute('data-tab') === tab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    forms.forEach(form => form.classList.remove('active'));
    const activeForm = document.getElementById(`${tab}-form`);
    if (activeForm) activeForm.classList.add('active');
    
    // Очищаем ошибки
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');
    if (loginError) loginError.textContent = '';
    if (registerError) registerError.textContent = '';
    if (registerSuccess) registerSuccess.textContent = '';
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
        // Пытаемся получить из API
        const members = await api(FAM.members);
        if (members && members.length > 0) {
            familyMembers = members;
            // Сохраняем с общим ключом
            const familyId = localStorage.getItem('my_family_id') || members[0]?.email;
            if (familyId) {
                localStorage.setItem(`family_${familyId}_members`, JSON.stringify(members));
            }
        } else {
            // Берём из общего хранилища
            const familyId = localStorage.getItem('my_family_id');
            if (familyId) {
                const stored = localStorage.getItem(`family_${familyId}_members`);
                if (stored) {
                    familyMembers = JSON.parse(stored);
                } else {
                    familyMembers = [{id: user?.id, name: user?.username, email: user?.email, role: user?.role||'organizer', status:'Участник'}];
                }
            } else {
                familyMembers = [{id: user?.id, name: user?.username, email: user?.email, role: user?.role||'organizer', status:'Участник'}];
            }
        }
    } catch (e) {
        console.warn('Не удалось загрузить участников из API', e);
        const familyId = localStorage.getItem('my_family_id');
        if (familyId) {
            const stored = localStorage.getItem(`family_${familyId}_members`);
            if (stored) {
                familyMembers = JSON.parse(stored);
            } else {
                familyMembers = [{id: user?.id, name: user?.username, email: user?.email, role: user?.role||'organizer', status:'Участник'}];
            }
        } else {
            familyMembers = [{id: user?.id, name: user?.username, email: user?.email, role: user?.role||'organizer', status:'Участник'}];
        }
    }
    updateFamilyMembersCount();
    refreshUI();
}

async function checkFamilyStatus() {
    console.log('Проверка статуса семьи...');
    showLoading();
    try {
        // Сначала проверяем через API, есть ли семья
        const hasFamilyResponse = await api(FAM.hasFamily).catch(() => ({ has_family: false }));
        console.log('Ответ /has-family:', hasFamilyResponse);
        
        if (hasFamilyResponse.has_family === true) {
            hasFamily = true;
            localStorage.setItem('hasFamily', 'true');
            
            // Загружаем участников семьи
            await loadFamilyMembers();
            
            // Загружаем информацию о семье
            try {
                const fam = await api(FAM.myFamily);
                if (fam) {
                    $('#family-name-dash').textContent = fam.name || 'Моя семья';
                    $('#members-family-name').textContent = fam.name || 'Моя семья';
                    console.log('Семья загружена:', fam.name);
                }
            } catch (err) {
                console.warn('Не удалось загрузить данные семьи:', err);
            }
        } else {
            // Если по API нет семьи, проверяем принятые приглашения
            try {
                const waitersData = await api(FAM.waiters);
                const acceptedWaiters = (waitersData.waiters || []).filter(w => w.status === 'accepted');
                if (acceptedWaiters.length > 0) {
                    hasFamily = true;
                    localStorage.setItem('hasFamily', 'true');
                    await loadFamilyMembers();
                } else {
                    hasFamily = false;
                    localStorage.setItem('hasFamily', 'false');
                    familyMembers = [];
                }
            } catch (e) {
                hasFamily = false;
                localStorage.setItem('hasFamily', 'false');
                familyMembers = [];
            }
        }
    } catch (err) {
        console.error('Ошибка проверки статуса семьи:', err);
        hasFamily = false;
        localStorage.setItem('hasFamily', 'false');
    }
    hideLoading();
    console.log('Статус семьи после проверки:', hasFamily);
}

function applyNavVisibility() {
    const familyOnly = ['dashboard','members','cashback','tasks','subscriptions','calendar','junior'];
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
    const noFamilyPage = $('#no-family-section');
    if(noFamilyPage) noFamilyPage.style.display = hasFamily ? 'none' : '';
    if(!hasFamily) {
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        const profNav = $('.nav-item[data-section="profile"]');
        if(profNav) profNav.classList.add('active');
    }
}

function navigateTo(section) {
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
    if(section==='dashboard') loadDashboard();
    if(section==='members') loadMembers();
    if(section==='cashback') loadCashback();
    if(section==='tasks') renderTasks();
    if(section==='subscriptions') loadSubs();
    if(section==='calendar') renderCal();
    if(section==='junior') loadJunior();
    if(section==='profile') { refreshUI(); loadInvitations(); }
    refreshIcons();
}

function refreshUI() {
    if(!user) return;
    const el = id => $(`#${id}`);
    if(el('user-display')) el('user-display').textContent = user.username;
    if(el('prof-init')) el('prof-init').textContent = user.username[0].toUpperCase();
    if(el('prof-name')) el('prof-name').textContent = user.username;
    if(el('prof-email')) el('prof-email').textContent = user.email;
    if(el('prof-role')) el('prof-role').textContent = roleNames[user.role||'organizer'] || 'Организатор';
    if(el('prof-tier')) el('prof-tier').textContent = hasFamily ? getTierName() : '—';
    if(el('prof-family')) el('prof-family').textContent = hasFamily ? 'В семье' : 'Не подключена';
    if(el('user-tier')) el('user-tier').textContent = hasFamily ? getTierName() : '—';
}

function getTierName() {
    const n = familyMembers.filter(m => m.status === 'Участник' || m.status !== 'pending').length;
    console.log('Подсчёт участников для тарифа:', n, familyMembers);
    if (n >= 6) return 'Расширенная семья';
    if (n >= 3) return 'Семья';
    return 'Старт';
}

function updateFamilyMembersCount() {
    const n = familyMembers.filter(m=>m.status==='Участник').length;
    $('#d-members').textContent = n;
    if($('#prof-tier')) $('#prof-tier').textContent = getTierName();
    if($('#user-tier')) $('#user-tier').textContent = getTierName();
}

function loadDashboard() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const n = familyMembers.filter(m=>m.status==='Участник').length;
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

function loadMembers() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const list = $('#members-list');
    
    console.log('loadMembers - familyMembers:', familyMembers);
    console.log('Количество участников для отображения:', familyMembers.length);
    
    if(!familyMembers.length) {
        list.innerHTML='<p style="color:var(--text-muted)">Пока нет участников</p>';
        return;
    }
    list.innerHTML = familyMembers.map((m,i) => `
        <div class="member-card">
            <div class="member-avatar" style="background:${avatarColors[i%avatarColors.length]}">
                ${m.name ? m.name[0].toUpperCase() : '?'}
            </div>
            <div class="member-name">${esc(m.name || 'Без имени')}</div>
            <div class="member-email">${esc(m.email)}</div>
            <span class="member-role">${roleNames[m.role] || m.role || 'Участник'}</span>
            ${m.status === 'pending' ? '<div class="member-status">Ожидает</div>' : ''}
        </div>
    `).join('');
}

function loadCashback() {
    if(!hasFamily) { navigateTo('no-family'); return; }
    const cats = [{name:'Супермаркеты',pct:'5%'},{name:'Аптеки',pct:'5%'},{name:'Рестораны',pct:'3%'},
        {name:'Транспорт',pct:'3%'},{name:'Развлечения',pct:'2%'},{name:'Онлайн',pct:'5%'}];
    $('#cb-cats').innerHTML = cats.map(c=>`<div class="cat-card"><div class="cat-pct">${c.pct}</div><div class="cat-name">${c.name}</div></div>`).join('');
}

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
    closeModal('goal-modal');
    toast('Цель создана!');
}
function addTask(name, amount, deadline, desc) {
    tasks.push({_type:'payment',id:tasks.length+1,title:name,desc:desc||'',amount:amount||0,deadline});
    renderTasks(); loadDashboard();
    closeModal('task-modal');
    toast('Задача создана!');
}

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

// ===== ПРИГЛАШЕНИЯ =====
let testInvitations = JSON.parse(localStorage.getItem('test_invitations') || '[]');

async function loadInvitations() {
    const myInvitations = testInvitations.filter(inv => inv.email === user?.email && inv.status === 'pending');
    
    const list = $('#inv-list');
    const empty = $('#no-inv');
    
    if(!myInvitations.length) {
        if(list) list.innerHTML = '';
        if(empty) empty.style.display = 'block';
        return;
    }
    
    if(empty) empty.style.display = 'none';
    
    if(list) {
        list.innerHTML = myInvitations.map(inv => `
            <div class="waiter-card">
                <div class="waiter-header">
                    <span class="waiter-family">Семья «${inv.family_name || 'Семья'}»</span>
                    <span class="waiter-status pending">Ожидает</span>
                </div>
                <div class="waiter-details">
                    <span>Пригласил: <b>${inv.invited_by_name}</b></span>
                    <span>Отправлено: ${new Date(inv.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div class="waiter-actions">
                    <button class="btn-accept" onclick="acceptInvitation(${inv.id})">✓ Принять</button>
                    <button class="btn-reject" onclick="rejectInvitation(${inv.id})">✕ Отклонить</button>
                </div>
            </div>
        `).join('');
    }
}

window.acceptInvitation = async function(id) {
    console.log('=== acceptInvitation START ===');
    
    const invitation = testInvitations.find(inv => inv.id === id);
    if(!invitation) {
        toast('Приглашение не найдено', 'error');
        return;
    }
    
    console.log('Найдено приглашение:', invitation);
    console.log('ID семьи из приглашения:', invitation.family_id);
    
    // Обновляем статус приглашения
    invitation.status = 'accepted';
    localStorage.setItem('test_invitations', JSON.stringify(testInvitations));
    
    // Используем family_id из приглашения (это email организатора)
    const familyId = invitation.family_id || invitation.invited_by_email;
    const familyStorageKey = `family_${familyId}_members`;
    
    console.log('Используем ключ семьи:', familyStorageKey);
    
    // Загружаем существующую семью
    let currentFamilyMembers = JSON.parse(localStorage.getItem(familyStorageKey) || '[]');
    console.log('Текущий список семьи ДО:', currentFamilyMembers.map(m => m.email));
    
    // Создаём массив уникальных участников
    let updatedMembers = [...currentFamilyMembers];
    
    // Добавляем организатора (кто пригласил)
    if (invitation.invited_by_email && !updatedMembers.some(m => m.email === invitation.invited_by_email)) {
        console.log('ДОБАВЛЯЕМ организатора:', invitation.invited_by_email);
        updatedMembers.push({
            id: Date.now(),
            name: invitation.invited_by_name,
            email: invitation.invited_by_email,
            role: 'organizer',
            status: 'Участник'
        });
    }
    
    // Добавляем принявшего пользователя (текущего)
    if (user?.email && !updatedMembers.some(m => m.email === user?.email)) {
        console.log('ДОБАВЛЯЕМ принявшего пользователя:', user?.email);
        updatedMembers.push({
            id: user?.id || Date.now(),
            name: user?.username,
            email: user?.email,
            role: 'Участник',
            status: 'Участник'
        });
    }
    
    console.log('Обновлённый список семьи:', updatedMembers.map(m => m.email));
    console.log('ИТОГО участников:', updatedMembers.length);
    
    // Сохраняем в общий ключ
    localStorage.setItem(familyStorageKey, JSON.stringify(updatedMembers));
    localStorage.setItem('my_family_id', familyId);
    localStorage.setItem('hasFamily', 'true');
    localStorage.setItem('family_update_needed', Date.now().toString());
    
    toast('✅ Приглашение принято! Добро пожаловать в семью!');
    
    hasFamily = true;
    familyMembers = updatedMembers;
    updateFamilyMembersCount();
    loadMembers();
    applyNavVisibility();
    loadInvitations();
    loadDashboard();
    navigateTo('dashboard');
    
    console.log('=== acceptInvitation END ===');
};

window.rejectInvitation = function(id) {
    const invitation = testInvitations.find(inv => inv.id === id);
    if(invitation) {
        invitation.status = 'rejected';
        localStorage.setItem('test_invitations', JSON.stringify(testInvitations));
        toast('❌ Приглашение отклонено');
        loadInvitations();
    }
};

async function createWaiter(email) {
    console.log('=== createWaiter START ===');
    console.log('Приглашаемый email:', email);
    console.log('Текущий пользователь:', user?.email);
    
    if (!email || !email.includes('@')) {
        toast('Введите корректный email', 'error');
        return;
    }
    
    if (email === user?.email) {
        toast('Нельзя пригласить самого себя', 'error');
        return;
    }
    
    // Проверяем существующие приглашения
    const existing = testInvitations.find(inv => inv.email === email && inv.status === 'pending');
    if(existing) {
        toast('Приглашение уже отправлено', 'error');
        return;
    }
    
    // ВАЖНО: Определяем ID семьи - это email ОРГАНИЗАТОРА, а не текущего пользователя
    let familyId = localStorage.getItem('my_family_id');
    
    // Если у текущего пользователя нет familyId, ищем в существующих приглашениях
    if (!familyId) {
        // Ищем приглашение, которое принял текущий пользователь
        const myInvitation = testInvitations.find(inv => inv.email === user?.email && inv.status === 'accepted');
        if (myInvitation) {
            familyId = myInvitation.invited_by_email; // email организатора
        }
    }
    
    // Если всё ещё нет familyId, значит текущий пользователь - организатор
    if (!familyId) {
        familyId = user?.email; // организатор использует свой email
    }
    
    console.log('ID семьи (email организатора):', familyId);
    
    const familyStorageKey = `family_${familyId}_members`;
    
    // Загружаем существующую семью по ID организатора
    let currentFamilyMembers = JSON.parse(localStorage.getItem(familyStorageKey) || '[]');
    console.log('Текущий список семьи:', currentFamilyMembers.map(m => m.email));
    
    // Проверяем, не состоит ли уже в семье
    if (currentFamilyMembers.some(m => m.email === email)) {
        toast('Пользователь уже состоит в семье', 'error');
        return;
    }
    
    // Добавляем всех существующих участников (включая организатора, если его нет)
    if (!currentFamilyMembers.some(m => m.email === familyId)) {
        console.log('Добавляем организатора:', familyId);
        currentFamilyMembers.push({
            id: Date.now(),
            name: familyId.split('@')[0],
            email: familyId,
            role: 'organizer',
            status: 'Участник'
        });
    }
    
    // Добавляем текущего пользователя (если他不是 организатор и его нет в списке)
    if (user?.email !== familyId && !currentFamilyMembers.some(m => m.email === user?.email)) {
        console.log('Добавляем текущего пользователя:', user?.email);
        currentFamilyMembers.push({
            id: user?.id || Date.now(),
            name: user?.username,
            email: user?.email,
            role: 'Участник',
            status: 'Участник'
        });
    }
    
    console.log('Список семьи после проверки:', currentFamilyMembers.map(m => m.email));
    console.log('Всего участников:', currentFamilyMembers.length);
    
    // Сохраняем в общий ключ
    localStorage.setItem(familyStorageKey, JSON.stringify(currentFamilyMembers));
    localStorage.setItem('my_family_id', familyId);
    familyMembers = currentFamilyMembers;
    
    // Устанавливаем флаги
    hasFamily = true;
    localStorage.setItem('hasFamily', 'true');
    
    // Применяем видимость
    applyNavVisibility();
    
    // Создаём приглашение (связываем с ID семьи организатора)
    const newInvitation = {
        id: Date.now(),
        email: email,
        invited_by_name: user?.username,
        invited_by_email: user?.email,
        family_id: familyId,  // ВАЖНО: ID семьи организатора
        family_name: 'Моя семья',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    testInvitations.push(newInvitation);
    localStorage.setItem('test_invitations', JSON.stringify(testInvitations));
    
    console.log('Приглашение создано для:', email, 'в семью с ID:', familyId);
    
    toast(`✅ Приглашение отправлено на ${email}!`);
    
    // Обновляем интерфейс
    loadDashboard();
    loadMembers();
    
    const inviteForm = document.getElementById('invite-form');
    if(inviteForm) inviteForm.reset();
    
    const successEl = document.getElementById('invite-success');
    if(successEl) successEl.textContent = 'Приглашение отправлено!';
    
    setTimeout(() => {
        const inviteContainer = document.getElementById('invite-form-container');
        if(inviteContainer) inviteContainer.style.display = 'none';
        if(successEl) successEl.textContent = '';
    }, 2000);
}

// Функция для отладки - показывает текущий состав семьи
function showFamilyDebug() {
    const stored = localStorage.getItem('family_members_local');
    const members = stored ? JSON.parse(stored) : [];
    console.log('===== СОСТАВ СЕМЬИ =====');
    console.log('Всего участников:', members.length);
    members.forEach((m, i) => {
        console.log(`${i+1}. ${m.name} (${m.email}) - роль: ${m.role}`);
    });
    console.log('========================');
    return members;
}

function showInviteForm() {
    const inviteContainer = document.getElementById('invite-form-container');
    if(inviteContainer) {
        inviteContainer.style.display = 'block';
        inviteContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('invite-email')?.focus();
    } else {
        openModal('invite-member-modal');
    }
}

function focusInviteForm() {
    navigateTo('profile');
    setTimeout(() => {
        const inviteContainer = document.getElementById('invite-form-container');
        if(inviteContainer) {
            inviteContainer.style.display = 'block';
            document.getElementById('invite-email')?.focus();
        }
    }, 100);
}

// Слушаем изменения в localStorage
window.addEventListener('storage', function(e) {
    if (e.key === 'family_members_local' || e.key === 'family_update_needed') {
        const stored = localStorage.getItem('family_members_local');
        if (stored) {
            familyMembers = JSON.parse(stored);
            updateFamilyMembersCount();
            if (document.getElementById('members-section')?.classList.contains('active')) {
                loadMembers();
            }
            if (document.getElementById('dashboard-section')?.classList.contains('active')) {
                loadDashboard();
            }
            toast('Список семьи обновлён!', 'info');
        }
    }
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM загружен, инициализация приложения...');
    
    // Инициализация табов авторизации
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.removeEventListener('click', tab._listener);
        tab._listener = (e) => {
            e.preventDefault();
            const tabName = tab.getAttribute('data-tab');
            switchAuthTab(tabName);
        };
        tab.addEventListener('click', tab._listener);
    });
    
    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.removeEventListener('submit', loginForm._submit);
        loginForm._submit = async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
            await doLogin(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        };
        loginForm.addEventListener('submit', loginForm._submit);
    }

// Форма регистрации
// Форма регистрации
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.removeEventListener('submit', registerForm._submit);
    registerForm._submit = async (e) => {
        e.preventDefault();
        console.log('Форма регистрации отправлена');
        const errorEl = document.getElementById('register-error');
        if (errorEl) errorEl.textContent = '';
        
        const username = document.getElementById('reg-username')?.value;
        const email = document.getElementById('reg-email')?.value;
        const password = document.getElementById('reg-password')?.value;
        
        console.log('Данные регистрации:', { username, email, password });
        
        if (!username || !email || !password) {
            if (errorEl) errorEl.textContent = 'Заполните все поля';
            return;
        }
        
        await doRegister(username, email, password, 'Участник');
    };
    registerForm.addEventListener('submit', registerForm._submit);
}
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', logoutBtn._click);
        logoutBtn._click = () => doLogout();
        logoutBtn.addEventListener('click', logoutBtn._click);
    }
    
    // Навигация по вкладкам
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.removeEventListener('click', item._click);
        item._click = () => navigateTo(item.getAttribute('data-section'));
        item.addEventListener('click', item._click);
    });
    
    // Кнопка обновления приглашений
    const refreshInvBtn = document.getElementById('refresh-inv');
    if (refreshInvBtn) {
        refreshInvBtn.removeEventListener('click', refreshInvBtn._click);
        refreshInvBtn._click = () => loadInvitations();
        refreshInvBtn.addEventListener('click', refreshInvBtn._click);
    }
    
    // Форма приглашения в профиле
    const inviteForm = document.getElementById('invite-form');
    if (inviteForm) {
        inviteForm.removeEventListener('submit', inviteForm._submit);
        inviteForm._submit = async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('invite-error');
            const successEl = document.getElementById('invite-success');
            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';
            await createWaiter(document.getElementById('invite-email').value);
        };
        inviteForm.addEventListener('submit', inviteForm._submit);
    }
    
    // Кнопка закрытия формы приглашения
    const closeInviteBtn = document.getElementById('close-invite-form');
    if (closeInviteBtn) {
        closeInviteBtn.removeEventListener('click', closeInviteBtn._click);
        closeInviteBtn._click = () => {
            const container = document.getElementById('invite-form-container');
            if (container) container.style.display = 'none';
        };
        closeInviteBtn.addEventListener('click', closeInviteBtn._click);
    }
    
    // Фильтры задач
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.removeEventListener('click', btn._click);
        btn._click = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTasks(btn.getAttribute('data-filter'));
        };
        btn.addEventListener('click', btn._click);
    });
    
    // Форма создания цели
    const goalForm = document.getElementById('goal-form');
    if (goalForm) {
        goalForm.removeEventListener('submit', goalForm._submit);
        goalForm._submit = (e) => {
            e.preventDefault();
            addGoal(
                document.getElementById('g-name').value,
                parseFloat(document.getElementById('g-amount').value),
                document.getElementById('g-deadline').value,
                document.getElementById('g-desc').value
            );
            e.target.reset();
        };
        goalForm.addEventListener('submit', goalForm._submit);
    }
    
    // Форма создания задачи
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.removeEventListener('submit', taskForm._submit);
        taskForm._submit = (e) => {
            e.preventDefault();
            addTask(
                document.getElementById('t-name').value,
                parseFloat(document.getElementById('t-amount').value) || 0,
                document.getElementById('t-deadline').value,
                document.getElementById('t-desc').value
            );
            e.target.reset();
        };
        taskForm.addEventListener('submit', taskForm._submit);
    }
    
    // Форма задачи для юниора
    const jtaskForm = document.getElementById('jtask-form');
    if (jtaskForm) {
        jtaskForm.removeEventListener('submit', jtaskForm._submit);
        jtaskForm._submit = (e) => {
            e.preventDefault();
            jTasks.push({
                name: document.getElementById('jt-name').value,
                reward: parseInt(document.getElementById('jt-reward').value),
                deadline: document.getElementById('jt-deadline').value,
                status: 'pending'
            });
            closeModal('jtask-modal');
            loadJunior();
            toast('Задача создана!');
            e.target.reset();
        };
        jtaskForm.addEventListener('submit', jtaskForm._submit);
    }
    
    // Табы юниора
    const juniorTabs = document.querySelectorAll('.junior-tab');
    juniorTabs.forEach(tab => {
        tab.removeEventListener('click', tab._click);
        tab._click = () => {
            juniorTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.jtab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const view = document.getElementById(`${tab.getAttribute('data-jtab')}-view`);
            if (view) view.classList.add('active');
        };
        tab.addEventListener('click', tab._click);
    });
    
    // Календарь - предыдущий месяц
    const calPrev = document.getElementById('cal-prev');
    if (calPrev) {
        calPrev.removeEventListener('click', calPrev._click);
        calPrev._click = () => {
            calDate.setMonth(calDate.getMonth() - 1);
            renderCal();
        };
        calPrev.addEventListener('click', calPrev._click);
    }
    
    // Календарь - следующий месяц
    const calNext = document.getElementById('cal-next');
    if (calNext) {
        calNext.removeEventListener('click', calNext._click);
        calNext._click = () => {
            calDate.setMonth(calDate.getMonth() + 1);
            renderCal();
        };
        calNext.addEventListener('click', calNext._click);
    }
    
    // КНОПКИ ПРИГЛАШЕНИЙ
    // Кнопка на дашборде
    const dashboardInviteBtn = document.getElementById('dashboard-invite-btn');
    if (dashboardInviteBtn) {
        dashboardInviteBtn.removeEventListener('click', dashboardInviteBtn._click);
        dashboardInviteBtn._click = (e) => {
            e.preventDefault();
            showInviteForm();
        };
        dashboardInviteBtn.addEventListener('click', dashboardInviteBtn._click);
    }
    
    // Кнопка на дашборде - новая цель
    const dashboardGoalBtn = document.getElementById('dashboard-goal-btn');
    if (dashboardGoalBtn) {
        dashboardGoalBtn.removeEventListener('click', dashboardGoalBtn._click);
        dashboardGoalBtn._click = () => openGoalModal();
        dashboardGoalBtn.addEventListener('click', dashboardGoalBtn._click);
    }
    
    // Кнопка на дашборде - создать задачу
    const dashboardTaskBtn = document.getElementById('dashboard-task-btn');
    if (dashboardTaskBtn) {
        dashboardTaskBtn.removeEventListener('click', dashboardTaskBtn._click);
        dashboardTaskBtn._click = () => openTaskModal();
        dashboardTaskBtn.addEventListener('click', dashboardTaskBtn._click);
    }
    
    // Кнопка на дашборде - календарь
    const dashboardCalendarBtn = document.getElementById('dashboard-calendar-btn');
    if (dashboardCalendarBtn) {
        dashboardCalendarBtn.removeEventListener('click', dashboardCalendarBtn._click);
        dashboardCalendarBtn._click = () => navigateTo('calendar');
        dashboardCalendarBtn.addEventListener('click', dashboardCalendarBtn._click);
    }
    
    // Кнопки на странице задач
    const tasksGoalBtn = document.getElementById('tasks-goal-btn');
    if (tasksGoalBtn) {
        tasksGoalBtn.removeEventListener('click', tasksGoalBtn._click);
        tasksGoalBtn._click = () => openGoalModal();
        tasksGoalBtn.addEventListener('click', tasksGoalBtn._click);
    }
    
    const tasksTaskBtn = document.getElementById('tasks-task-btn');
    if (tasksTaskBtn) {
        tasksTaskBtn.removeEventListener('click', tasksTaskBtn._click);
        tasksTaskBtn._click = () => openTaskModal();
        tasksTaskBtn.addEventListener('click', tasksTaskBtn._click);
    }
    
    // КНОПКА "ДОБАВИТЬ УЧАСТНИКА" НА СТРАНИЦЕ УЧАСТНИКОВ
    const inviteFromMembers = document.getElementById('invite-from-members');
    if (inviteFromMembers) {
        inviteFromMembers.removeEventListener('click', inviteFromMembers._click);
        inviteFromMembers._click = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Кнопка "Добавить участника" нажата');
            showInviteForm();
        };
        inviteFromMembers.addEventListener('click', inviteFromMembers._click);
        console.log('✅ Кнопка #invite-from-members инициализирована');
    } else {
        console.warn('⚠️ Элемент #invite-from-members не найден');
    }
    
    // Кнопка "Добавить первого участника" в пустом состоянии
    const addFirstMemberBtn = document.getElementById('add-first-member-btn');
    if (addFirstMemberBtn) {
        addFirstMemberBtn.removeEventListener('click', addFirstMemberBtn._click);
        addFirstMemberBtn._click = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Кнопка "Добавить первого участника" нажата');
            showInviteForm();
        };
        addFirstMemberBtn.addEventListener('click', addFirstMemberBtn._click);
    }
    
    // Кнопка приглашения в профиле
    const showInviteFormBtn = document.getElementById('show-invite-form-btn');
    if (showInviteFormBtn) {
        showInviteFormBtn.removeEventListener('click', showInviteFormBtn._click);
        showInviteFormBtn._click = () => showInviteForm();
        showInviteFormBtn.addEventListener('click', showInviteFormBtn._click);
    }
    
    // Кнопка на странице "Нет семьи"
    const noFamilyProfileBtn = document.getElementById('no-family-profile-btn');
    if (noFamilyProfileBtn) {
        noFamilyProfileBtn.removeEventListener('click', noFamilyProfileBtn._click);
        noFamilyProfileBtn._click = () => navigateTo('profile');
        noFamilyProfileBtn.addEventListener('click', noFamilyProfileBtn._click);
    }
    
    // Кнопка добавления задачи для юниора
    const juniorAddTaskBtn = document.getElementById('junior-add-task-btn');
    if (juniorAddTaskBtn) {
        juniorAddTaskBtn.removeEventListener('click', juniorAddTaskBtn._click);
        juniorAddTaskBtn._click = () => openJTaskModal();
        juniorAddTaskBtn.addEventListener('click', juniorAddTaskBtn._click);
    }
    
    // Модальная форма приглашения
    const inviteMemberForm = document.getElementById('invite-member-form');
    if (inviteMemberForm) {
        inviteMemberForm.removeEventListener('submit', inviteMemberForm._submit);
        inviteMemberForm._submit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('invite-member-email').value;
            const errorEl = document.getElementById('invite-member-error');
            const successEl = document.getElementById('invite-member-success');
            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';
            if (!email) {
                if (errorEl) errorEl.textContent = 'Введите email';
                return;
            }
            await createWaiter(email);
            const emailInput = document.getElementById('invite-member-email');
            if (emailInput) emailInput.value = '';
            setTimeout(() => {
                closeModal('invite-member-modal');
                loadMembers();
            }, 1500);
        };
        inviteMemberForm.addEventListener('submit', inviteMemberForm._submit);
    }
    
    // Автоматический вход по токену
    if (token) {
        showLoading();
        try {
            user = await api(AUTH.me);
            await checkFamilyStatus();
            showApp();
        } catch { 
            token = null; 
            localStorage.removeItem('authToken'); 
            showAuth(); 
        }
        finally { 
            hideLoading(); 
        }
    } else { 
        showAuth(); 
    }
    
    refreshIcons();
    
    console.log('DOMContentLoaded завершён');
});

// Функция для принудительного обновления статуса семьи у организатора
function syncFamilyStatus() {
    const familyId = localStorage.getItem('my_family_id');
    if (familyId) {
        const stored = localStorage.getItem(`family_${familyId}_members`);
        if (stored) {
            const members = JSON.parse(stored);
            if (members.length > 0 && members.some(m => m.email === user?.email)) {
                hasFamily = true;
                familyMembers = members;
                updateFamilyMembersCount();
                applyNavVisibility();
                loadDashboard();
                loadMembers();
                console.log('Статус семьи синхронизирован, участников:', members.length);
            }
        }
    }
}

// Вызываем синхронизацию при загрузке страницы и при переключении вкладок
window.addEventListener('focus', function() {
    syncFamilyStatus();
});