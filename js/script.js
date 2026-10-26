document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav__link");
    const sections = document.querySelectorAll(".page-section");

    let currentUser = null;
    let cart = [];
    let shopItems = [];

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

        const format = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}.${month}.${year}`;
        };
        return `${format(monday)} - ${format(sunday)}`;
    };

    // Устанавливаем даты, если элементы существуют
    if(document.getElementById('job-date')) document.getElementById('job-date').value = getFormattedDate();
    if(document.getElementById('comp-date')) document.getElementById('comp-date').value = getFormattedDate();
    if(document.getElementById('rep-date')) document.getElementById('rep-date').value = getFormattedDate();
    if(document.getElementById('rep-week')) document.getElementById('rep-week').value = getWeekRange();

    // --- МОДАЛЬНОЕ ОКНО НОВОСТЕЙ ---
    const newsModal = document.getElementById('news-modal');
    const closeNewsModal = document.querySelector('.close-news-modal');
    
    window.openNews = (title, text, tag, date, imageUrl) => {
        document.getElementById('news-modal-title').textContent = title;
        document.getElementById('news-modal-text').innerHTML = text.replace(/\n/g, '<br>');
        document.getElementById('news-modal-tag').textContent = tag;
        document.getElementById('news-modal-date').textContent = date;
        
        const imgElement = document.getElementById('news-modal-image');
        if (imgElement) {
            if (imageUrl) {
                imgElement.src = imageUrl;
                imgElement.style.display = 'block';
            } else {
                imgElement.style.display = 'none';
            }
        }
        
        newsModal.style.display = 'flex';
    };

    if (closeNewsModal) {
        closeNewsModal.addEventListener('click', () => newsModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => {
        if (e.target === newsModal) newsModal.style.display = 'none';
    });

    // --- МОДАЛЬНОЕ ОКНО ДЛЯ СКРИНШОТОВ ---
    const screenshotModal = document.getElementById('screenshot-modal');
    const screenshotContainer = document.getElementById('screenshot-container');
    const closeScreenshotModal = document.querySelector('.close-screenshot-modal');
    const screenshotModalTitle = document.getElementById('screenshot-modal-title');

    window.openScreenshots = (reportId, titleText) => {
        const report = window.allReportsData ? window.allReportsData.find(r => r.id === reportId) : null;
        if (!report || !report.images || report.images.length === 0) {
            return alert('К этому отчету нет скриншотов.');
        }

        screenshotModalTitle.textContent = titleText || 'Скриншоты отчета';
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

    if (closeScreenshotModal) {
        closeScreenshotModal.addEventListener('click', () => {
            screenshotModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === screenshotModal) screenshotModal.style.display = 'none';
    });

    // --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
    const switchTab = (targetId) => {
        sections.forEach(section => section.classList.remove("active"));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add("active");

        navLinks.forEach(link => {
            if (link.getAttribute("data-target") === targetId) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
        window.scrollTo(0, 0);
        
        if(targetId === 'staff-area') {
            loadStats();
            switchStaffSub('stats');
        }
        if(targetId === 'news') {
            loadNews();
        }
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
            if(currentUser && currentUser.isStaff) {
                switchTab('staff-area');
            } else {
                alert('У вас нет доступа к личному кабинету. Обратитесь к руководству LSMC для получения роли.');
            }
        });
    }

    fetch('/api/me')
        .then(response => response.json())
        .then(data => {
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
                    
                    if(data.isHighStaff) {
                        document.getElementById('menu-reviews').style.display = 'block';
                    }
                    if(data.isLeader) {
                        document.getElementById('menu-manage-news').style.display = 'block';
                        document.getElementById('menu-manage-shop').style.display = 'block';
                        document.getElementById('menu-orders').style.display = 'block';
                    }
                }
            }
        });

    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fetch('/api/logout').then(() => window.location.reload());
        });
    }

    // --- КОРЗИНА ---
    const cartModal = document.getElementById('cart-modal');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const closeModal = document.querySelector('.close-modal');
    const checkoutBtn = document.getElementById('checkout-btn');

    cartIcon.addEventListener('click', () => {
        renderCart();
        cartModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === cartModal) cartModal.style.display = 'none';
    });

    const updateCartCount = () => {
        cartCount.textContent = cart.length;
    };

    const renderCart = () => {
        cartItemsList.innerHTML = '';
        let total = 0;
        cart.forEach((item, index) => {
            total += item.price;
            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.innerHTML = `
                <span class="item-name">${item.name}</span>
                <span class="item-price">${item.price} LSMC</span>
                <button class="remove-item" onclick="removeFromCart(${index})">✖</button>
            `;
            cartItemsList.appendChild(div);
        });
        cartTotalPrice.textContent = total;
    };

    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        updateCartCount();
        renderCart();
    };

    window.addToCart = (itemId) => {
        if (!currentUser || !currentUser.isStaff) return alert('Войдите как сотрудник!');
        const item = shopItems.find(i => i.id === itemId);
        if (!item) return;
        cart.push(item);
        updateCartCount();
        alert(`Товар "${item.name}" добавлен в корзину!`);
        if (cartModal.style.display === 'flex') renderCart();
    };

    // --- ЗАГРУЗКА МАГАЗИНА ---
    const loadShop = async () => {
        const container = document.getElementById('shop-items-container');
        try {
            const res = await fetch('/api/staff/shop');
            shopItems = await res.json();
            container.innerHTML = '';
            shopItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'shop-item';
                div.innerHTML = `
                    <span class="shop-item__icon">${item.icon}</span>
                    <h4>${item.name}</h4>
                    <p>${item.desc}</p>
                    <div class="shop-item__price">${item.price} LSMC</div>
                    <button class="btn btn--success" onclick="addToCart('${item.id}')" style="width: 100%;">В корзину</button>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    // --- ОФОРМЛЕНИЕ ЗАКАЗА ---
    checkoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) return alert('Корзина пуста!');
        if (!currentUser || !currentUser.isStaff) return alert('Авторизуйтесь!');

        const total = cart.reduce((sum, item) => sum + item.price, 0);
        if (currentUser.balance < total) return alert('Недостаточно средств на балансе!');

        if (!confirm(`Оформить заказ на сумму ${total} LSMC?`)) return;

        try {
            const res = await fetch('/api/staff/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart })
            });
            const data = await res.json();
            if (data.success) {
                alert('Заказ успешно оформлен! Ожидайте выдачи.');
                cart = [];
                updateCartCount();
                cartModal.style.display = 'none';
                currentUser.balance = data.newBalance;
                userBalanceVal.textContent = data.newBalance;
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная'));
            }
        } catch (e) {
            alert('Ошибка сети');
        }
    });

    // --- ПЕРЕКЛЮЧЕНИЕ ПОДРАЗДЕЛОВ СОТРУДНИКА ---
    const staffSubSections = document.querySelectorAll(".staff-sub-section");
    const staffMenuLinks = document.querySelectorAll(".staff-menu-link");

    const switchStaffSub = (subId) => {
        staffSubSections.forEach(sec => sec.classList.remove("active"));
        const targetSub = document.getElementById(`sub-${subId}`);
        if (targetSub) targetSub.classList.add("active");

        staffMenuLinks.forEach(link => {
            if (link.getAttribute("data-sub") === subId) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
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
            const res = await fetch('/api/staff/stats');
            const data = await res.json();
            
            // Показываем имя пользователя
            if (currentUser && currentUser.username) {
                const statsUsername = document.getElementById('stats-username');
                if (statsUsername) statsUsername.textContent = currentUser.username;
            }

            // Показываем кнопку "Проверка отчетов", если есть права
            if (currentUser && currentUser.isHighStaff) {
                const reviewBtn = document.getElementById('qa-review-btn');
                if (reviewBtn) reviewBtn.style.display = 'flex';
            }

            // Функция для красивой анимации чисел
            const animateValue = (id, endValue, duration = 1000) => {
                const obj = document.getElementById(id);
                if (!obj) return;
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    // Плавное замедление в конце
                    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                    obj.textContent = Math.floor(easeOutQuart * endValue);
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        obj.textContent = endValue; // Устанавливаем точное значение в конце
                    }
                };
                window.requestAnimationFrame(step);
            };

            // Запускаем анимацию
            animateValue('stat-balance', data.balance);
            animateValue('stat-earned', data.totalEarned);
            animateValue('stat-total', data.totalReports);
            animateValue('stat-approved', data.approvedReports);

        } catch(e) { 
            console.error('Ошибка загрузки статистики:', e); 
        }
    };

    // --- ДОСКА ПОЧЕТА ---
    const loadLeaderboard = async () => {
        const container = document.getElementById('leaderboard-list');
        try {
            const res = await fetch('/api/staff/leaderboard');
            const data = await res.json();
            
            container.innerHTML = '';
            if(data.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Пока нет одобренных отчетов на этой неделе.</p>';
                return;
            }

            const places = [];
            if(data[1]) places.push({ ...data[1], class: 'second' });
            if(data[0]) places.push({ ...data[0], class: 'first' });
            if(data[2]) places.push({ ...data[2], class: 'third' });

            places.forEach(p => {
                const div = document.createElement('div');
                div.className = `podium-place ${p.class}`;
                
                let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
                if (p.avatar) {
                    avatarUrl = `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png`;
                }

                div.innerHTML = `
                    <img src="${avatarUrl}" alt="${p.username}" class="podium-avatar">
                    <span class="podium-name">${p.username}</span>
                    <span class="podium-score">${p.count} отчетов</span>
                    <span class="rank-icon">${p.class === 'first' ? '🥇' : p.class === 'second' ? '🥈' : '🥉'}</span>
                `;
                container.appendChild(div);
            });
        } catch(e) { console.error(e); }
    };

    // =========================================================================
    // --- УЛУЧШЕННАЯ ЗАГРУЗКА ФАЙЛОВ (Ctrl+V + Drag & Drop + Click) ---
    // =========================================================================
    const setupUpload = (zoneId, inputId, previewId) => {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        let files = [];

        if(!zone || !input || !preview) return { get: () => [], clear: () => {} };

        // Клик по зоне
        zone.addEventListener('click', (e) => { 
            if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('remove-preview')) {
                input.click(); 
            }
        });

        // Выбор через проводник
        input.addEventListener('change', (e) => handleFiles(e.target.files));

        // Drag & Drop
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => { 
            e.preventDefault(); 
            zone.classList.remove('dragover'); 
            handleFiles(e.dataTransfer.files); 
        });

        // Вставка через Ctrl+V (срабатывает только если зона загрузки видима на экране)
        document.addEventListener('paste', (e) => {
            // Проверяем, видима ли зона (offsetParent === null значит скрыта)
            if (zone.offsetParent === null) return;
            
            const items = e.clipboardData.items;
            let pasted = [];
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    pasted.push(item.getAsFile());
                }
            }
            if(pasted.length > 0) {
                e.preventDefault(); // Чтобы не вставлялось в текстовые поля
                handleFiles(pasted);
            }
        });

        function handleFiles(newFiles) {
            Array.from(newFiles).forEach(file => {
                if (file.type.startsWith('image/')) {
                    if (files.length >= 5) {
                        alert('Максимальное количество скриншотов — 5.');
                        return;
                    }
                    files.push(file);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const div = document.createElement('div');
                        div.className = 'preview-item';
                        div.innerHTML = `<img src="${e.target.result}"><button type="button" class="remove-preview">✖</button>`;
                        preview.appendChild(div);
                        
                        // Удаление превью
                        div.querySelector('.remove-preview').onclick = (ev) => {
                            ev.stopPropagation();
                            files = files.filter(f => f !== file);
                            div.remove();
                        };
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
    const newsUpload = setupUpload('news-file-zone', 'news-image', 'news-preview-container'); // Добавили для новостей

    // --- ОТПРАВКА ФОРМ ---
    const submitForm = (formId, apiUrl, getData, upload) => {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUser.username) return alert('Авторизуйтесь!');
            
            const files = upload.get();
            if (files.length === 0 && formId !== 'add-news-form') return alert('Прикрепите скриншоты!');
            if (files.length > 5) return alert('Максимум 5 скриншотов!');

            if (!confirm('Вы уверены, что хотите отправить эту форму?')) return;

            const data = getData();
            data.discord_user = currentUser.username;

            if (formId === 'job-form') data.date = getFormattedDate();
            if (formId === 'complaint-form') data.date = getFormattedDate();
            if (formId === 'report-form') {
                data.date = getFormattedDate();
                data.week = getWeekRange();
            }

            // Если это форма новостей, картинка берется как base64 (одна)
            if (formId === 'add-news-form') {
                if (files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        data.image = e.target.result;
                        sendData(apiUrl, data, form, upload);
                    };
                    reader.readAsDataURL(files[0]);
                } else {
                    data.image = null;
                    sendData(apiUrl, data, form, upload);
                }
                return;
            }

            // Для остальных форм - массив base64
            const base64Images = [];
            let processed = 0;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    base64Images.push(e.target.result);
                    processed++;
                    if (processed === files.length) {
                        data.images = base64Images;
                        sendData(apiUrl, data, form, upload);
                    }
                };
                reader.readAsDataURL(file);
            });
        });
    };

    const sendData = async (url, data, form, upload) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                alert('Успешно!');
                form.reset();
                upload.clear();
                if(document.getElementById('job-date')) document.getElementById('job-date').value = getFormattedDate();
                if(document.getElementById('comp-date')) document.getElementById('comp-date').value = getFormattedDate();
                if(document.getElementById('rep-date')) document.getElementById('rep-date').value = getFormattedDate();
                if(document.getElementById('rep-week')) document.getElementById('rep-week').value = getWeekRange();
                
                if (url === '/api/staff/report') switchStaffSub('stats');
                if (url === '/api/leader/news/add') {
                    loadManageNews();
                    // Очищаем превью новости
                    document.getElementById('news-preview-container').innerHTML = '';
                }
            } else {
                alert('Ошибка: ' + (result.error || 'Неизвестная'));
            }
        } catch (err) {
            alert('Ошибка сети');
        }
    };

    submitForm('job-form', '/api/apply', () => ({
        name: document.getElementById('name').value,
        discord: document.getElementById('discord').value,
        static: document.getElementById('static').value,
        about: document.getElementById('about').value,
    }), jobUpload);

    submitForm('complaint-form', '/api/complaint', () => ({
        compName: document.getElementById('comp-name').value,
        compTarget: document.getElementById('comp-target').value,
        compReason: document.getElementById('comp-reason').value,
    }), compUpload);

    submitForm('report-form', '/api/staff/report', () => ({
        type: document.getElementById('rep-type').value,
        text: document.getElementById('rep-text').value,
    }), repUpload);

    // --- НОВОСТИ ---
    const loadNews = async () => {
        const container = document.getElementById('news-grid');
        try {
            const res = await fetch('/api/news');
            let news = await res.json();
            
            // Сортируем новости: самые новые (по id, так как id = Date.now()) идут первыми
            news.sort((a, b) => b.id - a.id);

            container.innerHTML = '';
            
            if(news.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%; padding: 40px;">Пока нет новостей.</p>';
                return;
            }
            
            news.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'news-card';
                div.onclick = () => window.openNews(item.title, item.text, item.tag, item.date, item.image);
                
                // Если картинки нет, ставим заглушку
                const imageSrc = item.image ? item.image : 'img/hospital.jpg'; 

                div.innerHTML = `
                    <div class="news-card-image">
                        <img src="${imageSrc}" alt="Cover">
                    </div>
                    <div class="news-content">
                        <span class="news-tag">${item.tag}</span>
                        <h3 class="news-title">${item.title}</h3>
                        <p class="news-excerpt">${item.text}</p>
                        <div class="news-footer">
                            <span class="news-date">${item.date}</span>
                            <span style="color: var(--accent); font-weight: 600;">Читать →</span>
                        </div>
                    </div>
                `;
                container.appendChild(div);

                // Крутая анимация появления (по очереди)
                if (typeof gsap !== 'undefined') {
                    gsap.from(div, {
                        y: 30,
                        opacity: 0,
                        duration: 0.6,
                        delay: index * 0.1, // Задержка для эффекта "каскада"
                        ease: "power3.out"
                    });
                }
            });
        } catch(e) { 
            console.error(e); 
            container.innerHTML = '<p style="color:red; text-align:center;">Ошибка загрузки новостей.</p>';
        }
    };

    // --- УПРАВЛЕНИЕ НОВОСТЯМИ (ЛИДЕР) ---
    const loadManageNews = async () => {
        const container = document.getElementById('manage-news-list');
        try {
            const res = await fetch('/api/news');
            const news = await res.json();
            container.innerHTML = '';
            if(news.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);">Новостей пока нет.</p>';
                return;
            }
            news.forEach(item => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.innerHTML = `
                    <h4>${item.title} <span style="color: var(--accent); font-size: 12px;">[${item.tag}]</span></h4>
                    <p>${item.text.substring(0, 80)}...</p>
                    <button class="btn btn--outline" onclick="deleteNews('${item.id}')" style="margin-top: 10px;">Удалить</button>
                `;
                container.appendChild(div);
            });
        } catch(e) { console.error(e); }
    };

    // Форма добавления новостей
    const addNewsForm = document.getElementById('add-news-form');
    if(addNewsForm) {
        addNewsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const files = newsUpload.get();
            const data = {
                title: document.getElementById('news-title').value,
                text: document.getElementById('news-text').value,
                tag: document.getElementById('news-tag').value,
                date: new Date().toLocaleDateString('ru-RU'),
                image: null
            };
            
            if (files.length > 0) {
                // Берем только первую картинку
                const reader = new FileReader();
                reader.onload = async (event) => {
                    data.image = event.target.result;
                    await sendNewsData(data);
                };
                reader.readAsDataURL(files[0]);
            } else {
                await sendNewsData(data);
            }
        });
    }

    async function sendNewsData(data) {
        try {
            const res = await fetch('/api/leader/news/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert('Новость опубликована!');
                document.getElementById('add-news-form').reset();
                newsUpload.clear();
                loadManageNews();
            } else {
                alert('Ошибка при публикации');
            }
        } catch (err) {
            alert('Ошибка сети');
        }
    }

    window.deleteNews = async (id) => {
        if(!confirm('Удалить новость?')) return;
        const res = await fetch('/api/leader/news/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newsId: id })
        });
        if (res.ok) { alert('Новость удалена'); loadManageNews(); }
    };

    // --- ПРОВЕРКА ОТЧЕТОВ (ХАЙ СТАФФ) ---
    const loadPendingReports = async () => {
        const container = document.getElementById('pending-reports-list');
        try {
            const res = await fetch('/api/staff/pending-reports');
            const reports = await res.json();
            window.allReportsData = reports;

            if (reports.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Нет отчетов на проверке.</p>';
                return;
            }

            container.innerHTML = '';
            reports.forEach(rep => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.style.cursor = 'pointer';
                div.onclick = (e) => {
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                        window.openScreenshots(rep.id, `Скриншоты отчета: ${rep.type}`);
                    }
                };
                div.innerHTML = `
                    <h4>${rep.type} от ${rep.username}</h4>
                    <p>${rep.text}</p>
                    <p style="font-size: 12px; color: var(--text-muted);">Дата: ${rep.date || 'Не указана'} | Неделя: ${rep.week || 'Не указана'}</p>
                    <div class="report-actions">
                        <input type="number" id="reward-${rep.id}" value="100" title="Сумма награды">
                        <button class="btn btn--success" onclick="approveReport('${rep.id}')">Одобрить</button>
                        <input type="text" class="reject-input" id="reason-${rep.id}" placeholder="Причина отклонения">
                        <button class="btn btn--outline" onclick="rejectReport('${rep.id}')">Отклонить</button>
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Ошибка доступа</p>'; }
    };

    window.approveReport = async (id) => {
        const amount = document.getElementById(`reward-${id}`).value;
        const res = await fetch('/api/staff/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: id, action: 'approve', amount: amount })
        });
        if (res.ok) { alert('Одобрено!'); loadPendingReports(); }
    };

    window.rejectReport = async (id) => {
        const reason = document.getElementById(`reason-${id}`).value;
        if(!reason) return alert('Укажите причину отклонения!');
        const res = await fetch('/api/staff/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: id, action: 'reject', reason: reason })
        });
        if (res.ok) { alert('Отклонено.'); loadPendingReports(); }
    };

    // --- УПРАВЛЕНИЕ МАГАЗИНОМ (LEADER) ---
    const loadManageShop = async () => {
        const container = document.getElementById('manage-shop-list');
        try {
            const res = await fetch('/api/staff/shop');
            const items = await res.json();
            container.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.innerHTML = `
                    <h4>${item.icon} ${item.name} - ${item.price} LSMC</h4>
                    <p>${item.desc}</p>
                    <button class="btn btn--outline" onclick="deleteShopItem('${item.id}')">Удалить</button>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    const addShopForm = document.getElementById('add-shop-item-form');
    if(addShopForm) {
        addShopForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('new-item-name').value,
                price: document.getElementById('new-item-price').value,
                desc: document.getElementById('new-item-desc').value,
                icon: document.getElementById('new-item-icon').value || '🎁'
            };
            const res = await fetch('/api/leader/shop/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert('Товар добавлен!');
                addShopForm.reset();
                loadManageShop();
            }
        });
    }

    window.deleteShopItem = async (id) => {
        if(!confirm('Удалить товар?')) return;
        const res = await fetch('/api/leader/shop/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: id })
        });
        if (res.ok) { alert('Удалено'); loadManageShop(); }
    };

    // --- ЗАКАЗЫ (ДЛЯ ЛИДЕРА) ---
    const loadOrders = async () => {
        const container = document.getElementById('orders-list');
        try {
            const res = await fetch('/api/staff/orders');
            const orders = await res.json();
            
            if(orders.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Нет новых заказов.</p>';
                return;
            }

            container.innerHTML = '';
            orders.forEach(o => {
                const div = document.createElement('div');
                div.className = 'report-item';
                
                let statusText = '';
                let statusColor = '';
                if (o.status === 'pending') { statusText = 'Ожидает выдачи'; statusColor = 'var(--gold)'; }
                else if (o.status === 'issued') { statusText = 'Выдано'; statusColor = 'var(--success)'; }
                else if (o.status === 'rejected') { statusText = 'Отклонено'; statusColor = 'var(--accent)'; }

                div.innerHTML = `
                    <h4>${o.itemName} от ${o.username} <span style="color: ${statusColor}; font-size: 14px; margin-left: 10px;">[${statusText}]</span></h4>
                    <p>Стоимость: ${o.price} LSMC</p>
                    ${o.reason ? `<p style="color: var(--accent); font-size: 14px;"><b>Причина:</b> ${o.reason}</p>` : ''}
                    <div class="report-actions">
                        ${o.status === 'pending' ? `
                            <button class="btn btn--success" onclick="issueOrder('${o.id}', 'issued')">Выдать</button>
                            <input type="text" class="reject-input" id="reason-order-${o.id}" placeholder="Причина отклонения">
                            <button class="btn btn--outline" onclick="issueOrder('${o.id}', 'rejected')">Отклонить</button>
                        ` : ''}
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); }
    };

    window.issueOrder = async (id, action) => {
        const reasonInput = document.getElementById(`reason-order-${id}`);
        const reason = reasonInput ? reasonInput.value : '';
        const res = await fetch('/api/staff/order/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: id, action: action, reason: reason })
        });
        if (res.ok) { alert('Обновлено'); loadOrders(); }
    };

    // --- МОИ ОТЧЕТЫ ---
    const loadMyReports = async () => {
        const container = document.getElementById('my-reports-list');
        try {
            const res = await fetch('/api/staff/my-reports');
            const reports = await res.json();
            window.allReportsData = reports;

            if (reports.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Вы еще не сдавали отчеты.</p>';
                return;
            }

            container.innerHTML = '';
            reports.forEach(rep => {
                const div = document.createElement('div');
                div.className = 'report-item';
                div.style.cursor = 'pointer';
                div.onclick = () => window.openScreenshots(rep.id, `Скриншоты отчета: ${rep.type}`);
                
                let statusText = '';
                let statusColor = '';
                if (rep.status === 'pending') { statusText = 'На проверке'; statusColor = 'var(--gold)'; }
                else if (rep.status === 'approved') { statusText = 'Одобрен'; statusColor = 'var(--success)'; }
                else if (rep.status === 'rejected') { statusText = 'Отклонен'; statusColor = 'var(--accent)'; }

                div.innerHTML = `
                    <h4>${rep.type} <span style="color: ${statusColor}; font-size: 14px; margin-left: 10px;">[${statusText}]</span></h4>
                    <p>${rep.text}</p>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">Дата: ${rep.date || 'Не указана'} | Неделя: ${rep.week || 'Не указана'}</p>
                    ${rep.status === 'rejected' && rep.reason ? `<p style="color: var(--accent); font-size: 14px; margin-top: 5px;"><b>Причина:</b> ${rep.reason}</p>` : ''}
                    <p style="font-size: 12px; color: var(--accent); margin-top: 10px;">👁 Нажмите, чтобы посмотреть скриншоты</p>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); container.innerHTML = '<p style="color:red; text-align:center;">Ошибка загрузки</p>'; }
    };

    // --- МОИ ЗАКАЗЫ ---
    const loadMyOrders = async () => {
        const container = document.getElementById('my-orders-list');
        try {
            const res = await fetch('/api/staff/my-orders');
            const orders = await res.json();

            if (orders.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Вы еще не делали заказов.</p>';
                return;
            }

            container.innerHTML = '';
            orders.forEach(o => {
                const div = document.createElement('div');
                div.className = 'report-item';
                
                let statusText = '';
                let statusColor = '';
                if (o.status === 'pending') { statusText = 'Ожидает выдачи'; statusColor = 'var(--gold)'; }
                else if (o.status === 'issued') { statusText = 'Выдано'; statusColor = 'var(--success)'; }
                else if (o.status === 'rejected') { statusText = 'Отклонено'; statusColor = 'var(--accent)'; }

                div.innerHTML = `
                    <h4>${o.itemName} <span style="color: ${statusColor}; font-size: 14px; margin-left: 10px;">[${statusText}]</span></h4>
                    <p>Стоимость: ${o.price} LSMC</p>
                    ${o.status === 'rejected' && o.reason ? `<p style="color: var(--accent); font-size: 14px; margin-top: 5px;"><b>Причина:</b> ${o.reason}</p>` : ''}
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">Дата заказа: ${new Date(o.timestamp).toLocaleString()}</p>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error(e); container.innerHTML = '<p style="color:red; text-align:center;">Ошибка загрузки</p>'; }
    };
});