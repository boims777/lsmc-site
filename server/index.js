const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// --- НАСТРОЙКИ DISCORD ---
const CLIENT_ID = '1563879760843505664'; 
const CLIENT_SECRET = '7HxG9VQHJFptlnU5OTY17XFKscAY6Zhz'; 
const REDIRECT_URI = 'https://cold-crematorium-xr5vpx5jrv5j36j99-3000.app.github.dev/auth/discord/callback';
const GUILD_ID = '1176546172240928808'; 

// ⚠️ ВСТАВЬ СВОЙ ТОКЕН СЮДА
const BOT_TOKEN = process.env.BOT_TOKEN || 'MTU2Mzg3OTc2MDg0MzUwNTY2NA.Gh1oDZ.n6CGJUgJ-rjFOpCt-zVP-jqom3ATdxvL9TTkDg';

// --- ID РОЛЕЙ ---
const STAFF_ROLE_ID = '1474051546361762024';      
const HIGH_STAFF_ROLE_ID = '1564177985060212766'; 
const DEPUTY_ROLE_ID = '1564180732597895188';     
const LEADER_ROLE_ID = '1564180867079864460';     
const DEPT_HEAD_ROLE_ID = '1564602291900653629';  
const DEPT_DEPUTY_ROLE_ID = '1564602430476521512'; 

// --- ID ОТДЕЛОВ ---
const PRD_ROLE_ID = '1564597566912471121'; 
const OK_ROLE_ID = '1564597995209760778';
const SMPD_ROLE_ID = '1564598031498739834';

// --- ВЕБХУКИ ---
const WORKING_WEBHOOK = 'https://discord.com/api/webhooks/1564972077721591818/DFQC46zk8JuEjOG4OGJt8wdtu8m5EssQeA6oqMtHohHNh3ALfbRz3ujpRkCIgIsnLWet';
const WEBHOOK_JOBS = WORKING_WEBHOOK;
const WEBHOOK_COMPLAINTS = WORKING_WEBHOOK;
const WEBHOOK_ORDERS = WORKING_WEBHOOK; 
const WEBHOOK_REPORTS_APPROVED = WORKING_WEBHOOK;

// --- БАЗА ДАННЫХ ---
const DB_FILE = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        users: {}, reports: [], orders: [], news: [], logs: [],
        shop: [
            { id: 'cash_10k', icon: '💵', name: '10.000$ наличными', price: 500, desc: 'Обмен валюты на игровые деньги' },
            { id: 'med_kit', icon: '💊', name: 'Аптечка', price: 300, desc: 'Пополнение запасов' },
            { id: 'car_ambulance', icon: '🚑', name: 'Ключи от скорой', price: 2000, desc: 'Личный транспорт для работы' }
        ]
    }, null, 2));
}
const getDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- ФУНКЦИЯ ЛОГИРОВАНИЯ ---
const addLog = (userId, username, action, details, reportId = null) => {
    const db = getDB();
    if (!db.logs) db.logs = [];
    db.logs.push({
        id: Date.now().toString(), userId, username, action, details, reportId,
        timestamp: new Date().toISOString()
    });
    if (db.logs.length > 500) db.logs.shift();
    saveDB(db);
};

// --- ФУНКЦИЯ ОЧИСТКИ СТАРЫХ ДАННЫХ (раз в неделю) ---
const cleanOldData = () => {
    const db = getDB();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    if (db.reports) {
        db.reports = db.reports.filter(r => new Date(r.timestamp).getTime() > oneWeekAgo);
    }
    if (db.logs) {
        db.logs = db.logs.filter(l => new Date(l.timestamp).getTime() > oneWeekAgo);
    }
    saveDB(db);
};
cleanOldData();

// --- СТАТИКА И ГЛАВНАЯ СТРАНИЦА ---
app.use(express.static(path.join(__dirname, '../'))); 
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.use(session({
    secret: 'lsmc-super-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
}));

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff)).setHours(0,0,0,0);
};

// --- АВТОРИЗАЦИЯ ---
app.get('/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
    res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/index.html');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
        const user = userResponse.data;

        let isStaff = false, isHighStaff = false, isLeader = false;
        let serverNickname = user.username;
        
        try {
            const memberResponse = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
            const member = memberResponse.data;
            const roles = member.roles;
            if (member.nick) serverNickname = member.nick;

            if (roles.includes(STAFF_ROLE_ID)) isStaff = true;
            if (roles.includes(HIGH_STAFF_ROLE_ID)) isHighStaff = true;
            if (roles.includes(DEPUTY_ROLE_ID) || roles.includes(LEADER_ROLE_ID)) isLeader = true;
            if (isLeader) isHighStaff = true;
            if (isHighStaff) isStaff = true;
        } catch (e) { console.error("Ошибка участника:", e.message); }

        req.session.user = { id: user.id, username: serverNickname, avatar: user.avatar, isStaff, isHighStaff, isLeader };
        
        const db = getDB();
        if (!db.users[user.id]) {
            db.users[user.id] = { balance: 0, inventory: [], totalEarned: 0, avatar: user.avatar, username: serverNickname, warnings: 0, cid: null };
        } else {
            db.users[user.id].avatar = user.avatar;
            db.users[user.id].username = serverNickname;
            if (db.users[user.id].warnings === undefined) db.users[user.id].warnings = 0;
            if (db.users[user.id].cid === undefined) db.users[user.id].cid = null;
        }
        saveDB(db);
        res.redirect('/index.html'); 
    } catch (error) {
        console.error("Ошибка OAuth2:", error.message);
        res.redirect('/index.html');
    }
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        const db = getDB();
        const userDb = db.users[req.session.user.id] || { balance: 0, inventory: [], totalEarned: 0, avatar: '', warnings: 0, cid: null };
        const needsCid = !userDb.cid;
        res.json({ ...req.session.user, ...userDb, needsCid });
    } else {
        res.json({ isStaff: false, isHighStaff: false, isLeader: false, username: null, needsCid: false });
    }
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// --- СОХРАНЕНИЕ CID ПОЛЬЗОВАТЕЛЕМ ---
app.post('/api/user/set-cid', (req, res) => {
    if (!req.session.user) return res.status(403).json({ error: 'Не авторизован' });
    const { cid } = req.body;
    if (!cid || cid.length < 2) return res.status(400).json({ error: 'Неверный CID' });

    const db = getDB();
    if (db.users[req.session.user.id]) {
        db.users[req.session.user.id].cid = cid.toUpperCase();
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Пользователь не найден' });
    }
});

// --- ОТПРАВКА В DISCORD ---
const sendToDiscord = async (webhookUrl, payload, imagesBase64) => {
    try {
        if (imagesBase64 && imagesBase64.length > 0) {
            const form = new FormData();
            form.append('payload_json', JSON.stringify(payload));
            imagesBase64.forEach((img, index) => {
                const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
                form.append(`file${index}`, Buffer.from(base64Data, 'base64'), { filename: `screenshot_${index}.png` });
            });
            await axios.post(webhookUrl, form, { headers: form.getHeaders() });
        } else {
            await axios.post(webhookUrl, payload);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// --- ОБЫЧНЫЕ ФОРМЫ ---
app.post('/api/apply', async (req, res) => {
    const { name, discord, static, about, images, date } = req.body;
    const payload = {
        username: "LSMC | Заявки", embeds: [{ title: "📝 Новая заявка", color: 2250056, fields: [
            { name: "Отправитель", value: `<@${req.session.user?.id || 'Гость'}>` }, { name: "Имя (IC)", value: name, inline: true },
            { name: "Discord", value: discord, inline: true }, { name: "Static ID", value: static, inline: true },
            { name: "О себе", value: about }, { name: "Дата", value: date || 'Не указана' }
        ], timestamp: new Date().toISOString() }]
    };
    res.json(await sendToDiscord(WEBHOOK_JOBS, payload, images));
});

app.post('/api/complaint', async (req, res) => {
    const { compName, compTarget, compReason, images, date } = req.body;
    const payload = {
        username: "LSMC | Жалобы", embeds: [{ title: "⚠️ Новая жалоба", color: 16711680, fields: [
            { name: "Отправитель", value: `<@${req.session.user?.id || 'Гость'}>` }, { name: "От кого", value: compName, inline: true },
            { name: "На кого", value: compTarget, inline: true }, { name: "Суть", value: compReason }, { name: "Дата", value: date || 'Не указана' }
        ], timestamp: new Date().toISOString() }]
    };
    res.json(await sendToDiscord(WEBHOOK_COMPLAINTS, payload, images));
});

// --- ОТЧЕТЫ ---
app.post('/api/staff/report', async (req, res) => {
    if (!req.session.user || !req.session.user.isStaff) return res.status(403).json({ success: false });
    const db = getDB();
    db.reports.push({ 
        id: Date.now().toString(), userId: req.session.user.id, username: req.session.user.username, 
        avatar: req.session.user.avatar, type: req.body.type, text: req.body.text, images: req.body.images, 
        status: 'pending', date: req.body.date, week: req.body.week, timestamp: new Date().toISOString() 
    });
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/staff/review', async (req, res) => {
    if (!req.session.user || !req.session.user.isHighStaff) return res.status(403).json({ error: 'Нет доступа' });
    const { reportId, action, amount, reason } = req.body;
    const db = getDB();
    const report = db.reports.find(r => r.id === reportId);
    if (!report) return res.status(404).json({ error: 'Нет отчета' });

    if (action === 'approve') {
        report.status = 'approved';
        const reward = parseInt(amount) || 100;
        if (db.users[report.userId]) {
            db.users[report.userId].balance += reward;
            db.users[report.userId].totalEarned = (db.users[report.userId].totalEarned || 0) + reward;
        }
        const payload = {
            username: "LSMC | Проверка отчетов", embeds: [{ title: "✅ Отчет одобрен", color: 3066993, fields: [
                { name: "Проверяющий", value: `<@${req.session.user.id}> (${req.session.user.username})` },
                { name: "Сотрудник", value: `<@${report.userId}> (${report.username})`, inline: true },
                { name: "Награда", value: `${reward} LSMC`, inline: true }, { name: "Текст", value: report.text }
            ], timestamp: new Date().toISOString() }]
        };
        await sendToDiscord(WEBHOOK_REPORTS_APPROVED, payload, report.images || []);
        addLog(req.session.user.id, req.session.user.username, 'Одобрение отчета', `Одобрен отчет ${report.username} на ${reward} LSMC`, report.id);
    } else {
        report.status = 'rejected';
        report.reason = reason || 'Без причины';
        addLog(req.session.user.id, req.session.user.username, 'Отклонение отчета', `Отклонен отчет ${report.username}: ${report.reason}`, report.id);
    }
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/staff/leaderboard', (req, res) => {
    const db = getDB();
    const startOfWeek = getStartOfWeek(new Date());
    const stats = {};
    db.reports.forEach(r => {
        if (r.status === 'approved' && new Date(r.timestamp).getTime() >= startOfWeek) {
            if (!stats[r.userId]) stats[r.userId] = { userId: r.userId, username: db.users[r.userId]?.username || r.username, avatar: r.avatar || db.users[r.userId]?.avatar, count: 0 };
            stats[r.userId].count++;
        }
    });
    res.json(Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 3));
});

app.get('/api/staff/stats', (req, res) => {
    if (!req.session.user) return res.status(403).json({});
    const db = getDB();
    const user = db.users[req.session.user.id] || { totalEarned: 0, balance: 0 };
    const userReports = db.reports.filter(r => r.userId === req.session.user.id);
    res.json({ totalEarned: user.totalEarned || 0, totalReports: userReports.length, approvedReports: userReports.filter(r => r.status === 'approved').length, balance: user.balance });
});

app.get('/api/staff/my-reports', (req, res) => {
    if (!req.session.user) return res.status(403).json([]);
    res.json(getDB().reports.filter(r => r.userId === req.session.user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.get('/api/staff/my-orders', (req, res) => {
    if (!req.session.user) return res.status(403).json([]);
    res.json(getDB().orders.filter(o => o.userId === req.session.user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.get('/api/staff/pending-reports', (req, res) => {
    if (!req.session.user || !req.session.user.isHighStaff) return res.status(403).json([]);
    res.json(getDB().reports.filter(r => r.status === 'pending'));
});

app.get('/api/staff/all-reports', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json([]);
    res.json(getDB().reports || []);
});

app.post('/api/staff/checkout', async (req, res) => {
    if (!req.session.user || !req.session.user.isStaff) return res.status(403).json({});
    const db = getDB();
    const user = db.users[req.session.user.id];
    const total = req.body.items.reduce((sum, item) => sum + item.price, 0);
    
    if (user.balance < total) return res.status(400).json({ success: false });
    user.balance -= total;
    
    const orderList = [];
    req.body.items.forEach(item => {
        const orderId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newOrder = { id: orderId, userId: user.id, username: user.username, itemName: item.name, price: item.price, status: 'pending', timestamp: new Date().toISOString() };
        db.orders.push(newOrder);
        orderList.push(newOrder);
    });
    saveDB(db);

    const itemsText = orderList.map(i => `• ${i.itemName} (${i.price} LSMC)`).join('\n');
    const payload = {
        username: "LSMC | Новый заказ", embeds: [{ title: "🛒 Новый заказ", color: 3447003, fields: [
            { name: "Сотрудник", value: `<@${req.session.user.id}> (${req.session.user.username})` },
            { name: "Товары", value: itemsText }, { name: "Итого", value: `${total} LSMC`, inline: true },
            { name: "Остаток", value: `${user.balance} LSMC`, inline: true }
        ], timestamp: new Date().toISOString() }]
    };
    await sendToDiscord(WEBHOOK_ORDERS, payload, []);
    res.json({ success: true, newBalance: user.balance });
});

// --- МАГАЗИН ---
app.get('/api/staff/shop', (req, res) => res.json(getDB().shop || []));

app.post('/api/leader/shop/add', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    db.shop.push({ id: Date.now().toString(), name: req.body.name, price: parseInt(req.body.price), desc: req.body.desc, icon: req.body.icon });
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Добавление товара', `Добавлен "${req.body.name}"`);
    res.json({ success: true });
});

app.post('/api/leader/shop/remove', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    db.shop = db.shop.filter(i => i.id !== req.body.itemId);
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Удаление товара', `Удален товар`);
    res.json({ success: true });
});

// --- ЗАКАЗЫ (ВЫДАЧА) ---
app.get('/api/staff/orders', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json([]);
    res.json(getDB().orders || []);
});

app.post('/api/staff/order/review', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    const order = db.orders.find(o => o.id === req.body.orderId);
    if (order) {
        order.status = req.body.action;
        if (req.body.reason) order.reason = req.body.reason;
        saveDB(db);
        addLog(req.session.user.id, req.session.user.username, 'Выдача заказа', `Заказ "${order.itemName}" - ${req.body.action}`);
    }
    res.json({ success: true });
});

// --- НОВОСТИ ---
app.get('/api/news', (req, res) => res.json(getDB().news || []));

app.post('/api/leader/news/add', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    db.news.push({ id: Date.now().toString(), title: req.body.title, text: req.body.text, tag: req.body.tag, date: req.body.date, image: req.body.image });
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Новость', `Добавлена "${req.body.title}"`);
    res.json({ success: true });
});

app.post('/api/leader/news/remove', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    db.news = db.news.filter(n => n.id !== req.body.newsId);
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Удаление новости', `Удалена новость`);
    res.json({ success: true });
});

// --- БАЗА ДАННЫХ СОТРУДНИКОВ ---
app.get('/api/leader/users', async (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json([]);
    const db = getDB();
    let discordMembers = [];
    try {
        const response = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members?limit=1000`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
        discordMembers = response.data.filter(m => !m.user.bot && (m.roles.includes(STAFF_ROLE_ID) || m.roles.includes(LEADER_ROLE_ID) || m.roles.includes(DEPT_HEAD_ROLE_ID) || m.roles.includes(DEPT_DEPUTY_ROLE_ID) || m.roles.includes(HIGH_STAFF_ROLE_ID) || m.roles.includes(DEPUTY_ROLE_ID)));
    } catch (error) {
        discordMembers = Object.keys(db.users).map(id => ({ user: { id }, nick: db.users[id].username, avatar: db.users[id].avatar, roles: [] }));
    }

    const now = new Date(), startOfWeek = getStartOfWeek(now), startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const users = discordMembers.map(member => {
        const userId = member.user.id, roles = member.roles;
        const dbUser = db.users[userId] || { balance: 0, totalEarned: 0, warnings: 0, cid: null };
        let rankWeight = 10, deptWeight = 0, deptName = 'Не назначен', deptIcon = '❓', rankTitle = 'Сотрудник';
        if (roles.includes(OK_ROLE_ID)) { deptName = 'ОК'; deptIcon = '📋'; deptWeight = 3; }
        else if (roles.includes(SMPD_ROLE_ID)) { deptName = 'SMPD'; deptIcon = '🧠'; deptWeight = 2; }
        else if (roles.includes(PRD_ROLE_ID)) { deptName = 'PRD'; deptIcon = '🚑'; deptWeight = 1; }
        if (roles.includes(LEADER_ROLE_ID)) { rankWeight = 100; rankTitle = 'Лидер'; deptName = 'Все'; deptIcon = '👑'; deptWeight = 99; }
        else if (roles.includes(DEPUTY_ROLE_ID)) { rankWeight = 90; rankTitle = 'Зам. Лидера'; deptName = 'Все'; deptIcon = '🛡️'; deptWeight = 99; }
        else if (roles.includes(DEPT_HEAD_ROLE_ID)) { rankWeight = 80; rankTitle = 'Глава отдела'; }
        else if (roles.includes(DEPT_DEPUTY_ROLE_ID)) { rankWeight = 70; rankTitle = 'Зам. Главы'; }
        else if (roles.includes(HIGH_STAFF_ROLE_ID)) { rankWeight = 60; rankTitle = 'Ст. Состав'; }
        const userReports = db.reports.filter(r => r.userId === userId && r.status === 'approved');
        return {
            id: userId, username: member.nick || member.user.username, discordTag: member.user.username,
            department: rankWeight >= 90 ? `${deptIcon} ${rankTitle}` : `${deptIcon} ${deptName} | ${rankTitle}`,
            rankWeight, deptWeight, avatar: member.user.avatar || dbUser.avatar,
            balance: dbUser.balance || 0, totalEarned: dbUser.totalEarned || 0, warnings: dbUser.warnings || 0,
            cid: dbUser.cid || null,
            weekActivity: userReports.filter(r => new Date(r.timestamp).getTime() >= startOfWeek).length,
            monthActivity: userReports.filter(r => new Date(r.timestamp).getTime() >= startOfMonth).length
        };
    });
    users.sort((a, b) => b.rankWeight - a.rankWeight || b.deptWeight - a.deptWeight || b.balance - a.balance);
    res.json(users);
});

app.post('/api/leader/users/balance', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    if (!db.users[req.body.userId]) db.users[req.body.userId] = { balance: 0, username: 'Сотрудник', warnings: 0, inventory: [], totalEarned: 0, cid: null };
    const user = db.users[req.body.userId], amount = parseInt(req.body.amount);
    if (req.body.action === 'add') { user.balance += amount; user.totalEarned += amount; }
    else if (user.balance >= amount) user.balance -= amount;
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Баланс', `${req.body.action === 'add' ? 'Выдано' : 'Списано'} ${amount} LSMC`);
    res.json({ success: true, newBalance: user.balance });
});

app.post('/api/leader/users/warn', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const db = getDB();
    if (!db.users[req.body.userId]) db.users[req.body.userId] = { balance: 0, username: 'Сотрудник', warnings: 0, inventory: [], totalEarned: 0, cid: null };
    const user = db.users[req.body.userId];
    if (req.body.action === 'add') user.warnings++;
    else if (user.warnings > 0) user.warnings--;
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Варны', `${req.body.action === 'add' ? 'Выдан' : 'Снят'} варн`);
    res.json({ success: true, warnings: user.warnings });
});

// --- ИСПРАВЛЕНИЕ CID ЛИДЕРОМ ---
app.post('/api/leader/users/cid', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json({});
    const { userId, cid } = req.body;
    const db = getDB();
    if (!db.users[userId]) db.users[userId] = { balance: 0, username: 'Сотрудник', warnings: 0, inventory: [], totalEarned: 0, cid: null };
    db.users[userId].cid = cid ? cid.toUpperCase() : null;
    saveDB(db);
    addLog(req.session.user.id, req.session.user.username, 'Изменение CID', `Установлен CID: ${cid || 'Удален'}`);
    res.json({ success: true, cid: db.users[userId].cid });
});

app.get('/api/leader/logs', (req, res) => {
    if (!req.session.user?.isLeader) return res.status(403).json([]);
    const db = getDB();
    const startOfWeek = getStartOfWeek(new Date());
    const weeklyLogs = (db.logs || []).filter(log => new Date(log.timestamp).getTime() >= startOfWeek);
    res.json(weeklyLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Сервер LSMC запущен на порту ${PORT}`));