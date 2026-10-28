document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav__link");
    const sections = document.querySelectorAll(".page-section");

    let currentUser = null;
    let cart = [];
    let shopItems = [];
    let allReportsCache = [];

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ДАТ ---
    const getFormattedDate = () => {
        const d = new Date();
        return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const getWeekRange = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const format = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        return `${format(monday)} - ${format(sunday)}`;
    };

    if(document.getElementById('job-date')) document.getElementById('job-date').value = getFormattedDate();
    if(document.getElementById('comp-date')) document.getElementById('comp-date').value = getFormattedDate();
    if(document.getElementById('rep-date')) document.getElementById('rep-date').value = getFormattedDate();
    if(document.getElementById('rep-week')) document.getElementById('rep-week').value = getWeekRange();

    // --- МОДАЛЬНЫЕ ОКНА ---
    const newsModal = document.getElementById('news-modal');
    const closeNewsModal = document.querySelector('.close-news-modal');
    window.openNews = (title, text, tag, date, imageUrl) => {
        document.getElementById('news-modal-title').textContent = title;
        document.getElementById('news-modal-text').innerHTML = text.replace(/\n/g, '<br>');
        document.getElementById('news-modal-tag').textContent = tag;
        document.getElementById('news-modal-date').textContent = date;
        const imgElement = document.getElementById('news-modal-image');
        if (imgElement) {
            if (imageUrl) { imgElement.src = imageUrl; imgElement.style.display = 'block'; }
            else imgElement.style.display = 'none';
        }
        newsModal.style.display = 'flex';
    };
    if (closeNewsModal) closeNewsModal.addEventListener('click', () => newsModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === newsModal) newsModal.style.display = 'none'; });

    const screenshotModal = document.getElementById('screenshot-modal');
    const screenshotContainer = document.getElementById('screenshot-container');
    const closeScreenshotModal = document.querySelector('.close-screenshot-modal');
    const screenshotModalTitle = document.getElementById('screenshot-modal-title');
    
    window.openScreenshots = (reportId, titleText) => {
        const report = allReportsCache.find(r => r.id === reportId) || (window.allReportsData ? window.allReportsData.find(r => r.id === reportId) : null);
        if (!report || !report.images || report.images.length === 0) return alert('Нет скриншотов или отчет не найден.');
        
        screenshotModalTitle.textContent = titleText || 'Скриншоты';
        screenshotContainer.innerHTML = '';
        report.images.forEach((imgBase64, index) => {
            const img = document.createElement('img');
            img.src = imgBase64;
            img.style.width = '100%';
            img.style.borderRadius = '12px';
            img.style.border = '1px solid rgba(255,255,255,0.1)';
            img.alt = `Скриншот ${index + 1}`;
            screenshotContainer.appendChild(img);
        });
        screenshotModal.style.display = 'flex';
    };
    if (closeScreenshotModal) closeScreenshotModal.addEventListener('click', () => screenshotModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === screenshotModal) screenshotModal.style.display = 'none'; });

    // --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
    const switchTab = (targetId) => {
        sections.forEach(section => section.classList.remove("active"));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add("active");
        navLinks.forEach(link => {
            if (link.getAttribute("data-target") === targetId) link.classList.add("active");
            else link.classList.remove("active");
        });
        window.scrollTo(0, 0);
        if(targetId === 'staff-area') { loadStats(); switchStaffSub('stats'); }
        if(targetId === 'news') loadNews();
    };

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("data-target");
            if (targetId) switchTab(targetId);
        });
    });

    // --- АВТОРИЗАЦИЯ ---
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
    const userBalanceWrapper = document.getElementById('user-balance-wrapper');
    const userBalanceVal = document.getElementById('user-balance');
    const cartIcon = document.getElementById('cart-icon');
    const cartCount = document.getElementById('cart-count');
    const logoutBtn = document.getElementById('logout-btn');

    if(userProfile) {
        userProfile.addEventListener('click', () => {
            if(currentUser && currentUser.isStaff) switchTab('staff-area');
            else alert('Нет доступа.');
        });
    }

    fetch('/api/me').then(r => r.json()).then(data => {
        currentUser = data;
        if (data.username) {
            if(loginBtn) loginBtn.style.display = 'none';
            if(userProfile) userProfile.style.display = 'flex';
            if(userName) userName.textContent = data.username;
            if(data.avatar) userAvatar.src = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`;
            else userAvatar.src = `https://cdn.discordapp.com/embed/avatars/0.png`;
            
            if (data.isStaff) {
                userBalanceWrapper.style.display = 'flex';
                userBalanceVal.textContent = data.balance;
                cartIcon.style.display = 'block';
                if(data.isHighStaff) document.getElementById('menu-reviews').style.display = 'block';
                if(data.isLeader) {
                    document.getElementById('menu-manage-news').style.display = 'block';
                    document.getElementById('menu-manage-shop').style.display = 'block';
                    document.getElementById('menu-orders').style.display = 'block';
                    document.getElementById('menu-database').style.display = 'block';
                    document.getElementById('menu-logs').style.display = 'block';
                }
            }

            // Если нужен CID — показываем модалку
            if (data.needsCid) {
                document.getElementById('cid-modal').style.display = 'flex';
            }
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); fetch('/api/logout').then(() => window.location.reload()); });

    // --- КОРЗИНА ---
    const cartModal = document.getElementById('cart-modal');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const closeModal = document.querySelector('.close-modal');
    const checkoutBtn = document.getElementById('checkout-btn');

    cartIcon.addEventListener('click', () => { renderCart(); cartModal.style.display = 'flex'; });
    closeModal.addEventListener('click', () => cartModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === cartModal) cartModal.style.display = 'none'; });

    const updateCartCount = () => { cartCount.textContent = cart.length; };
    const renderCart = () => {
        cartItemsList.innerHTML = '';
        let total = 0;
        cart.forEach((item, index) => {
            total += item.price;
            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.innerHTML = `<span class="item-name">${item.name}</span><span class="item-price">${item.price} LSMC</span><button class="remove-item" onclick="removeFromCart(${index})">✖</button>`;
            cartItemsList.appendChild(div);
        });
        cartTotalPrice.textContent = total;
    };

    window.removeFromCart = (index) => { cart.splice(index, 1); updateCartCount(); renderCart(); };
    window.addToCart = (itemId) => {
        if (!currentUser || !currentUser.isStaff) return alert('Войдите!');
        const item = shopItems.find(i => i.id === itemId);
        if (!item) return;
        cart.push(item);
        updateCartCount();
        alert(`Товар "${item.name}" добавлен!`);
        if (cartModal.style.display === 'flex') renderCart();
    };

    const loadShop = async () => {
        const container = document.getElementById('shop-items-container');
        try {
            shopItems = await (await fetch('/api/staff/shop')).json();
            container.innerHTML = '';
            shopItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'shop-item';
                div.innerHTML = `<span class="shop-item__icon">${item.icon}</span><h4>${item.name}</h4><p>${item.desc}</p><div class="shop-item__price">${item.price} LSMC</div><button class="btn btn--success" onclick="addToCart('${item.id}')" style="width: 100%;">В корзину</button>`;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    checkoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) return alert('Корзина пуста!');
        if (currentUser.balance < cart.reduce((s, i) => s + i.price, 0)) return alert('Нет средств!');
        if (!confirm(`Оформить заказ на ${cart.reduce((s, i) => s + i.price, 0)} LSMC?`)) return;
        try {
            const res = await fetch('/api/staff/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart }) });
            const data = await res.json();
            if (data.success) {
                alert('Заказ оформлен!');
                cart = []; updateCartCount(); cartModal.style.display = 'none';
                currentUser.balance = data.newBalance;
                userBalanceVal.textContent = data.newBalance;
            } else alert('Ошибка: ' + data.error);
        } catch (e) { alert('Ошибка сети'); }
    });

    // --- ПОДРАЗДЕЛЫ ---
    const staffSubSections = document.querySelectorAll(".staff-sub-section");
    const staffMenuLinks = document.querySelectorAll(".staff-menu-link");

    const switchStaffSub = (subId) => {
        staffSubSections.forEach(sec => sec.classList.remove("active"));
        const targetSub = document.getElementById(`sub-${subId}`);
        if (targetSub) targetSub.classList.add("active");
        staffMenuLinks.forEach(link => {
            if (link.getAttribute("data-sub") === subId) link.classList.add("active");
            else link.classList.remove("active");
        });

        if (subId === 'stats') loadStats();
        if (subId === 'shop') loadShop();
        if (subId === 'reviews') loadPendingReports();
        if (subId === 'manage-shop') loadManageShop();
        if (subId === 'leaderboard') loadLeaderboard();
        if (subId === 'orders') loadOrders();
        if (subId === 'my-reports') loadMyReports();
        if (subId === 'my-orders') loadMyOrders();
        if (subId === 'manage-news') loadManageNews();
        if (subId === 'database') loadDatabase();
        if (subId === 'logs') loadLogs();
    };

    staffMenuLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const subId = link.getAttribute("data-sub");
            if (subId) switchStaffSub(subId);
        });
    });

    // --- СТАТИСТИКА ---
    const loadStats = async () => {
        try {
            const data = await (await fetch('/api/staff/stats')).json();
            if (currentUser && currentUser.username) {
                const el = document.getElementById('stats-username');
                if (el) el.textContent = currentUser.username;
            }
            if (currentUser && currentUser.isHighStaff) {
                const btn = document.getElementById('qa-review-btn');
                if (btn) btn.style.display = 'flex';
            }
            const animateValue = (id, endValue, duration = 1000) => {
                const obj = document.getElementById(id);
                if (!obj) return;
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    obj.textContent = Math.floor((1 - Math.pow(1 - progress, 4)) * endValue);
                    if (progress < 1) window.requestAnimationFrame(step);
                    else obj.textContent = endValue;
                };
                window.requestAnimationFrame(step);
            };
            animateValue('stat-balance', data.balance);
            animateValue('stat-earned', data.totalEarned);
            animateValue('stat-total', data.totalReports);
            animateValue('stat-approved', data.approvedReports);
        } catch(e) { console.error(e); }
    };

    // --- ДОСКА ПОЧЕТА ---
    const loadLeaderboard = async () => {
        const container = document.getElementById('leaderboard-list');
        try {
            const data = await (await fetch('/api/staff/leaderboard')).json();
            container.innerHTML = '';
            if(data.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Пусто.</p>'; return; }
            const podium = document.createElement('div');
            podium.className = 'podium-container';
            const places = [];
            if (data[1]) places.push({ ...data[1], place: 2 }); 
            if (data[0]) places.push({ ...data[0], place: 1 }); 
            if (data[2]) places.push({ ...data[2], place: 3 }); 
            places.forEach(p => {
                const div = document.createElement('div');
                div.className = `podium-place place-${p.place}`;
                const avatarUrl = p.avatar ? `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
                const medal = p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉';
                const title = p.place === 1 ? '1 место' : p.place === 2 ? '2 место' : '3 место';
                div.innerHTML = `<div class="podium-avatar-wrapper"><img src="${avatarUrl}" class="podium-avatar"></div><div class="podium-medal">${medal}</div><div class="podium-info"><span class="podium-name">${p.username}</span><span class="podium-count">${p.count} отчетов</span><span class="podium-title">${title}</span></div>`;
                podium.appendChild(div);
            });
            container.appendChild(podium);
        } catch(e) { console.error(e); }
    };

    // --- ЗАГРУЗКА ФАЙЛОВ ---
    const setupUpload = (zoneId, inputId, previewId) => {
        const zone = document.getElementById(zoneId), input = document.getElementById(inputId), preview = document.getElementById(previewId);
        let files = [];
        if(!zone || !input || !preview) return { get: () => [], clear: () => {} };
        zone.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('remove-preview')) input.click(); });
        input.addEventListener('change', (e) => handleFiles(e.target.files));
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
        document.addEventListener('paste', (e) => {
            if (zone.offsetParent === null) return;
            const items = e.clipboardData.items;
            let pasted = [];
            for (let item of items) if (item.type.indexOf('image') !== -1) pasted.push(item.getAsFile());
            if(pasted.length > 0) { e.preventDefault(); handleFiles(pasted); }
        });
        function handleFiles(newFiles) {
            Array.from(newFiles).forEach(file => {
                if (file.type.startsWith('image/')) {
                    if (files.length >= 5) return alert('Максимум 5 скриншотов.');
                    files.push(file);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const div = document.createElement('div');
                        div.className = 'preview-item';
                        div.innerHTML = `<img src="${e.target.result}"><button type="button" class="remove-preview">✖</button>`;
                        preview.appendChild(div);
                        div.querySelector('.remove-preview').onclick = (ev) => { ev.stopPropagation(); files = files.filter(f => f !== file); div.remove(); };
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        return { get: () => files, clear: () => { files = []; preview.innerHTML = ''; } };
    };

    const jobUpload = setupUpload('job-file-zone', 'job-file', 'job-preview-container');
    const compUpload = setupUpload('comp-file-zone', 'comp-file', 'comp-preview-container');
    const repUpload = setupUpload('rep-file-zone', 'rep-file', 'rep-preview-container');
    const newsUpload = setupUpload('news-file-zone', 'news-image', 'news-preview-container');

    // --- ОТПРАВКА ФОРМ ---
    const submitForm = (formId, apiUrl, getData, upload) => {
        const form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUser.username) return alert('Войдите!');
            const files = upload.get();
            if (files.length === 0 && formId !== 'add-news-form') return alert('Нужны скриншоты!');
            if (!confirm('Отправить?')) return;
            const data = getData();
            if (formId === 'job-form') data.date = getFormattedDate();
            if (formId === 'complaint-form') data.date = getFormattedDate();
            if (formId === 'report-form') { data.date = getFormattedDate(); data.week = getWeekRange(); }
            if (formId === 'add-news-form') {
                if (files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (e) => { data.image = e.target.result; sendData(apiUrl, data, form, upload); };
                    reader.readAsDataURL(files[0]);
                } else { data.image = null; sendData(apiUrl, data, form, upload); }
                return;
            }
            const base64Images = [];
            let processed = 0;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    base64Images.push(e.target.result);
                    processed++;
                    if (processed === files.length) { data.images = base64Images; sendData(apiUrl, data, form, upload); }
                };
                reader.readAsDataURL(file);
            });
        });
    };

    const sendData = async (url, data, form, upload) => {
        try {
            const result = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
            if (result.success) {
                alert('Успешно!');
                form.reset(); upload.clear();
                if(document.getElementById('job-date')) document.getElementById('job-date').value = getFormattedDate();
                if(document.getElementById('comp-date')) document.getElementById('comp-date').value = getFormattedDate();
                if(document.getElementById('rep-date')) document.getElementById('rep-date').value = getFormattedDate();
                if(document.getElementById('rep-week')) document.getElementById('rep-week').value = getWeekRange();
                if (url === '/api/staff/report') switchStaffSub('stats');
                if (url === '/api/leader/news/add') { loadManageNews(); document.getElementById('news-preview-container').innerHTML = ''; }
            } else alert('Ошибка: ' + result.error);
        } catch (err) { alert('Ошибка сети'); }
    };

    submitForm('job-form', '/api/apply', () => ({ name: document.getElementById('name').value, discord: document.getElementById('discord').value, static: document.getElementById('static').value, about: document.getElementById('about').value }), jobUpload);
    submitForm('complaint-form', '/api/complaint', () => ({ compName: document.getElementById('comp-name').value, compTarget: document.getElementById('comp-target').value, compReason: document.getElementById('comp-reason').value }), compUpload);
    submitForm('report-form', '/api/staff/report', () => ({ type: document.getElementById('rep-type').value, text: document.getElementById('rep-text').value }), repUpload);

    // --- НОВОСТИ ---
    const loadNews = async () => {
        const container = document.getElementById('news-grid');
        try {
            let news = await (await fetch('/api/news')).json();
            news.sort((a, b) => b.id - a.id);
            container.innerHTML = '';
            if(news.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Нет новостей.</p>'; return; }
            news.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'news-card';
                div.onclick = () => window.openNews(item.title, item.text, item.tag, item.date, item.image);
                div.innerHTML = `<div class="news-card-image"><img src="${item.image || 'img/hospital.jpg'}"></div><div class="news-content"><span class="news-tag">${item.tag}</span><h3 class="news-title">${item.title}</h3><p class="news-excerpt">${item.text}</p><div class="news-footer"><span class="news-date">${item.date}</span><span style="color: var(--accent); font-weight: 600;">Читать →</span></div></div>`;
                container.appendChild(div);
                if (typeof gsap !== 'undefined') gsap.from(div, { y: 30, opacity: 0, duration: 0.6, delay: index * 0.1, ease: "power3.out" });
            });
        } catch(e) { container.innerHTML = '<p style="color:red;">Ошибка.</p>'; }
    };

    const loadManageNews = async () => {
        const container = document.getElementById('manage-news-list');
        try {
            const news = await (await fetch('/api/news')).json();
            container.innerHTML = '';
            news.forEach(item => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.innerHTML = `<h4>${item.title} <span style="color:var(--accent); font-size:12px;">[${item.tag}]</span></h4><p>${item.text.substring(0, 80)}...</p><button class="btn btn--outline" onclick="deleteNews('${item.id}')" style="margin-top: 10px;">Удалить</button>`;
                container.appendChild(div);
            });
        } catch(e) { console.error(e); }
    };

    const addNewsForm = document.getElementById('add-news-form');
    if(addNewsForm) {
        addNewsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const files = newsUpload.get();
            const data = { title: document.getElementById('news-title').value, text: document.getElementById('news-text').value, tag: document.getElementById('news-tag').value, date: new Date().toLocaleDateString('ru-RU'), image: null };
            if (files.length > 0) {
                const reader = new FileReader();
                reader.onload = async (event) => { data.image = event.target.result; await sendNewsData(data); };
                reader.readAsDataURL(files[0]);
            } else await sendNewsData(data);
        });
    }

    async function sendNewsData(data) {
        try {
            if ((await fetch('/api/leader/news/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).ok) {
                alert('Опубликовано!'); document.getElementById('add-news-form').reset(); newsUpload.clear(); loadManageNews();
            } else alert('Ошибка.');
        } catch (err) { alert('Ошибка сети'); }
    }

    window.deleteNews = async (id) => {
        if(!confirm('Удалить?')) return;
        if ((await fetch('/api/leader/news/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newsId: id }) })).ok) { alert('Удалено'); loadManageNews(); }
    };

    // --- ПРОВЕРКА ОТЧЕТОВ ---
    const loadPendingReports = async () => {
        const container = document.getElementById('pending-reports-list');
        try {
            const reports = await (await fetch('/api/staff/pending-reports')).json();
            window.allReportsData = reports;
            if (reports.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);">Пусто.</p>'; return; }
            container.innerHTML = '';
            reports.forEach(rep => {
                const div = document.createElement('div');
                div.className = 'report-item'; div.style.cursor = 'pointer';
                div.onclick = (e) => { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') window.openScreenshots(rep.id, `Скриншоты: ${rep.type}`); };
                div.innerHTML = `<h4>${rep.type} от ${rep.username}</h4><p>${rep.text}</p><p style="font-size:12px; color:var(--text-muted);">${rep.date || ''} | ${rep.week || ''}</p><div class="report-actions"><input type="number" id="reward-${rep.id}" value="100"><button class="btn btn--success" onclick="approveReport('${rep.id}')">Одобрить</button><input type="text" class="reject-input" id="reason-${rep.id}" placeholder="Причина"><button class="btn btn--outline" onclick="rejectReport('${rep.id}')">Отклонить</button></div>`;
                container.appendChild(div);
            });
        } catch (e) { container.innerHTML = '<p style="color:red;">Ошибка.</p>'; }
    };

    window.approveReport = async (id) => {
        const amount = document.getElementById(`reward-${id}`).value;
        if ((await fetch('/api/staff/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: id, action: 'approve', amount: amount }) })).ok) { alert('Одобрено!'); loadPendingReports(); }
    };

    window.rejectReport = async (id) => {
        const reason = document.getElementById(`reason-${id}`).value;
        if(!reason) return alert('Причина?');
        if ((await fetch('/api/staff/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: id, action: 'reject', reason: reason }) })).ok) { alert('Отклонено.'); loadPendingReports(); }
    };

    // --- УПРАВЛЕНИЕ МАГАЗИНОМ ---
    const loadManageShop = async () => {
        const container = document.getElementById('manage-shop-list');
        try {
            const items = await (await fetch('/api/staff/shop')).json();
            container.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.innerHTML = `<h4>${item.icon} ${item.name} - ${item.price} LSMC</h4><p>${item.desc}</p><button class="btn btn--outline" onclick="deleteShopItem('${item.id}')">Удалить</button>`;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    const addShopForm = document.getElementById('add-shop-item-form');
    if(addShopForm) {
        addShopForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { name: document.getElementById('new-item-name').value, price: document.getElementById('new-item-price').value, desc: document.getElementById('new-item-desc').value, icon: document.getElementById('new-item-icon').value || '🎁' };
            if ((await fetch('/api/leader/shop/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).ok) { alert('Добавлено!'); addShopForm.reset(); loadManageShop(); }
        });
    }

    window.deleteShopItem = async (id) => {
        if(!confirm('Удалить?')) return;
        if ((await fetch('/api/leader/shop/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: id }) })).ok) { alert('Удалено'); loadManageShop(); }
    };

    // --- ЗАКАЗЫ ---
    const loadOrders = async () => {
        const container = document.getElementById('orders-list');
        try {
            const orders = await (await fetch('/api/staff/orders')).json();
            if(orders.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);">Пусто.</p>'; return; }
            container.innerHTML = '';
            orders.forEach(o => {
                const div = document.createElement('div');
                div.className = 'report-item';
                let sT = o.status === 'pending' ? 'Ожидает' : o.status === 'issued' ? 'Выдано' : 'Отклонено';
                let sC = o.status === 'pending' ? 'var(--gold)' : o.status === 'issued' ? 'var(--success)' : 'var(--accent)';
                div.innerHTML = `<h4>${o.itemName} от ${o.username} <span style="color:${sC};">[${sT}]</span></h4><p>${o.price} LSMC</p>${o.reason ? `<p style="color:var(--accent);">Причина: ${o.reason}</p>` : ''}<div class="report-actions">${o.status === 'pending' ? `<button class="btn btn--success" onclick="issueOrder('${o.id}', 'issued')">Выдать</button><input type="text" class="reject-input" id="reason-order-${o.id}" placeholder="Причина"><button class="btn btn--outline" onclick="issueOrder('${o.id}', 'rejected')">Отклонить</button>` : ''}</div>`;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    window.issueOrder = async (id, action) => {
        const reasonInput = document.getElementById(`reason-order-${id}`);
        const reason = reasonInput ? reasonInput.value : '';
        if ((await fetch('/api/staff/order/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id, action: action, reason: reason }) })).ok) { alert('Обновлено'); loadOrders(); }
    };

    // --- МОИ ОТЧЕТЫ / ЗАКАЗЫ ---
    const loadMyReports = async () => {
        const container = document.getElementById('my-reports-list');
        try {
            const reports = await (await fetch('/api/staff/my-reports')).json();
            window.allReportsData = reports;
            if (reports.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);">Пусто.</p>'; return; }
            container.innerHTML = '';
            reports.forEach(rep => {
                const div = document.createElement('div');
                div.className = 'report-item'; div.style.cursor = 'pointer';
                div.onclick = () => window.openScreenshots(rep.id, `Скриншоты: ${rep.type}`);
                let sT = rep.status === 'pending' ? 'На проверке' : rep.status === 'approved' ? 'Одобрен' : 'Отклонен';
                let sC = rep.status === 'pending' ? 'var(--gold)' : rep.status === 'approved' ? 'var(--success)' : 'var(--accent)';
                div.innerHTML = `<h4>${rep.type} <span style="color:${sC};">[${sT}]</span></h4><p>${rep.text}</p><p style="font-size:12px; color:var(--text-muted);">${rep.date || ''} | ${rep.week || ''}</p>${rep.status === 'rejected' && rep.reason ? `<p style="color:var(--accent);">Причина: ${rep.reason}</p>` : ''}`;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    const loadMyOrders = async () => {
        const container = document.getElementById('my-orders-list');
        try {
            const orders = await (await fetch('/api/staff/my-orders')).json();
            if (orders.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);">Пусто.</p>'; return; }
            container.innerHTML = '';
            orders.forEach(o => {
                const div = document.createElement('div');
                div.className = 'report-item';
                let sT = o.status === 'pending' ? 'Ожидает' : o.status === 'issued' ? 'Выдано' : 'Отклонено';
                let sC = o.status === 'pending' ? 'var(--gold)' : o.status === 'issued' ? 'var(--success)' : 'var(--accent)';
                div.innerHTML = `<h4>${o.itemName} <span style="color:${sC};">[${sT}]</span></h4><p>${o.price} LSMC</p><p style="font-size:12px; color:var(--text-muted);">${new Date(o.timestamp).toLocaleString()}</p>`;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    // --- БАЗА ДАННЫХ ---
    let allUsers = [];
    let currentEditUser = null;

    const loadDatabase = async () => {
        const tbody = document.getElementById('db-table-body');
        if (!tbody) return;
        try {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Загрузка...</td></tr>';
            const res = await fetch('/api/leader/users');
            if (!res.ok) throw new Error('Ошибка сервера');
            allUsers = await res.json();
            renderDbTable(allUsers);
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Ошибка: ${e.message}</td></tr>`;
        }
    };

    const renderDbTable = (users) => {
        const tbody = document.getElementById('db-table-body');
        tbody.innerHTML = '';
        if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="5">Не найдены</td></tr>'; return; }
        users.forEach(u => {
            const tr = document.createElement('tr');
            const avatarUrl = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
            let deptClass = 'db-dept--staff';
            if (u.rankWeight === 100) deptClass = 'db-dept--leader';
            else if (u.rankWeight === 90) deptClass = 'db-dept--deputy';
            else if (u.rankWeight === 80) deptClass = 'db-dept--head';
            else if (u.rankWeight === 70) deptClass = 'db-dept--dep-head';
            else if (u.rankWeight === 60) deptClass = 'db-dept--high';
            let medalHtml = u.rankWeight === 80 ? (u.department.includes('ОК') ? '🥇' : u.department.includes('SMPD') ? '🥈' : '🥉') : '';
            const weekPercent = Math.min((u.weekActivity / 10) * 100, 100);
            let barColor = u.weekActivity === 0 ? 'rgba(255,255,255,0.1)' : u.weekActivity < 3 ? 'var(--gold)' : 'var(--success)';
            tr.innerHTML = `<td><div class="db-user-cell"><img src="${avatarUrl}" class="db-avatar"><div class="db-user-info"><span class="db-username">${u.username} ${medalHtml}</span><span class="db-discord-tag">@${u.discordTag}</span><span class="db-dept ${deptClass}">${u.department}</span></div></div></td><td><span class="db-balance">${u.balance} LSMC</span></td><td><span class="db-earned">${u.totalEarned} LSMC</span></td><td><div class="activity-wrapper"><div class="activity-info"><span>${u.weekActivity} нед.</span><span>${u.monthActivity} мес.</span></div><div class="activity-bar-bg"><div class="activity-bar-fill" style="width: ${weekPercent}%; background: ${barColor};"></div></div></div></td><td style="text-align: right;"><button class="btn-manage" onclick="openUserManage('${u.id}')">Управление</button></td>`;
            tbody.appendChild(tr);
        });
    };

    document.getElementById('db-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderDbTable(allUsers.filter(u => u.username.toLowerCase().includes(query) || u.id.includes(query)));
    });

    window.openUserManage = (userId) => {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;
        currentEditUser = user;
        document.getElementById('manage-user-name').textContent = user.username;
        document.getElementById('manage-warn-count').textContent = user.warnings;
        document.getElementById('manage-amount').value = '';
        document.getElementById('manage-cid').value = user.cid || '';
        document.getElementById('user-manage-modal').style.display = 'flex';
    };

    document.querySelector('.close-user-modal')?.addEventListener('click', () => document.getElementById('user-manage-modal').style.display = 'none');

    window.manageBalance = async (action) => {
        if (!currentEditUser) return;
        const amount = document.getElementById('manage-amount').value;
        if (!amount || amount <= 0) return alert('Введите сумму!');
        const data = await (await fetch('/api/leader/users/balance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentEditUser.id, amount, action }) })).json();
        if (data.success) { alert(`Новый баланс: ${data.newBalance}`); document.getElementById('manage-amount').value = ''; loadDatabase(); }
        else alert('Ошибка: ' + data.error);
    };

    window.manageWarn = async (action) => {
        if (!currentEditUser) return;
        const data = await (await fetch('/api/leader/users/warn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentEditUser.id, action }) })).json();
        if (data.success) { currentEditUser.warnings = data.warnings; document.getElementById('manage-warn-count').textContent = data.warnings; loadDatabase(); }
        else alert('Ошибка: ' + data.error);
    };

    window.manageCid = async () => {
        if (!currentEditUser) return;
        const cid = document.getElementById('manage-cid').value.trim();
        const data = await (await fetch('/api/leader/users/cid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentEditUser.id, cid }) })).json();
        if (data.success) { alert('CID обновлен!'); currentEditUser.cid = data.cid; loadDatabase(); }
        else alert('Ошибка: ' + data.error);
    };

    // --- ЛОГИ ---
    const loadLogs = async () => {
        const container = document.getElementById('logs-container');
        if (!container) return;
        
        try {
            // Загружаем сами логи
            const logsRes = await fetch('/api/leader/logs');
            const logs = await logsRes.json();

            // Загружаем ВСЕ отчеты, чтобы потом можно было открыть скриншоты из логов
            if (currentUser && currentUser.isLeader) {
                 const reportsRes = await fetch('/api/staff/all-reports');
                 const reports = await reportsRes.json();
                 allReportsCache = reports; // Сохраняем в кеш для функции openScreenshots
            }

            container.innerHTML = '';
            
            if (logs.length === 0) { 
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">За эту неделю действий не было.</p>'; 
                return; 
            }

            logs.forEach(log => {
                const date = new Date(log.timestamp);
                const dateStr = date.toLocaleDateString('ru-RU');
                const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                
                const div = document.createElement('div');
                div.className = 'log-item';
                
                // Если есть ID отчета, делаем лог кликабельным
                if (log.reportId) {
                    div.classList.add('clickable');
                    div.title = "Нажмите, чтобы посмотреть скриншоты отчета";
                    div.onclick = () => window.openScreenshots(log.reportId, 'Просмотр отчета из лога');
                }

                div.innerHTML = `
                    <div class="log-time">${dateStr} <br> <span style="font-size:11px; opacity:0.7;">${timeStr}</span></div>
                    <div class="log-content">
                        <span class="log-action" data-action="${log.action || ''}">${log.action || 'Действие'}</span>
                        <span class="log-details">${log.details || ''}</span>
                    </div>
                    <div class="log-user">${log.username || 'Неизвестно'}</div>
                    ${log.reportId ? `<span class="log-eye-icon">👁️</span>` : ''}
                `;
                
                container.appendChild(div);
            });
        } catch (e) { 
            console.error(e);
            container.innerHTML = '<p style="color:red; text-align:center;">Ошибка загрузки логов</p>'; 
        }
    };

    // --- СОХРАНЕНИЕ CID ПОЛЬЗОВАТЕЛЕМ ---
    const saveCidBtn = document.getElementById('save-cid-btn');
    if (saveCidBtn) {
        saveCidBtn.addEventListener('click', async () => {
            const cid = document.getElementById('cid-input').value.trim();
            if (!cid || cid.length < 2) return alert('Введите корректный CID (например, D2LA)');
            
            const res = await fetch('/api/user/set-cid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cid })
            });
            
            if (res.ok) {
                alert('CID сохранен!');
                document.getElementById('cid-modal').style.display = 'none';
                window.location.reload();
            } else {
                alert('Ошибка сохранения');
            }
        });
    }
});