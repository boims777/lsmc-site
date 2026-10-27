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
const REDIRECT_URI = 'https://lsmc-site.onrender.com/auth/discord/callback';
const GUILD_ID = '1176546172240928808'; 

const BOT_TOKEN = process.env.BOT_TOKEN; 

// --- ID РОЛЕЙ ---
const STAFF_ROLE_ID = '1474051546361762024';      // Сотрудник
const HIGH_STAFF_ROLE_ID = '1564177985060212766'; // Старший состав
const DEPUTY_ROLE_ID = '1564180732597895188';     // Зам лидера
const LEADER_ROLE_ID = '1564180867079864460';     // Лидер

// --- ВЕБХУКИ ---
const WEBHOOK_JOBS = 'https://discord.com/api/webhooks/1564167409445634129/eVP7mymw50LoMNKOfLWPic-ZXOghD-vMD_MJ2SuI0XOEXUhLjznhz5cjy1r9kS7hRSz0';
const WEBHOOK_COMPLAINTS = 'https://discord.com/api/webhooks/1564167409445634129/eVP7mymw50LoMNKOfLWPic-ZXOghD-vMD_MJ2SuI0XOEXUhLjznhz5cjy1r9kS7hRSz0';
const WEBHOOK_ORDERS = 'https://discord.com/api/webhooks/1564167409445634129/eVP7mymw50LoMNKOfLWPic-ZXOghD-vMD_MJ2SuI0XOEXUhLjznhz5cjy1r9kS7hRSz0'; 
const WEBHOOK_REPORTS_APPROVED = 'https://discord.com/api/webhooks/1564167409445634129/eVP7mymw50LoMNKOfLWPic-ZXOghD-vMD_MJ2SuI0XOEXUhLjznhz5cjy1r9kS7hRSz0';

// --- БАЗА ДАННЫХ ---
const DB_FILE = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        users: {}, 
        reports: [],
        orders: [],
        news: [],
        shop: [
            { id: 'cash_10k', icon: '💵', name: '10.000$ наличными', price: 500, desc: 'Обмен валюты на игровые деньги' },
            { id: 'med_kit', icon: '💊', name: 'Аптечка', price: 300, desc: 'Пополнение запасов' },
            { id: 'car_ambulance', icon: '🚑', name: 'Ключи от скорой', price: 2000, desc: 'Личный транспорт для работы' }
        ]
    }, null, 2));
}
const getDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

app.use(express.static(path.join(__dirname, '../'))); 
app.use(express.json({ limit: '50mb' }));
app.use(session({
    secret: 'lsmc-super-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
}));

// --- ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ НАЧАЛА НЕДЕЛИ ---
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
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResponse.data.access_token;
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = userResponse.data;

        let isStaff = false, isHighStaff = false, isLeader = false;
        let serverNickname = user.username;
        
        try {
            const memberResponse = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` }
            });
            const member = memberResponse.data;
            const roles = member.roles;
            
            if (member.nick) serverNickname = member.nick;

            if (roles.includes(STAFF_ROLE_ID)) isStaff = true;
            if (roles.includes(HIGH_STAFF_ROLE_ID)) isHighStaff = true;
            if (roles.includes(DEPUTY_ROLE_ID)) isLeader = true;
            if (roles.includes(LEADER_ROLE_ID)) isLeader = true;
            
            if (isLeader) isHighStaff = true;
            if (isHighStaff) isStaff = true;

        } catch (e) { 
            console.error("Ошибка получения данных участника:", e.message);
        }

        req.session.user = { 
            id: user.id, 
            username: serverNickname, 
            avatar: user.avatar, 
            isStaff, isHighStaff, isLeader 
        };
        
        const db = getDB();
        if (!db.users[user.id]) {
            db.users[user.id] = { balance: 0, inventory: [], totalEarned: 0, avatar: user.avatar, username: serverNickname, warnings: 0 };
            saveDB(db);
        } else {
            db.users[user.id].avatar = user.avatar;
            db.users[user.id].username = serverNickname;
            if (db.users[user.id].warnings === undefined) db.users[user.id].warnings = 0;
            saveDB(db);
        }

        res.redirect('/index.html'); 
    } catch (error) {
        console.error("Ошибка OAuth2:", error.message);
        res.redirect('/index.html');
    }
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        const db = getDB();
        const userDb = db.users[req.session.user.id] || { balance: 0, inventory: [], totalEarned: 0, avatar: '', warnings: 0 };
        res.json({ ...req.session.user, ...userDb });
    } else {
        res.json({ isStaff: false, isHighStaff: false, isLeader: false, username: null });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- ОТПРАВКА В DISCORD ---
const sendToDiscord = async (webhookUrl, payload, imagesBase64) => {
    try {
        if (imagesBase64 && imagesBase64.length > 0) {
            const form = new FormData();
            form.append('payload_json', JSON.stringify(payload));
            imagesBase64.forEach((img, index) => {
                const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                form.append(`file${index}`, buffer, { filename: `screenshot_${index}.png` });
            });
            await axios.post(webhookUrl, form, { headers: form.getHeaders() });
            return { success: true };
        } else {
            await axios.post(webhookUrl, payload);
            return { success: true };
        }
    } catch (error) {
        console.error(`[Discord Webhook] ОШИБКА:`, error.message);
        return { success: false, error: error.message };
    }
};

// --- ОБЫЧНЫЕ ФОРМЫ ---
app.post('/api/apply', async (req, res) => {
    const { name, discord, static, about, images, date } = req.body;
    const payload = {
        username: "LSMC | Заявки",
        embeds: [{
            title: "📝 Новая заявка на трудоустройство",
            color: 2250056,
            fields: [
                { name: "Отправитель", value: `<@${req.session.user?.id || 'Гость'}>`, inline: false },
                { name: "Имя (IC)", value: name, inline: true },
                { name: "Discord", value: discord, inline: true },
                { name: "Static ID / CID", value: static, inline: true },
                { name: "О себе", value: about, inline: false },
                { name: "Дата отправки", value: date || 'Не указана', inline: false }
            ],
            timestamp: new Date().toISOString()
        }]
    };
    const result = await sendToDiscord(WEBHOOK_JOBS, payload, images);
    res.json(result);
});

app.post('/api/complaint', async (req, res) => {
    const { compName, compTarget, compReason, images, date } = req.body;
    const payload = {
        username: "LSMC | Жалобы",
        embeds: [{
            title: "⚠️ Новая жалоба",
            color: 16711680,
            fields: [
                { name: "Отправитель", value: `<@${req.session.user?.id || 'Гость'}>`, inline: false },
                { name: "От кого (IC)", value: compName, inline: true },
                { name: "На кого", value: compTarget, inline: true },
                { name: "Суть жалобы", value: compReason, inline: false },
                { name: "Дата отправки", value: date || 'Не указана', inline: false }
            ],
            timestamp: new Date().toISOString()
        }]
    };
    const result = await sendToDiscord(WEBHOOK_COMPLAINTS, payload, images);
    res.json(result);
});

// --- ОТЧЕТЫ ---
app.post('/api/staff/report', async (req, res) => {
    if (!req.session.user || !req.session.user.isStaff) return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    const { type, text, images, date, week } = req.body;
    const db = getDB();
    const reportId = Date.now().toString();
    
    db.reports.push({
        id: reportId, 
        userId: req.session.user.id, 
        username: req.session.user.username,
        avatar: req.session.user.avatar || '',
        type, text, images,
        status: 'pending', 
        reason: '', 
        date: date || new Date().toLocaleString(),
        week: week || '',
        timestamp: new Date().toISOString()
    });
    saveDB(db);

    res.json({ success: true });
});

app.post('/api/staff/review', async (req, res) => {
    if (!req.session.user || !req.session.user.isHighStaff) return res.status(403).json({ error: 'Доступ запрещен' });
    const { reportId, action, amount, reason } = req.body;
    const db = getDB();
    const report = db.reports.find(r => r.id === reportId);
    if (!report) return res.status(404).json({ error: 'Отчет не найден' });

    if (action === 'approve') {
        report.status = 'approved';
        const reward = parseInt(amount) || 100;
        if (db.users[report.userId]) {
            db.users[report.userId].balance += reward;
            db.users[report.userId].totalEarned = (db.users[report.userId].totalEarned || 0) + reward;
        }

        const payload = {
            username: "LSMC | Одобренные отчеты",
            embeds: [{
                title: "✅ Отчет одобрен",
                color: 3066993,
                fields: [
                    { name: "Сотрудник", value: `<@${report.userId}> (${report.username})`, inline: false },
                    { name: "Тип отчета", value: report.type, inline: true },
                    { name: "Текст", value: report.text, inline: false },
                    { name: "Награда", value: `${reward} LSMC`, inline: true },
                    { name: "Дата отправки", value: report.date || 'Не указана', inline: false },
                    { name: "Неделя", value: report.week || 'Не указана', inline: false }
                ],
                timestamp: new Date().toISOString()
            }]
        };
        await sendToDiscord(WEBHOOK_REPORTS_APPROVED, payload, report.images || []);

    } else {
        report.status = 'rejected';
        report.reason = reason || 'Причина не указана';
    }
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/staff/leaderboard', (req, res) => {
    const db = getDB();
    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    
    const stats = {};
    db.reports.forEach(r => {
        if (r.status === 'approved') {
            const reportDate = new Date(r.timestamp).getTime();
            if (reportDate >= startOfWeek) {
                if (!stats[r.userId]) {
                    const currentUser = db.users[r.userId];
                    stats[r.userId] = { 
                        userId: r.userId,
                        username: (currentUser && currentUser.username) ? currentUser.username : r.username, 
                        avatar: r.avatar || (currentUser ? currentUser.avatar : ''),
                        count: 0 
                    };
                }
                stats[r.userId].count++;
            }
        }
    });
    const leaderboard = Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 3);
    res.json(leaderboard);
});

app.get('/api/staff/stats', (req, res) => {
    if (!req.session.user) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    const user = db.users[req.session.user.id] || { totalEarned: 0, balance: 0 };
    const userReports = db.reports.filter(r => r.userId === req.session.user.id);
    const approved = userReports.filter(r => r.status === 'approved').length;
    res.json({ totalEarned: user.totalEarned || 0, totalReports: userReports.length, approvedReports: approved, balance: user.balance });
});

app.get('/api/staff/my-reports', (req, res) => {
    if (!req.session.user) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    const myReports = db.reports
        .filter(r => r.userId === req.session.user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(myReports);
});

app.get('/api/staff/my-orders', (req, res) => {
    if (!req.session.user) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    const myOrders = (db.orders || [])
        .filter(o => o.userId === req.session.user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(myOrders);
});

app.get('/api/staff/pending-reports', (req, res) => {
    if (!req.session.user || !req.session.user.isHighStaff) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    res.json(db.reports.filter(r => r.status === 'pending'));
});

app.post('/api/staff/checkout', async (req, res) => {
    if (!req.session.user || !req.session.user.isStaff) return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Корзина пуста' });

    const db = getDB();
    const user = db.users[req.session.user.id];
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
    if (user.balance < totalPrice) return res.status(400).json({ success: false, error: 'Недостаточно средств' });

    user.balance -= totalPrice;

    if (!db.orders) db.orders = [];
    items.forEach(item => {
        const orderId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        db.orders.push({
            id: orderId,
            userId: req.session.user.id,
            username: req.session.user.username,
            itemName: item.name,
            price: item.price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
    });

    saveDB(db);

    const orderList = items.map(i => `• ${i.name} (${i.price} LSMC)`).join('\n');
    const payload = {
        username: "LSMC | Новый заказ",
        embeds: [{
            title: "🛒 Новый заказ из магазина",
            color: 3447003,
            fields: [
                { name: "Сотрудник", value: `<@${req.session.user.id}> (${req.session.user.username})`, inline: false },
                { name: "Товары", value: orderList, inline: false },
                { name: "Итого", value: `${totalPrice} LSMC`, inline: true },
                { name: "Остаток баланса", value: `${user.balance} LSMC`, inline: true }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    await sendToDiscord(WEBHOOK_ORDERS, payload, []);

    res.json({ success: true, newBalance: user.balance });
});

// --- МАГАЗИН ---
app.get('/api/staff/shop', (req, res) => {
    const db = getDB();
    res.json(db.shop || []);
});

// --- УПРАВЛЕНИЕ МАГАЗИНОМ (LEADER) ---
app.post('/api/leader/shop/add', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { name, price, desc, icon } = req.body;
    const db = getDB();
    const newItem = { id: Date.now().toString(), name, price: parseInt(price), desc, icon: icon || '🎁' };
    db.shop.push(newItem);
    saveDB(db);
    res.json({ success: true, item: newItem });
});

app.post('/api/leader/shop/remove', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { itemId } = req.body;
    const db = getDB();
    db.shop = db.shop.filter(i => i.id !== itemId);
    saveDB(db);
    res.json({ success: true });
});

// --- ЗАКАЗЫ (ВЫДАЧА) ---
app.get('/api/staff/orders', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    res.json(db.orders || []);
});

app.post('/api/staff/order/review', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { orderId, action, reason } = req.body;
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    order.status = action;
    if (action === 'rejected' && reason) {
        order.reason = reason;
    }
    saveDB(db);
    res.json({ success: true });
});

// --- НОВОСТИ ---
app.get('/api/news', (req, res) => {
    const db = getDB();
    res.json(db.news || []);
});

app.post('/api/leader/news/add', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { title, text, tag, date, image } = req.body; 
    const db = getDB();
    if (!db.news) db.news = [];
    
    db.news.push({
        id: Date.now().toString(),
        title, 
        text, 
        tag, 
        date,
        image: image || null 
    });
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/leader/news/remove', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { newsId } = req.body;
    const db = getDB();
    if (!db.news) db.news = [];
    db.news = db.news.filter(n => n.id !== newsId);
    saveDB(db);
    res.json({ success: true });
});

// --- БАЗА ДАННЫХ СОТРУДНИКОВ (ДЛЯ ЛИДЕРА) ---

// Получить список всех пользователей С РОЛЬЮ (через Discord API)
app.get('/api/leader/users', async (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const db = getDB();
    let discordMembers = [];

    try {
        // Запрашиваем участников сервера у Discord (максимум 1000 за раз)
        const response = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members?limit=1000`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        
        // Фильтруем: оставляем только тех, у кого есть роль сотрудника (или выше)
        discordMembers = response.data.filter(member => {
            if (member.user.bot) return false; // Пропускаем ботов
            const roles = member.roles;
            return roles.includes(STAFF_ROLE_ID) || 
                   roles.includes(HIGH_STAFF_ROLE_ID) || 
                   roles.includes(DEPUTY_ROLE_ID) || 
                   roles.includes(LEADER_ROLE_ID);
        });

    } catch (error) {
        console.error("[DISCORD API] Ошибка получения участников:", error.message);
        // Если Discord API недоступен, возвращаем хотя бы тех, кто есть в БД
        discordMembers = Object.keys(db.users).map(id => ({
            user: { id: id },
            nick: db.users[id].username,
            avatar: db.users[id].avatar
        }));
    }

    // Формируем итоговый список, объединяя данные из Discord и из БД
    const users = discordMembers.map(member => {
        const userId = member.user.id;
        
        // Если пользователь есть в БД, берем его данные, иначе ставим нули
        const dbUser = db.users[userId] || { 
            balance: 0, 
            totalEarned: 0, 
            inventory: [], 
            warnings: 0 
        };

        // Ник на сервере (или глобальный, если ника нет)
        const displayName = member.nick || member.user.username || 'Неизвестный';
        
        // Аватар
        const avatarHash = member.user.avatar || dbUser.avatar;
        const avatarUrl = avatarHash ? avatarHash : null;

        return {
            id: userId,
            username: displayName,
            avatar: avatarUrl,
            balance: dbUser.balance || 0,
            totalEarned: dbUser.totalEarned || 0,
            inventory: dbUser.inventory || [],
            warnings: dbUser.warnings || 0,
            isInDb: !!db.users[userId] // Полезный флаг (опционально)
        };
    });

    // Сортируем по балансу
    users.sort((a, b) => b.balance - a.balance);
    
    res.json(users);
});

// Изменить баланс пользователя
app.post('/api/leader/users/balance', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId, amount, action } = req.body; // action: 'add' или 'remove'
    const db = getDB();
    
    if (!db.users[userId]) return res.status(404).json({ error: 'Пользователь не найден' });
    
    const user = db.users[userId];
    const parsedAmount = parseInt(amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Неверная сумма' });

    if (action === 'add') {
        user.balance = (user.balance || 0) + parsedAmount;
        user.totalEarned = (user.totalEarned || 0) + parsedAmount;
    } else if (action === 'remove') {
        if (user.balance < parsedAmount) return res.status(400).json({ error: 'Недостаточно средств у сотрудника' });
        user.balance -= parsedAmount;
    }

    saveDB(db);
    res.json({ success: true, newBalance: user.balance });
});

// Изменить количество предупреждений (варнов)
app.post('/api/leader/users/warn', (req, res) => {
    if (!req.session.user || !req.session.user.isLeader) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId, action } = req.body; // action: 'add' или 'remove'
    const db = getDB();
    
    if (!db.users[userId]) return res.status(404).json({ error: 'Пользователь не найден' });
    
    const user = db.users[userId];
    user.warnings = user.warnings || 0;

    if (action === 'add') user.warnings++;
    else if (action === 'remove' && user.warnings > 0) user.warnings--;

    saveDB(db);
    res.json({ success: true, warnings: user.warnings });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер LSMC запущен на порту ${PORT}`);
});