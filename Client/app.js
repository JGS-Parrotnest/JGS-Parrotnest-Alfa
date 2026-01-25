const HUB_URL = (typeof SERVER_BASE !== 'undefined'
    ? `${SERVER_BASE}/chatHub`
    : `${(window.__SERVER_BASE_DEFAULT__ || window.location.origin)}/chatHub`);
if (typeof window.resolveUrl === 'undefined') {
        window.resolveUrl = function(url) {
            if (!url) return null;
            if (url.startsWith('blob:') || url.startsWith('data:')) return url;
            try {
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    const target = new URL(url);
                    const current = new URL(window.location.origin);
                    if (target.hostname === 'localhost' || target.hostname === '0.0.0.0') {
                        if (window.location.protocol !== 'file:') {
                            target.hostname = current.hostname;
                            // Keep the port if it's different, otherwise might be defaulting
                        } else {
                            target.hostname = 'localhost';
                        }
                        return target.toString();
                    }
                    return url;
                }
            } catch (e) {
            }
            url = url.replace(/\\/g, '/');
            if (!url.startsWith('/')) url = '/' + url;
            
            // Explicitly handle the base URL to ensure we point to the API server
            let base = window.API_BASE_URL || window.SERVER_BASE;
            
            // If no global base is set, try to infer from window.location
            if (!base) {
                if (window.location.protocol === 'file:') {
                    base = 'http://localhost:6069'; // Default for local file dev
                } else {
                    // If running on port 80/443 or another port, assume the API is on the same host:port
                    // UNLESS we are explicitly told otherwise.
                    // But usually for this setup, client is just static files served by the backend?
                    // Or separate.
                    base = window.location.origin; 
                }
            }
            
            // If base ends with slash, remove it to avoid double slash
            if (base.endsWith('/')) base = base.slice(0, -1);
            
            return `${base}${url}`;
        };
    }

if (typeof window.showNotification === 'undefined') {
    window.showNotification = function(message, type = 'success') {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };
}

if (typeof window.handleApiError === 'undefined') {
    window.handleApiError = async function(response, defaultMessage = 'Wystąpił błąd') {
        const text = await response.text();
        let message = text;
        try {
            const json = JSON.parse(text);
            message = json.message || json.error || json.title || defaultMessage;
            if (json.errors) {
                 const details = Object.values(json.errors).flat().join(', ');
                 if (details) message += `: ${details}`;
            }
        } catch (e) {
            if (text.trim().startsWith('<')) {
                message = `${defaultMessage} (Status: ${response.status})`;
            }
        }
        showNotification(message, 'error');
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App initializing...");
    
    // Auto-scroll modals to top when opened
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (modal.classList.contains('show')) {
                        const body = modal.querySelector('.modal-body');
                        if (body) {
                            // Small timeout ensures layout is calculated
                            setTimeout(() => {
                                body.scrollTop = 0;
                            }, 10);
                        }
                    }
                }
            });
        });
        observer.observe(modal, { attributes: true });
    });

    // Ensure critical UI elements work immediately
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const accountLogoutBtn = document.getElementById('accountLogoutBtn');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    
    if (settingsButton && settingsModal) {
        settingsButton.addEventListener('click', async () => {
            settingsModal.classList.add('show');
            try {
                if (typeof loadUserData === 'function') await loadUserData();

                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const status = user.status || user.Status || 1;
                    const radio = document.querySelector(`input[name="status"][value="${status}"]`);
                    if (radio) radio.checked = true;
                }
            } catch (e) { console.error("Error loading user data", e); }

            const settingsTabButtons = settingsModal.querySelectorAll('.tab-button');
            const settingsTabContents = settingsModal.querySelectorAll('.tab-content');
            settingsTabButtons.forEach(btn => btn.classList.remove('active'));
            settingsTabContents.forEach(content => content.classList.remove('active'));
            const accountTabBtn = settingsModal.querySelector('.tab-button[data-tab="settings-account"]');
            const accountTabContent = document.getElementById('settings-accountTab');
            if (accountTabBtn) accountTabBtn.classList.add('active');
            if (accountTabContent) accountTabContent.classList.add('active');
        });
    }
    
    if (accountLogoutBtn) {
        accountLogoutBtn.addEventListener('click', () => {
            if (confirm('Czy na pewno chcesz się wylogować?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }
        });
    }

    if (closeSettingsModal && settingsModal) {
        closeSettingsModal.addEventListener('click', () => settingsModal.classList.remove('show'));
    }

    // Global keydown listener for quick reply (Type to Focus)
    document.addEventListener('keydown', (e) => {
        // Ignore if focus is already on an input, textarea or contenteditable element
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
            return;
        }
        // Ignore if modifier keys are pressed
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }
        
        // Check if the key is a printable character (length 1) or specific keys user asked for
        // User asked for '/' or letters. We'll support all printable characters for better UX.
        // Prevent activation on functional keys like F1-F12, Escape, etc. which have length > 1 usually.
        if (e.key && e.key.length === 1) {
             const messageInput = document.getElementById('messageInput');
             if (messageInput) {
                 messageInput.focus();
                 // We don't preventDefault() so the character gets typed into the input
             }
        }
    });

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Główna logika czatu
    (async function() {
        // Determine base URL and export it for resolveUrl
        const base = window.SERVER_BASE || window.location.origin;
        window.API_BASE_URL = base;
        // Use window.API_URL if defined
        const API_URL = window.API_URL || (base + '/api');
        
        let signalRAvailable = typeof signalR !== 'undefined';
        if (!signalRAvailable) {
            console.warn('SignalR library not loaded – funkcje czatu ograniczone, ale UI działa.');
            showNotification('Brak połączenia z serwerem czatu. Próba ponownego połączenia...', 'warning');
        }
        const token = localStorage.getItem('token');
        let user = null;
        const userStr = localStorage.getItem('user');
        
        if (userStr) {
            try {
                user = JSON.parse(userStr);
            } catch (e) {
                console.error('Error parsing user from localStorage', e);
            }
        }

        if (!token) {
            window.location.href = '/login.php';
            return;
        }

        if (!user) {
            try {
                const response = await fetch(`${API_URL}/users/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    user = await response.json();
                    localStorage.setItem('user', JSON.stringify(user));
                    console.log('User session recovered:', user);
                } else {
                    console.warn('Session expired or invalid');
                    localStorage.removeItem('token');
                    window.location.href = '/login.php';
                    return;
                }
            } catch (e) {
                console.error('Network error recovering session:', e);
                // In offline mode, we might want to let them through if we had cached data,
                // but here we have no user data. 
                // We can show a retry screen or just redirect.
                 document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#000;color:#ff3333;font-family:monospace;padding:20px;text-align:center;">
                    <h2 style="font-size:2em;margin-bottom:20px;">⛔ BŁĄD POŁĄCZENIA</h2>
                    <p style="color:white;margin-bottom:20px;">Nie udało się odzyskać sesji użytkownika.</p>
                    <button onclick="window.location.reload()" style="padding:12px 24px;background:#333;border:1px solid #555;color:white;cursor:pointer;font-weight:bold;border-radius:4px;">SPRÓBUJ PONOWNIE</button>
                    <button onclick="window.location.href='/login.php'" style="padding:12px 24px;background:#cc3300;border:none;color:white;cursor:pointer;font-weight:bold;border-radius:4px;margin-left:10px;">ZALOGUJ PONOWNIE</button>
                </div>
            `;
            return;
            }
        }
        console.log('User logged in, updating UI:', user);
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) {
            userNameEl.textContent = user.username || user.userName || user.email || 'Użytkownik';
        }
        
        if (userAvatarEl) {
            const uAv = user.avatarUrl || user.AvatarUrl;
            if (uAv) {
                userAvatarEl.style.backgroundImage = `url('${resolveUrl(uAv)}')`;
                userAvatarEl.style.backgroundSize = 'cover';
                userAvatarEl.textContent = '';
            } else {
                const nameForAvatar = user.username || user.userName || user.email || '?';
                userAvatarEl.textContent = nameForAvatar.charAt(0).toUpperCase();
                userAvatarEl.style.backgroundImage = '';
                userAvatarEl.style.display = 'flex';
                userAvatarEl.style.alignItems = 'center';
                userAvatarEl.style.justifyContent = 'center';
            }
        }

        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
        let selectedImageFile = null;
        let pendingGroupAvatarBlob = null;
        let currentChatId = null;
        let currentChatType = 'global';
        let friends = [];
        let pendingRequests = [];
        let groups = [];
        let peerConnection = null;
        let localStream = null;
        let remoteStream = null;
        const notificationSoundConfig = {
            original: { src: resolveUrl('parrot.mp3'), rate: 1.0 },
            '1.mp3': { src: resolveUrl('notificationsounds/1.mp3'), rate: 1.0 },
            '2.mp3': { src: resolveUrl('notificationsounds/2.mp3'), rate: 1.0 },
            '3.mp3': { src: resolveUrl('notificationsounds/3.mp3'), rate: 1.0 }
        };

        const storedSoundKey = localStorage.getItem('notificationSound') || 'original';
        const activeSoundKey = notificationSoundConfig[storedSoundKey] ? storedSoundKey : 'original';
        const notificationSound = new Audio(notificationSoundConfig[activeSoundKey].src);
        notificationSound.addEventListener('error', (e) => {
             console.warn('Notification sound failed to load:', e);
        });
        let originalTitle = document.title;
        let titleInterval = null;
        const globalChatItem = document.getElementById('globalChatItem') || document.querySelector('.chat-item:first-child');
        if (globalChatItem) {
            globalChatItem.addEventListener('click', () => {
                selectChat(null, 'Ogólny', null, 'global');
            });
        }
        const globalFolderHeader = document.getElementById('globalFolderHeader');
        const globalFolderBody = document.getElementById('globalFolderBody');
        if (globalFolderHeader && globalFolderBody) {
            globalFolderHeader.addEventListener('click', () => {
                const collapsed = globalFolderBody.classList.toggle('collapsed');
                if (collapsed) globalFolderHeader.classList.add('collapsed');
                else globalFolderHeader.classList.remove('collapsed');
            });
        }
        const friendsFolderHeader = document.getElementById('friendsFolderHeader');
        const friendsFolderBody = document.getElementById('friendsFolderBody');
        if (friendsFolderHeader && friendsFolderBody) {
            friendsFolderHeader.addEventListener('click', () => {
                const collapsed = friendsFolderBody.classList.toggle('collapsed');
                if (collapsed) friendsFolderHeader.classList.add('collapsed');
                else friendsFolderHeader.classList.remove('collapsed');
            });
        }
        const groupsFolderHeader = document.getElementById('groupsFolderHeader');
        const groupsFolderBody = document.getElementById('groupsFolderBody');
        if (groupsFolderHeader && groupsFolderBody) {
            groupsFolderHeader.addEventListener('click', () => {
                const collapsed = groupsFolderBody.classList.toggle('collapsed');
                if (collapsed) groupsFolderHeader.classList.add('collapsed');
                else groupsFolderHeader.classList.remove('collapsed');
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                document.title = originalTitle;
                if (titleInterval) {
                    clearInterval(titleInterval);
                    titleInterval = null;
                }
            }
        });
        if (signalRAvailable && typeof window.connection === 'undefined') {
            try {
                window.connection = new signalR.HubConnectionBuilder()
                    .withUrl(HUB_URL, {
                        accessTokenFactory: () => token
                    })
                    .withAutomaticReconnect()
                    .build();
            } catch (e) {
                console.error('SignalR build error:', e);
                showNotification('Błąd inicjalizacji połączenia.', 'error');
            }
        } else {
            console.log("SignalR connection already initialized");
        }
        loadFriends();
        loadGroups();
        loadPendingRequests();

        const connection = window.connection;
        const messageForm = document.getElementById('messageForm');
        const imageInput = document.getElementById('imageInput');
        const attachmentPreview = document.getElementById('attachmentPreview');
        const attachButton = document.getElementById('attachButton');
        const emojiButton = document.getElementById('emojiButton');
        const emojiPicker = document.getElementById('emojiPicker');
        const conversationSidebar = document.getElementById('conversationSidebar');
        const conversationInfoButton = document.getElementById('conversationInfoButton');
        const closeConversationSidebarButton = document.getElementById('closeConversationSidebarButton');
        const dashboardContainer = document.querySelector('.dashboard-container');
        const userStatusEl = document.getElementById('userStatus');
        const settingsNotificationsToggle = document.getElementById('settingsNotificationsToggle');
        
        // Notification sound radio logic
        const notificationSoundRadios = document.querySelectorAll('input[name="notificationSound"]');
        notificationSoundRadios.forEach(radio => {
            if (radio.value === activeSoundKey) {
                radio.checked = true;
            }
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    const key = radio.value;
                    if (notificationSoundConfig[key]) {
                        localStorage.setItem('notificationSound', key);
                        // Play preview
                        const cfg = notificationSoundConfig[key];
                        notificationSound.src = cfg.src;
                        notificationSound.playbackRate = cfg.rate;
                        notificationSound.currentTime = 0;
                        notificationSound.play().catch(e => console.log('Preview sound play error:', e));
                    }
                }
            });
        });

        let notificationsMuted = localStorage.getItem('notificationsMuted') === 'true';
        function updateNotificationsUI() {
            if (settingsNotificationsToggle) {
                settingsNotificationsToggle.textContent = notificationsMuted ? 'Powiadomienia wyłączone' : 'Powiadomienia włączone';
            }
        }
        updateNotificationsUI();
        if (settingsNotificationsToggle) {
            settingsNotificationsToggle.addEventListener('click', () => {
                notificationsMuted = !notificationsMuted;
                localStorage.setItem('notificationsMuted', notificationsMuted ? 'true' : 'false');
                updateNotificationsUI();
                showNotification(notificationsMuted ? 'Powiadomienia wyłączone' : 'Powiadomienia włączone', 'info');
            });
        }
        if (userStatusEl) {
            if (signalRAvailable) {
                userStatusEl.textContent = 'Online';
                userStatusEl.classList.remove('status-offline');
                userStatusEl.classList.add('status-online');
            } else {
                userStatusEl.textContent = 'Offline';
                userStatusEl.classList.remove('status-online');
                userStatusEl.classList.add('status-offline');
            }
        }
        if (attachButton && imageInput) {
            attachButton.addEventListener('click', () => {
                imageInput.click();
            });
        }
        if (emojiPicker) {
            const emojiChars = (
                "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😉 🙂 🙃 😍 😘 😗 😜 🤪 🤩 😎 😏 " +
                "😡 😠 😢 😭 😱 🤔 🙄 😴 😇 😈 👿 " +
                "😺 😸 😹 😻 🙀 😿 😾 " +
                "👍 👎 👊 🤝 🙌 👏 👋 🤚 ✋ 🤞 🤟 🤘 🙏 " +
                "❤️ 💔 💕 💖 💙 💚 💛 💜 🖤 💩 🔥 ⭐ ✨ 🎉 🎁 🎵 💀 🤡 🥳 🥺"
            ).split(" ");
            emojiChars.forEach(ch => {
                if (!ch) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = ch;
                btn.addEventListener('click', () => {
                    const input = document.getElementById('messageInput');
                    if (!input) return;
                    const start = input.selectionStart !== null ? input.selectionStart : input.value.length;
                    const end = input.selectionEnd !== null ? input.selectionEnd : input.value.length;
                    const before = input.value.slice(0, start);
                    const after = input.value.slice(end);
                    input.value = before + ch + after;
                    const pos = start + ch.length;
                    input.focus();
                    if (input.setSelectionRange) {
                        input.setSelectionRange(pos, pos);
                    }
                });
                emojiPicker.appendChild(btn);
            });
        }
        if (emojiButton && emojiPicker) {
            emojiButton.addEventListener('click', (e) => {
                e.stopPropagation();
                emojiPicker.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
                    emojiPicker.classList.remove('open');
                }
            });
        }
        const groupAvatarInput = document.getElementById('groupAvatarInput');
        const changeGroupAvatarBtn = document.getElementById('changeGroupAvatarBtn');
        const groupAvatarPreview = document.getElementById('groupAvatarPreview');
        if (changeGroupAvatarBtn && groupAvatarInput) {
            changeGroupAvatarBtn.addEventListener('click', () => {
                groupAvatarInput.click();
            });
        }
        if (groupAvatarPreview && groupAvatarInput) {
             groupAvatarPreview.addEventListener('click', () => {
                groupAvatarInput.click();
            });
        }
        if (groupAvatarInput && groupAvatarPreview) {
            groupAvatarInput.addEventListener('change', () => {
                if (groupAvatarInput.files && groupAvatarInput.files[0]) {
                     const file = groupAvatarInput.files[0];
                     const url = URL.createObjectURL(file);
                     groupAvatarPreview.style.backgroundImage = `url('${url}')`;
                     groupAvatarPreview.style.backgroundSize = 'cover';
                     groupAvatarPreview.style.backgroundPosition = 'center';
                     groupAvatarPreview.textContent = '';
                }
            });
        }
        window.logoAudio = window.logoAudio || new Audio(resolveUrl('parrot.mp3'));
        window.logoAudio.addEventListener('error', (e) => {
             // Suppress console spam for this specific easter egg
             console.warn('Easter egg sound failed to load:', e);
        }, { once: true });

        if (!window.logoAudioConfigured) {
            window.logoAudio.addEventListener('ended', () => {
                window.logoAudioPlaying = false;
                window.logoAudio.currentTime = 0;
            });
            window.logoAudioConfigured = true;
        }
        const logoContainer = document.getElementById('logoContainer');
        if (logoContainer) {
            logoContainer.onclick = () => {
                if (window.logoAudioPlaying) return;
                window.logoAudioPlaying = true;
                window.logoAudio.currentTime = 0;
                try {
                    const min = 0.9, max = 1.1;
                    window.logoAudio.playbackRate = min + Math.random() * (max - min);
                } catch {}
                window.logoAudio.play().catch(() => {
                    window.logoAudioPlaying = false;
                });
            };
        }
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    selectedImageFile = e.target.files[0];
                    if (attachmentPreview) {
                        const url = URL.createObjectURL(selectedImageFile);
                        const sizeKb = Math.max(1, Math.round(selectedImageFile.size / 1024));
                        attachmentPreview.className = 'attachment-preview visible';
                        attachmentPreview.innerHTML = `
                            <div class="attachment-preview-close" title="Usuń">×</div>
                            <img src="${url}" alt="Podgląd">
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; text-align: center;">
                                ${selectedImageFile.name} (${sizeKb} KB)
                            </div>
                        `;
                        attachmentPreview.style.display = 'block';

                        const removeBtn = attachmentPreview.querySelector('.attachment-preview-close');
                        if (removeBtn) {
                            removeBtn.addEventListener('click', (ev) => {
                                ev.stopPropagation(); 
                                selectedImageFile = null;
                                imageInput.value = '';
                                attachmentPreview.className = 'attachment-preview';
                                attachmentPreview.style.display = 'none';
                                attachmentPreview.innerHTML = '';
                            });
                        }
                    }
                }
            });
        }
        if (messageForm) {
            messageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                let imageUrl = null;
                if (selectedImageFile) {
                    const formData = new FormData();
                    formData.append('file', selectedImageFile);
                    try {
                        const response = await fetch(`${API_URL}/messages/upload`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            body: formData
                        });
                        if (response.ok) {
                            const data = await response.json();
                            imageUrl = data.url;
                            // Clean up preview
                            selectedImageFile = null;
                            imageInput.value = '';
                            if (attachmentPreview) {
                                attachmentPreview.className = 'attachment-preview';
                                attachmentPreview.style.display = 'none';
                                attachmentPreview.innerHTML = '';
                            }
                        } else {
                            console.error('Upload failed');
                            showNotification('Nie udało się wysłać obrazka.', 'error');
                            return;
                        }
                    } catch (err) {
                        console.error('Error uploading file:', err);
                        showNotification('Błąd podczas wysyłania pliku.', 'error');
                        return;
                    }
                }
                if (message || imageUrl) {
                    try {
                        if (!signalRAvailable || !connection || connection.state !== signalR.HubConnectionState.Connected) {
                            console.warn('SignalR not connected. State:', connection.state);
                            showNotification('Połączenie z serwerem nie jest aktywne. Poczekaj chwilę.', 'error');
                            return;
                        }
                        const senderName = user.username || user.userName || user.email || 'Nieznany';
                        const chatIdInt = currentChatId ? parseInt(currentChatId) : null;
                        if (currentChatType === 'group') {
                            await connection.invoke("SendMessage", senderName, message, imageUrl, null, chatIdInt);
                        } else if (currentChatType === 'private') {
                            await connection.invoke("SendMessage", senderName, message, imageUrl, chatIdInt, null);
                        } else {
                            await connection.invoke("SendMessage", senderName, message, imageUrl, null, null);
                        }
                        input.value = '';
                        selectedImageFile = null;
                        if (imageInput) imageInput.value = '';
                        if (attachmentPreview) {
                            attachmentPreview.style.display = 'none';
                            attachmentPreview.textContent = '';
                        }
                        if (conversationSidebar && conversationSidebar.classList.contains('open')) {
                            updateConversationSidebar();
                        }
                    } catch (err) {
                        console.error('Błąd wysyłania wiadomości:', err);
                        showNotification('Nie udało się wysłać wiadomości.', 'error');
                    }
                }
            });
        }

        connection.on("UserStatusChanged", (userId, status) => {
            console.log(`User ${userId} status changed: ${status}`);
            if (typeof status === 'boolean') {
                status = status ? 1 : 0;
            }
            
            // Update self status if matched
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (currentUser && (currentUser.id == userId || currentUser.Id == userId)) {
                const userStatusEl = document.getElementById('userStatus');
                if (userStatusEl) {
                    updateUserStatusUI(userStatusEl, status);
                }
            }

            const friendIndex = friends.findIndex(f => f.id == userId || f.Id == userId);
            if (friendIndex !== -1) {
                friends[friendIndex].status = status;
                friends[friendIndex].Status = status;
                friends[friendIndex].isOnline = (status > 0 && status !== 4); // For compatibility
                updateChatList();
            }
        });

        function updateUserStatusUI(el, status) {
            el.className = '';
            if (status == 1) { el.textContent = 'Online'; el.classList.add('status-online'); }
            else if (status == 2) { el.textContent = 'Zaraz wracam'; el.classList.add('status-away'); }
            else if (status == 3) { el.textContent = 'Nie przeszkadzać'; el.classList.add('status-dnd'); }
            else if (status == 4) { el.textContent = 'Niewidoczny'; el.classList.add('status-invisible'); }
            else { el.textContent = 'Offline'; el.classList.add('status-offline'); }
        }
        connection.on("GroupMembershipChanged", async (action, group) => {
            try {
                await loadGroups();
                if (action === 'added') {
                    showNotification(`Dołączono do grupy: ${group?.Name || group?.name}`, 'success');
                } else if (action === 'removed') {
                    showNotification(`Usunięto z grupy: ${group?.Name || group?.name}`, 'info');
                    const last = localStorage.getItem('lastChat');
                    if (last) {
                        const { id, type } = JSON.parse(last);
                        if (type === 'group' && id == group?.Id) {
                            selectChat(null, 'Ogólny', null, 'global');
                        }
                    }
                } else if (action === 'updated') {
                    showNotification(`Zaktualizowano grupę: ${group?.Name || group?.name}`, 'info');
                }
            } catch (e) {
                console.error('GroupMembershipChanged handler error', e);
            }
        });
        connection.on("ReceiveMessage", (senderId, senderUsername, message, imageUrl, receiverId, groupId, senderAvatarUrl) => {
            if (imageUrl) {
                imageUrl = resolveUrl(imageUrl);
            }
            let shouldShow = false;
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const currentUserId = currentUser.id || currentUser.Id;
            const isOwnMessage = parseInt(senderId) === parseInt(currentUserId);
            if (groupId) {
                if (currentChatType === 'group' && currentChatId == groupId) {
                    shouldShow = true;
                }
            } else if (receiverId) {
                if (currentChatType === 'private') {
                     if (isOwnMessage) {
                         shouldShow = (currentChatId == receiverId);
                     } else {
                         shouldShow = (currentChatId == senderId);
                     }
                }
            } else {
                if (currentChatType === 'global') {
                    shouldShow = true;
                }
            }
            if (!isOwnMessage) {
                if (!notificationsMuted) {
                    try {
                        const key = localStorage.getItem('notificationSound') || 'original';
                        const cfg = notificationSoundConfig[key] || notificationSoundConfig.original;
                        notificationSound.src = cfg.src;
                        const min = cfg.rate * 0.9;
                        const max = cfg.rate * 1.1;
                        notificationSound.playbackRate = min + Math.random() * (max - min);
                    } catch {}
                    notificationSound.play().catch(e => console.log('Sound play error:', e));
                }
                if (document.hidden || !shouldShow) {
                    if (Notification.permission === "granted") {
                        new Notification(`Nowa wiadomość od ${senderUsername}`, {
                            body: message || (imageUrl ? "Przesłano zdjęcie" : "Nowa wiadomość"),
                            icon: 'parrot.png'
                        });
                    }
                    if (document.hidden) {
                        if (!titleInterval) {
                            let isOriginal = false;
                            titleInterval = setInterval(() => {
                                document.title = isOriginal ? originalTitle : "Nowa wiadomość!";
                                isOriginal = !isOriginal;
                            }, 1000);
                        }
                    }
                }
            }
            if (!shouldShow) return;

            const messagesContainer = document.getElementById("chat-messages");
            let isContinuation = false;
            const now = new Date();

            // Check if this message is a continuation of the previous one
            if (messagesContainer && messagesContainer.lastElementChild) {
                const lastWrapper = messagesContainer.lastElementChild;
                const lastSenderId = lastWrapper.dataset.senderId;
                const lastTimestampStr = lastWrapper.dataset.timestamp;
                
                // We use loose equality to handle string/number differences
                if (lastSenderId && senderId && lastSenderId == senderId) {
                    const lastDate = lastTimestampStr ? new Date(lastTimestampStr) : null;
                    // Check if time difference is less than 60 seconds (60000 ms)
                    if (lastDate && (now - lastDate < 60000)) {
                        isContinuation = true;
                        // Hide timestamp of the previous message
                        const lastTime = lastWrapper.querySelector('.message-time');
                        if (lastTime) {
                            lastTime.style.display = 'none';
                        }
                        // Optional: Add class to previous wrapper if needed for styling
                        lastWrapper.classList.add('message-continuation-prev');
                    }
                }
            }

            const messageWrapper = document.createElement("div");
            messageWrapper.className = `message-wrapper ${isOwnMessage ? 'own-message' : ''}`;
            if (isContinuation) messageWrapper.classList.add('message-continuation');
            messageWrapper.dataset.senderId = senderId;
            messageWrapper.dataset.timestamp = now.toISOString();

            const row = document.createElement("div");
            row.className = "message-row";
            
            const avatarEl = document.createElement("div");
            avatarEl.className = "message-avatar";
            
            if (isContinuation) {
                // Keep the element for alignment but make it invisible
                avatarEl.style.visibility = 'hidden';
            } else {
                if (senderAvatarUrl) {
                    const url = resolveUrl(senderAvatarUrl);
                    avatarEl.style.backgroundImage = `url('${url}')`;
                    avatarEl.textContent = '';
                } else if (senderUsername) {
                    avatarEl.textContent = senderUsername.charAt(0).toUpperCase();
                }
            }

            const msgDiv = document.createElement("div");
            msgDiv.className = isOwnMessage ? "message sent" : "message received";
            
            // Only show sender name if it's not a continuation
            if (!isContinuation) {
                const senderName = document.createElement("div");
                senderName.className = "message-sender";
                senderName.textContent = senderUsername || 'Ty';
                msgDiv.appendChild(senderName);
            }

            if (imageUrl) {
                const img = document.createElement("img");
                img.src = imageUrl;
                img.className = "message-image";
                img.onclick = () => openLightbox(imageUrl);
                msgDiv.appendChild(img);
            }
            if (message) {
                const messageText = document.createElement("div");
                messageText.className = "message-text";
                
                // Link detection logic with Bubbles
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            // Escape HTML first to prevent XSS
            const escapedMessage = message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            
            // Split by URLs to handle text + links
            const parts = escapedMessage.split(urlRegex);
            
            messageText.innerHTML = ''; // Clear
            
            parts.forEach(part => {
                if (part.match(urlRegex)) {
                    // It's a URL
                    const url = part;
                    let domain = '';
                    try {
                        domain = new URL(url).hostname;
                    } catch (e) {
                        domain = 'Link';
                    }
                    
                    const card = document.createElement('a');
                    card.href = url;
                    card.target = "_blank";
                    card.rel = "noopener noreferrer";
                    card.className = "link-preview-card";
                    card.innerHTML = `
                        <div class="link-icon-container">🔗</div>
                        <div class="link-info">
                            <div class="link-title">${url}</div>
                            <div class="link-domain">${domain}</div>
                        </div>
                    `;
                    messageText.appendChild(card);
                } else {
                    // Text
                    if (part) {
                        const span = document.createElement('span');
                        span.innerHTML = part.replace(/\n/g, '<br>');
                        messageText.appendChild(span);
                    }
                }
            });
            
            msgDiv.appendChild(messageText);
            }
            const timestamp = document.createElement("div");
            timestamp.className = "message-time";
            timestamp.textContent = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            msgDiv.appendChild(timestamp);
            row.appendChild(avatarEl);
            row.appendChild(msgDiv);
            messageWrapper.appendChild(row);
            
            if (messagesContainer) {
                messagesContainer.appendChild(messageWrapper);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            if (conversationSidebar && conversationSidebar.classList.contains('open')) {
                updateConversationSidebar();
            }
        });
        connection.on("ReceiveSignal", async (user, signal) => {
            const signalData = JSON.parse(signal);
            console.log("Received signal from", user, signalData);
        });
        async function loadFriends() {
            try {
                const response = await fetch(`${API_URL}/friends`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    friends = await response.json();
                    updateChatList();
                } else {
                    await handleApiError(response, 'Błąd pobierania listy znajomych');
                }
            } catch (error) {
                console.error('Error loading friends:', error);
                showNotification('Brak połączenia z bazą lub serwerem (znajomi).', 'error');
            }
        }
        async function loadGroups() {
            try {
                const response = await fetch(`${API_URL}/groups`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    groups = await response.json();
                    updateChatList();
                } else {
                    await handleApiError(response, 'Błąd pobierania grup');
                }
            } catch (error) {
                console.error('Error loading groups:', error);
                showNotification('Brak połączenia z bazą lub serwerem (grupy).', 'error');
            }
        }
        function updateNotificationBadge() {
            const badge = document.getElementById('notificationBadge');
            if (!badge) return;
            const count = pendingRequests.length;
            if (count > 0) {
                badge.style.display = 'flex';
                if (count > 4) {
                    badge.textContent = '4+';
                } else {
                    badge.textContent = count;
                }
            } else {
                badge.style.display = 'none';
            }
        }
        async function loadPendingRequests() {
            try {
                const response = await fetch(`${API_URL}/friends/pending`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    pendingRequests = await response.json();
                    updateChatList();
                    updateNotificationBadge();
                    renderPendingRequestsModal();
                } else {
                    await handleApiError(response, 'Błąd pobierania zaproszeń');
                }
            } catch (error) {
                console.error('Error loading pending requests:', error);
                showNotification('Brak połączenia z bazą lub serwerem (zaproszenia).', 'error');
            }
        }
        async function acceptFriend(friendshipId) {
            try {
                const response = await fetch(`${API_URL}/friends/accept/${friendshipId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    loadPendingRequests();
                    loadFriends();
                } else {
                    showNotification('Nie udało się zaakceptować zaproszenia.', 'error');
                }
            } catch (error) {
                console.error('Error accepting friend:', error);
            }
        }
        async function rejectFriend(friendshipId) {
            if (!confirm('Czy na pewno chcesz odrzucić to zaproszenie?')) return;
            try {
                const response = await fetch(`${API_URL}/friends/${friendshipId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    loadPendingRequests();
                } else {
                    showNotification('Nie udało się odrzucić zaproszenia.', 'error');
                }
            } catch (error) {
                console.error('Error rejecting friend:', error);
            }
        }
        function updateChatList() {
            // Ensure we have the latest elements
            const chatList = document.querySelector('.chat-list');
            if (!chatList) {
                console.error("Chat list container not found!");
                return;
            }
            
            // Re-fetch elements by ID to ensure we have valid references if they were moved
            const globalFolder = document.getElementById('globalFolder');
            const globalFolderBody = document.getElementById('globalFolderBody');
            const globalChatItem = document.getElementById('globalChatItem');
            const friendsFolder = document.getElementById('friendsFolder');
            const friendsFolderBody = document.getElementById('friendsFolderBody');
            const groupsFolder = document.getElementById('groupsFolder');
            const groupsFolderBody = document.getElementById('groupsFolderBody');

            if (!globalFolder || !globalFolderBody || !globalChatItem) {
                 console.error("Global folder elements missing!");
                 return;
            }

            // Clear global folder body and re-add global chat item
            globalFolderBody.innerHTML = '';
            globalFolderBody.appendChild(globalChatItem);

            // Re-build chat list
            chatList.innerHTML = '';
            chatList.appendChild(globalFolder);
            if (friendsFolder) chatList.appendChild(friendsFolder);
            if (groupsFolder) chatList.appendChild(groupsFolder);

            // Note: Event listeners on folder headers (which are children of globalFolder etc.) 
            // should be preserved because we are moving the same DOM elements.

            if (pendingRequests.length > 0) {
                const pendingHeader = document.createElement('div');
                pendingHeader.textContent = 'Oczekujące zaproszenia';
                pendingHeader.style.padding = '10px 20px';
                pendingHeader.style.fontSize = '0.75rem';
                pendingHeader.style.fontWeight = 'bold';
                pendingHeader.style.color = 'var(--text-secondary)';
                pendingHeader.style.textTransform = 'uppercase';
                pendingHeader.style.letterSpacing = '1px';
                chatList.appendChild(pendingHeader);
                pendingRequests.forEach(req => {
                    const reqItem = document.createElement('div');
                    reqItem.className = 'chat-item pending-request';
                    reqItem.style.cursor = 'default';
                    reqItem.style.flexDirection = 'column';
                    reqItem.style.alignItems = 'flex-start';
                    reqItem.style.gap = '5px';
                    const headerDiv = document.createElement('div');
                    headerDiv.style.display = 'flex';
                    headerDiv.style.alignItems = 'center';
                    headerDiv.style.gap = '10px';
                    headerDiv.style.width = '100%';
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    if (req.avatarUrl) {
                        avatar.style.backgroundImage = `url('${resolveUrl(req.avatarUrl)}')`;
                        avatar.style.backgroundSize = 'cover';
                        avatar.style.backgroundPosition = 'center';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = req.username.charAt(0).toUpperCase();
                    }
                    const nameDiv = document.createElement('div');
                    nameDiv.style.fontWeight = 'bold';
                    nameDiv.textContent = req.username;
                    headerDiv.appendChild(avatar);
                    headerDiv.appendChild(nameDiv);
                    const actionsDiv = document.createElement('div');
                    actionsDiv.style.display = 'flex';
                    actionsDiv.style.gap = '10px';
                    actionsDiv.style.width = '100%';
                    actionsDiv.style.marginTop = '5px';
                    actionsDiv.style.paddingLeft = '50px';
                    const acceptBtn = document.createElement('button');
                    acceptBtn.textContent = 'Akceptuj';
                    acceptBtn.style.padding = '5px 10px';
                    acceptBtn.style.border = 'none';
                    acceptBtn.style.borderRadius = '4px';
                    acceptBtn.style.backgroundColor = 'var(--accent-green)';
                    acceptBtn.style.color = 'white';
                    acceptBtn.style.cursor = 'pointer';
                    acceptBtn.style.fontSize = '0.8rem';
                    acceptBtn.onclick = (e) => {
                        e.stopPropagation();
                        acceptFriend(req.id);
                    };
                    const rejectBtn = document.createElement('button');
                    rejectBtn.textContent = 'Odrzuć';
                    rejectBtn.style.padding = '5px 10px';
                    rejectBtn.style.border = '1px solid var(--error-color)';
                    rejectBtn.style.borderRadius = '4px';
                    rejectBtn.style.backgroundColor = 'transparent';
                    rejectBtn.style.color = 'var(--error-color)';
                    rejectBtn.style.cursor = 'pointer';
                    rejectBtn.style.fontSize = '0.8rem';
                    rejectBtn.onclick = (e) => {
                        e.stopPropagation();
                        rejectFriend(req.id);
                    };
                    actionsDiv.appendChild(acceptBtn);
                    actionsDiv.appendChild(rejectBtn);
                    reqItem.appendChild(headerDiv);
                    reqItem.appendChild(actionsDiv);
                    chatList.appendChild(reqItem);
                });
            }
            if (groups.length > 0 && groupsFolderBody) {
                groupsFolderBody.innerHTML = '';
                groups.forEach(group => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    chatItem.dataset.groupId = group.id;
                    if (currentChatType === 'group' && currentChatId == group.id) {
                        chatItem.classList.add('active');
                    }
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    {
                        const gAv = group.avatarUrl || group.AvatarUrl;
                        if (gAv) {
                            avatar.style.backgroundImage = `url('${resolveUrl(gAv)}')`;
                            avatar.style.backgroundSize = 'cover';
                            avatar.style.backgroundPosition = 'center';
                            avatar.textContent = '';
                        } else {
                            avatar.textContent = group.name.charAt(0).toUpperCase();
                            avatar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }
                    }
                    const chatInfo = document.createElement('div');
                    chatInfo.className = 'chat-info';
                    const h4 = document.createElement('h4');
                    h4.textContent = group.name;
                    chatInfo.appendChild(h4);
                    chatItem.appendChild(avatar);
                    chatItem.appendChild(chatInfo);
                    chatItem.addEventListener('click', () => {
                        const gAv = group.avatarUrl || group.AvatarUrl;
                        selectChat(group.id, group.name, gAv, 'group');
                    });
                    groupsFolderBody.appendChild(chatItem);
                });
            }
            if (friends.length > 0 && friendsFolderBody) {
                friendsFolderBody.innerHTML = '';
                friends.forEach(friend => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    chatItem.dataset.friendId = friend.id;
                    if (currentChatType === 'private' && currentChatId == friend.id) {
                        chatItem.classList.add('active');
                    }
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    {
                        const fAv = friend.avatarUrl || friend.AvatarUrl;
                        if (fAv) {
                            avatar.style.backgroundImage = `url('${resolveUrl(fAv)}')`;
                            avatar.style.backgroundSize = 'cover';
                            avatar.style.backgroundPosition = 'center';
                            avatar.textContent = '';
                        } else {
                            avatar.textContent = friend.username.charAt(0).toUpperCase();
                        }
                    }
                    const chatInfo = document.createElement('div');
                    chatInfo.className = 'chat-info';
                    const h4 = document.createElement('h4');
                    h4.textContent = friend.username;
                    chatInfo.appendChild(h4);
                    
                    const status = friend.status || friend.Status || (friend.isOnline ? 1 : 0);
                    // 1=Active, 2=Away, 3=DND, 4=Invisible(should look offline to others)
                    if (status > 0 && status != 4) {
                        const statusDot = document.createElement('span');
                        statusDot.className = 'status-dot';
                        statusDot.textContent = '●';
                        statusDot.style.marginLeft = '5px';
                        statusDot.style.fontSize = '12px';
                        
                        if (status == 1) {
                            statusDot.style.color = 'var(--accent-green)';
                            statusDot.title = 'Dostępny';
                        } else if (status == 2) {
                            statusDot.style.color = '#f1c40f';
                            statusDot.title = 'Zaraz wracam';
                        } else if (status == 3) {
                            statusDot.style.color = '#e74c3c';
                            statusDot.title = 'Nie przeszkadzać';
                        }
                        
                        h4.appendChild(statusDot);
                    }
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn-icon';
                    removeBtn.title = 'Usuń znajomego';
                    removeBtn.textContent = '×';
                    removeBtn.style.marginLeft = 'auto';
                    removeBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Usunąć znajomego ${friend.username}?`)) return;
                        try {
                            const response = await fetch(`${API_URL}/friends/${friend.id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (response.ok) {
                                showNotification('Znajomy usunięty.', 'success');
                                await loadFriends();
                                updateChatList();
                            } else {
                                await handleApiError(response, 'Nie udało się usunąć znajomego');
                            }
                        } catch (err) {
                            console.error('Error removing friend:', err);
                            showNotification('Wystąpił błąd.', 'error');
                        }
                    };
                    chatItem.appendChild(avatar);
                    chatItem.appendChild(chatInfo);
                    chatItem.appendChild(removeBtn);
                    chatItem.addEventListener('click', () => {
                        const fAv = friend.avatarUrl || friend.AvatarUrl;
                        selectChat(friend.id, friend.username, fAv, 'private');
                    });
                    friendsFolderBody.appendChild(chatItem);
                });
            }

        }
        function renderPendingRequestsModal() {
            const list = document.getElementById('pendingRequestsList');
            if (!list) return;
            list.innerHTML = '';
            if (!pendingRequests || pendingRequests.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = 'var(--text-muted)';
                empty.style.fontSize = '0.8rem';
                empty.style.width = '100%';
                empty.style.textAlign = 'center';
                empty.textContent = 'Brak zaproszeń.';
                list.appendChild(empty);
                return;
            }
            pendingRequests.forEach(req => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '10px';
                const avatar = document.createElement('div');
                avatar.className = 'avatar';
                avatar.style.cursor = 'pointer';
                avatar.onclick = (e) => {
                    e.stopPropagation();
                    const rAv = req.avatarUrl || req.AvatarUrl;
                    const rId = req.requesterId || req.RequesterId;
                        if (rId) {
                            showUserProfile(rId, req.username || 'Użytkownik', rAv, false);
                    }
                };
                {
                    const rAv = req.avatarUrl || req.AvatarUrl;
                    if (rAv) {
                        avatar.style.backgroundImage = `url('${resolveUrl(rAv)}')`;
                        avatar.style.backgroundSize = 'cover';
                        avatar.style.backgroundPosition = 'center';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = (req.username || 'U').charAt(0).toUpperCase();
                    }
                }
                const name = document.createElement('div');
                name.style.flex = '1';
                name.textContent = req.username || `Użytkownik ${req.requesterId}`;
                const accept = document.createElement('button');
                accept.className = 'btn-secondary';
                accept.textContent = 'Akceptuj';
                accept.onclick = async () => {
                    try {
                        const response = await fetch(`${API_URL}/friends/accept/${req.id}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            showNotification('Zaproszenie zaakceptowane.', 'success');
                            await loadPendingRequests();
                            await loadFriends();
                        } else {
                            await handleApiError(response, 'Nie udało się zaakceptować zaproszenia');
                        }
                    } catch (err) {
                        console.error('Accept error', err);
                        showNotification('Błąd akceptacji zaproszenia.', 'error');
                    }
                };
                const reject = document.createElement('button');
                reject.className = 'btn-secondary';
                reject.textContent = 'Odrzuć';
                reject.onclick = async () => {
                    if (!confirm('Odrzucić zaproszenie?')) return;
                    try {
                        const response = await fetch(`${API_URL}/friends/${req.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            showNotification('Zaproszenie odrzucone.', 'success');
                            await loadPendingRequests();
                        } else {
                            await handleApiError(response, 'Nie udało się odrzucić zaproszenia');
                        }
                    } catch (err) {
                        console.error('Reject error', err);
                        showNotification('Błąd odrzucania zaproszenia.', 'error');
                    }
                };
                row.appendChild(avatar);
                row.appendChild(name);
                row.appendChild(accept);
                row.appendChild(reject);
                list.appendChild(row);
            });
        }
        function selectChat(chatId, chatName, chatAvatar, type = 'private') {
            currentChatId = chatId;
            currentChatType = type;
            localStorage.setItem('lastChat', JSON.stringify({
                id: chatId,
                name: chatName,
                avatar: chatAvatar,
                type: type
            }));
                document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
                if (type === 'group' && item.dataset.groupId == chatId) {
                    item.classList.add('active');
                } else if (type === 'private' && item.dataset.friendId == chatId) {
                    item.classList.add('active');
                } else if (!chatId && item.querySelector('h4')?.textContent === 'Ogólny') {
                    item.classList.add('active');
                }
            });
            const chatHeader = document.querySelector('.chat-header h3');
            if (chatHeader) {
                chatHeader.textContent = chatName || 'Ogólny';
            }
            const headerAvatar = document.querySelector('.chat-header .avatar');
            if (headerAvatar) {
                const newAvatar = headerAvatar.cloneNode(true);
                headerAvatar.parentNode.replaceChild(newAvatar, headerAvatar);
                if (chatAvatar) {
                    newAvatar.style.backgroundImage = `url('${resolveUrl(chatAvatar)}')`;
                    newAvatar.style.backgroundSize = 'cover';
                    newAvatar.textContent = '';
                } else {
                    newAvatar.style.backgroundImage = '';
                    newAvatar.textContent = chatName ? chatName.charAt(0).toUpperCase() : 'O';
                }
                if (type === 'group' && chatId) {
                    const group = groups.find(g => g.id == chatId);
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    if (group && currentUser && (group.ownerId == currentUser.id || group.OwnerId == currentUser.id)) {
                        newAvatar.style.cursor = 'pointer';
                        newAvatar.title = 'Kliknij, aby zmienić ikonę grupy';
                        const addMemberBtn = document.getElementById('addGroupMemberBtn');
                        if (addMemberBtn) {
                             addMemberBtn.style.display = 'block';
                        }
                        const deleteGroupBtn = document.getElementById('deleteGroupBtn');
                        if (deleteGroupBtn) {
                            deleteGroupBtn.style.display = 'block';
                            deleteGroupBtn.onclick = async () => {
                                if (!confirm('Usunąć tę grupę?')) return;
                                try {
                                    const response = await fetch(`${API_URL}/groups/${chatId}`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (response.ok) {
                                        showNotification('Grupa została usunięta.', 'success');
                                        await loadGroups();
                                        selectChat(null, 'Ogólny', null, 'global');
                                    } else {
                                        await handleApiError(response, 'Nie udało się usunąć grupy');
                                    }
                                } catch (err) {
                                    showNotification('Błąd usuwania grupy.', 'error');
                                }
                            };
                        }
                        newAvatar.onclick = () => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                                if (input.files && input.files[0]) {
                                    const formData = new FormData();
                                    formData.append('avatar', input.files[0]);
                                    try {
                                        showNotification('Wysyłanie ikony...', 'info');
                                        const response = await fetch(`${API_URL}/groups/${chatId}/avatar`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`
                                            },
                                            body: formData
                                        });
                                        if (response.ok) {
                                            const data = await response.json();
                                            const newUrl = resolveUrl(data.url);
                                            newAvatar.style.backgroundImage = `url('${newUrl}')`;
                                            newAvatar.style.backgroundSize = 'cover';
                                            newAvatar.textContent = '';
                                            group.avatarUrl = data.url;
                                            const listItem = document.querySelector(`.chat-item[data-group-id="${chatId}"] .avatar`);
                                            if (listItem) {
                                                listItem.style.backgroundImage = `url('${newUrl}')`;
                                                listItem.style.backgroundSize = 'cover';
                                                listItem.textContent = '';
                                                listItem.style.background = '';
                                            }
                                            localStorage.setItem('lastChat', JSON.stringify({
                                                id: chatId,
                                                name: chatName,
                                                avatar: data.url,
                                                type: type
                                            }));
                                            showNotification('Ikona grupy została zmieniona!', 'success');
                                        } else {
                                            await handleApiError(response, 'Błąd zmiany ikony');
                                        }
                                    } catch (err) {
                                        console.error('Error uploading avatar:', err);
                                        showNotification('Wystąpił błąd.', 'error');
                                    }
                                }
                            };
                            input.click();
                        };
                    } else {
                        newAvatar.style.cursor = 'default';
                        newAvatar.title = '';
                        newAvatar.onclick = null;
                        const addMemberBtn = document.getElementById('addGroupMemberBtn');
                        if (addMemberBtn) {
                             addMemberBtn.style.display = 'none';
                        }
                        const deleteGroupBtn = document.getElementById('deleteGroupBtn');
                        if (deleteGroupBtn) {
                            deleteGroupBtn.style.display = 'none';
                            deleteGroupBtn.onclick = null;
                        }
                    }
                } else {
                    newAvatar.style.cursor = 'default';
                    newAvatar.title = '';
                    newAvatar.onclick = null;
                    const addMemberBtn = document.getElementById('addGroupMemberBtn');
                    if (addMemberBtn) {
                         addMemberBtn.style.display = 'none';
                    }
                    const deleteGroupBtn = document.getElementById('deleteGroupBtn');
                    if (deleteGroupBtn) {
                        deleteGroupBtn.style.display = 'none';
                        deleteGroupBtn.onclick = null;
                    }
                }
            }
            const videoCallButton = document.getElementById('videoCallButton');
            const voiceCallButton = document.getElementById('voiceCallButton');
            if (videoCallButton) {
                videoCallButton.style.display = (type === 'private' && chatId) ? 'block' : 'none';
            }
            if (voiceCallButton) {
                voiceCallButton.style.display = (type === 'private' && chatId) ? 'block' : 'none';
            }
            loadPreviousMessages();
        if (conversationSidebar && conversationSidebar.classList.contains('open')) {
            updateConversationSidebar();
        }
    }
    
    // Listeners for folders and chat items are already added at the beginning of the file.
    // Removed duplicated listeners block.

    const lastChat = localStorage.getItem('lastChat');
        let restored = false;
        if (lastChat) {
            try {
                const { id, name, avatar, type } = JSON.parse(lastChat);
                selectChat(id, name, avatar, type);
                restored = true;
            } catch (e) {
                console.error('Error parsing lastChat', e);
            }
        }
        if (!restored) {
            loadPreviousMessages();
        }
        async function loadPreviousMessages() {
            const messagesContainer = document.getElementById("chat-messages");
            if (messagesContainer) {
                messagesContainer.innerHTML = '<div class="message received"><div class="message-text">Ładowanie wiadomości...</div></div>';
            }
            try {
                let url = `${API_URL}/messages`;
                if (currentChatType === 'private' && currentChatId) {
                    url = `${API_URL}/messages?receiverId=${currentChatId}`;
                } else if (currentChatType === 'group' && currentChatId) {
                    url = `${API_URL}/messages?groupId=${currentChatId}`;
                }
                console.log('Fetching messages from:', url);
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Error loading messages:', response.status, errorText);
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<div class="message received"><div class="message-text" style="color:red">Błąd ładowania wiadomości.</div></div>';
                    }
                    return;
                }
                const messages = await response.json();
                console.log('Loaded messages:', messages?.length || 0);
                if (!messagesContainer) {
                    console.error('Messages container not found');
                    return;
                }
                const currentUser = JSON.parse(localStorage.getItem('user'));
                if (!currentUser) {
                    console.error('Current user not found');
                    return;
                }
                messagesContainer.innerHTML = '';
                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                    const welcomeMsg = document.createElement("div");
                    welcomeMsg.className = "message received";
                    welcomeMsg.textContent = "Witaj w Parrotnest! To jest początek twojej konwersacji.";
                    messagesContainer.appendChild(welcomeMsg);
                    return;
                }
                messages.forEach(msg => {
                    try {
                        const senderObj = msg.sender || msg.Sender;
                        const senderUsername = typeof senderObj === 'string' ? senderObj : (senderObj?.username || senderObj?.Username || 'Nieznany');
                        const senderAvatarUrl = msg.senderAvatarUrl || msg.SenderAvatarUrl || null;
                        let isOwnMessage = false;
                        const msgSenderId = msg.senderId || msg.SenderId;
                        const currentUserId = currentUser.id || currentUser.Id;
                        if (msgSenderId && currentUserId) {
                            isOwnMessage = parseInt(msgSenderId) === parseInt(currentUserId);
                        } else {
                            const currentUsername = currentUser.username || currentUser.userName || currentUser.email || '';
                            isOwnMessage = senderUsername === currentUsername;
                        }

                        let isContinuation = false;
                        const rawDate = msg.timestamp || msg.Timestamp;
                        const msgDate = rawDate ? new Date(rawDate) : new Date();

                        if (messagesContainer.lastElementChild) {
                            const lastWrapper = messagesContainer.lastElementChild;
                            const lastSenderId = lastWrapper.dataset.senderId;
                            const lastTimestampStr = lastWrapper.dataset.timestamp;

                            if (lastSenderId && msgSenderId && lastSenderId.toString() === msgSenderId.toString()) {
                                const lastDate = lastTimestampStr ? new Date(lastTimestampStr) : null;
                                if (lastDate && (msgDate - lastDate < 60000)) { // 1 minute threshold
                                    isContinuation = true;
                                    const lastTime = lastWrapper.querySelector('.message-time');
                                    if (lastTime) lastTime.style.display = 'none';
                                    lastWrapper.classList.add('message-continuation-prev');
                                }
                            }
                        }

                        const messageWrapper = document.createElement("div");
                        messageWrapper.className = `message-wrapper ${isOwnMessage ? 'own-message' : ''}`;
                        if (isContinuation) messageWrapper.classList.add('message-continuation');
                        messageWrapper.dataset.senderId = msgSenderId;
                        messageWrapper.dataset.timestamp = msgDate.toISOString();

                        const row = document.createElement("div");
                        row.className = "message-row";
                        const avatarEl = document.createElement("div");
                        avatarEl.className = "message-avatar";
                        
                        if (isContinuation) {
                            avatarEl.style.visibility = 'hidden';
                            avatarEl.onclick = null;
                            avatarEl.style.cursor = 'default';
                        } else {
                            avatarEl.style.cursor = 'pointer';
                            avatarEl.onclick = (e) => {
                                e.stopPropagation();
                                const sId = msg.senderId || msg.SenderId;
                                const isOwn = isOwnMessage;
                                if (isOwn) {
                                    const cUser = JSON.parse(localStorage.getItem('user'));
                                    showUserProfile(cUser.id, cUser.username, cUser.avatarUrl, true);
                                } else {
                                    if (sId) {
                                        showUserProfile(sId, senderUsername, senderAvatarUrl, false);
                                    } else {
                                        const f = friends.find(fr => fr.username === senderUsername);
                                        if (f) {
                                            showUserProfile(f.id, f.username, f.avatarUrl || f.AvatarUrl, false);
                                        } else {
                                            showUserProfile(0, senderUsername, senderAvatarUrl, false);
                                        }
                                    }
                                }
                            };
                            if (senderAvatarUrl) {
                                const url = resolveUrl(senderAvatarUrl);
                                avatarEl.style.backgroundImage = `url('${url}')`;
                                avatarEl.textContent = '';
                            } else if (senderUsername) {
                                avatarEl.textContent = senderUsername.charAt(0).toUpperCase();
                            }
                        }

                        const msgDiv = document.createElement("div");
                        msgDiv.className = isOwnMessage ? "message sent" : "message received";
                        
                        if (!isContinuation) {
                            const senderName = document.createElement("div");
                            senderName.className = "message-sender";
                            senderName.textContent = senderUsername;
                            msgDiv.appendChild(senderName);
                        }

                        const imgUrlRaw = msg.imageUrl || msg.ImageUrl;
                        if (imgUrlRaw) {
                            let imgUrl = resolveUrl(imgUrlRaw);
                            const img = document.createElement("img");
                            img.src = imgUrl;
                            img.className = "message-image";
                            img.onclick = () => openLightbox(imgUrl);
                            msgDiv.appendChild(img);
                        }
                        const content = msg.content || msg.Content;
                        if (content && content.trim() !== '') {
                            const messageText = document.createElement("div");
                            messageText.className = "message-text";
                            
                            // Link detection logic with Bubbles (Shared logic)
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const escapedMessage = content
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/"/g, "&quot;")
                                .replace(/'/g, "&#039;");
                            
                            const parts = escapedMessage.split(urlRegex);
                            messageText.innerHTML = '';
                            
                            parts.forEach(part => {
                                if (part.match(urlRegex)) {
                                    const url = part;
                                    let domain = '';
                                    try { domain = new URL(url).hostname; } catch (e) { domain = 'Link'; }
                                    
                                    const card = document.createElement('a');
                                    card.href = url;
                                    card.target = "_blank";
                                    card.rel = "noopener noreferrer";
                                    card.className = "link-preview-card";
                                    card.innerHTML = `
                                        <div class="link-icon-container">🔗</div>
                                        <div class="link-info">
                                            <div class="link-title">${url}</div>
                                            <div class="link-domain">${domain}</div>
                                        </div>
                                    `;
                                    messageText.appendChild(card);
                                } else {
                                    if (part) {
                                        const span = document.createElement('span');
                                        span.innerHTML = part.replace(/\n/g, '<br>');
                                        messageText.appendChild(span);
                                    }
                                }
                            });

                            msgDiv.appendChild(messageText);
                        }
                        const timestamp = document.createElement("div");
                        timestamp.className = "message-time";
                        if (rawDate && !isNaN(msgDate.getTime())) {
                            timestamp.textContent = msgDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                        } else {
                            timestamp.textContent = "";
                        }
                        msgDiv.appendChild(timestamp);
                        row.appendChild(avatarEl);
                        row.appendChild(msgDiv);
                        messageWrapper.appendChild(row);
                        messagesContainer.appendChild(messageWrapper);
                    } catch (msgError) {
                        console.error('Error processing message:', msgError, msg);
                    }
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                console.log('Messages displayed successfully');
            } catch (error) {
                console.error('Error loading messages:', error);
                const messagesContainer = document.getElementById("chat-messages");
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                    const errorMsg = document.createElement("div");
                    errorMsg.className = "message received";
                    errorMsg.style.color = "var(--error-color)";
                    errorMsg.textContent = "Błąd podczas ładowania wiadomości. Odśwież stronę.";
                }
            }
            if (conversationSidebar && conversationSidebar.classList.contains('open')) {
                updateConversationSidebar();
            }
        }
        const addFriendGroupButton = document.getElementById('addFriendGroupButton');
        const addModal = document.getElementById('addModal');
        const closeModal = document.getElementById('closeModal');
        const tabButtons = document.querySelectorAll('.tab-button');
        const friendTab = document.getElementById('friendTab');
        const groupTab = document.getElementById('groupTab');
        const addFriendBtn = document.getElementById('addFriendBtn');
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addFriendGroupButton && addModal) {
            addFriendGroupButton.addEventListener('click', () => {
                addModal.classList.add('show');
                const friendTabBtn = document.querySelector('.tab-button[data-tab="friend"]');
                if (friendTabBtn) friendTabBtn.click();
            });
        }
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                addModal.classList.remove('show');
            });
        }
        if (addModal) {
            addModal.addEventListener('click', (e) => {
                if (e.target === addModal) {
                    addModal.classList.remove('show');
                }
            });
        }
        function renderFriendSelection(containerId, hiddenInputId) {
            const container = document.getElementById(containerId);
            const hiddenInput = document.getElementById(hiddenInputId);
            if (!container || !hiddenInput) return;
            container.innerHTML = '';
            const selectedUsernames = new Set(hiddenInput.value ? hiddenInput.value.split(',').filter(x => x) : []);
            if (friends.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak znajomych do wyboru.</div>';
                return;
            }
            friends.forEach(friend => {
                const tile = document.createElement('div');
                tile.className = 'friend-tile';
                if (selectedUsernames.has(friend.username)) {
                    tile.classList.add('selected');
                }
                const avatar = document.createElement('div');
                avatar.className = 'avatar';
                if (friend.avatarUrl) {
                    avatar.style.backgroundImage = `url('${resolveUrl(friend.avatarUrl)}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'center';
                } else {
                    avatar.textContent = friend.username.charAt(0).toUpperCase();
                }
                const name = document.createElement('span');
                name.textContent = friend.username;
                name.title = friend.username;
                const check = document.createElement('div');
                check.className = 'check-icon';
                check.textContent = '✓';
                tile.appendChild(avatar);
                tile.appendChild(name);
                tile.appendChild(check);
                tile.onclick = () => {
                    tile.classList.toggle('selected');
                    if (tile.classList.contains('selected')) {
                        selectedUsernames.add(friend.username);
                    } else {
                        selectedUsernames.delete(friend.username);
                    }
                    hiddenInput.value = Array.from(selectedUsernames).join(',');
                };
                container.appendChild(tile);
            });
        }
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                if (tab === 'friend') {
                    friendTab.classList.add('active');
                    groupTab.classList.remove('active');
                } else {
                    groupTab.classList.add('active');
                    friendTab.classList.remove('active');
                    renderFriendSelection('friendsSelectionList', 'groupMembers');
                }
            });
        });
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', async () => {
                const friendInput = document.getElementById('friendUsername');
                const friendValue = friendInput.value.trim();
                if (!friendValue) {
                    showNotification('Wpisz nazwę użytkownika lub email', 'error');
                    return;
                }
                try {
                    const response = await fetch(`${API_URL}/friends/add`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ usernameOrEmail: friendValue })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        friendInput.value = '';
                        addModal.classList.remove('show');
                        await loadFriends();
                        if (data.pending) {
                            showNotification('Zaproszenie zostało wysłane. Poczekaj na akceptację użytkownika.', 'success');
                            showNotification(data.message || 'Jesteście już znajomymi.', 'success');
                            selectChat(data.friendId, data.username, data.avatarUrl);
                        } else {
                            showNotification(data.message || 'Operacja zakończona sukcesem.', 'success');
                        }
                    } else {
                        await handleApiError(response, 'Błąd podczas dodawania znajomego');
                    }
                } catch (error) {
                    console.error('Error adding friend:', error);
                    showNotification('Wystąpił błąd podczas dodawania znajomego.', 'error');
                }
            });
        }
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', async () => {
                const groupNameInput = document.getElementById('groupName');
                const groupMembersInput = document.getElementById('groupMembers');
                const groupName = groupNameInput ? groupNameInput.value.trim() : '';
                if (!groupName) {
                    showNotification('Wpisz nazwę grupy', 'error');
                    return;
                }
                const members = groupMembersInput ? groupMembersInput.value.trim().split(',').map(m => m.trim()).filter(m => m) : [];

                if (members.length === 0) {
                     showNotification('Grupa musi mieć przynajmniej jednego członka oprócz Ciebie.', 'warning');
                     return;
                }

                try {
                    const response = await fetch(`${API_URL}/groups`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ name: groupName, members })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const groupId = data.groupId;
                        if ((pendingGroupAvatarBlob || (groupAvatarInput && groupAvatarInput.files && groupAvatarInput.files.length > 0)) && groupId) {
                            const formData = new FormData();
                            if (pendingGroupAvatarBlob) {
                                formData.append('avatar', pendingGroupAvatarBlob, 'group_avatar.png');
                            } else {
                                formData.append('avatar', groupAvatarInput.files[0]);
                            }
                            try {
                                await fetch(`${API_URL}/groups/${groupId}/avatar`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${token}` },
                                    body: formData
                                });
                            } catch (avatarErr) {
                                console.error('Error uploading group avatar:', avatarErr);
                            }
                        }
                        showNotification('Grupa została utworzona.', 'success');
                        if (groupNameInput) groupNameInput.value = '';
                        if (groupMembersInput) groupMembersInput.value = '';
                        if (groupAvatarInput) groupAvatarInput.value = '';
                        pendingGroupAvatarBlob = null;
                        if (groupAvatarPreview) {
                            groupAvatarPreview.style.backgroundImage = '';
                            groupAvatarPreview.textContent = '';
                        }
                        renderFriendSelection('friendsSelectionList', 'groupMembers');
                        addModal.classList.remove('show');
                        await loadGroups();
                    } else {
                        await handleApiError(response, 'Nie udało się utworzyć grupy');
                    }
                } catch (error) {
                    console.error('Error creating group:', error);
                    showNotification('Wystąpił błąd podczas tworzenia grupy.', 'error');
                }
            });
        }
        const addGroupMemberBtn = document.getElementById('addGroupMemberBtn');
        const addMemberModal = document.getElementById('addMemberModal');
        const closeAddMemberModal = document.getElementById('closeAddMemberModal');
        const confirmAddMemberBtn = document.getElementById('confirmAddMemberBtn');
        if (addGroupMemberBtn) {
            addGroupMemberBtn.addEventListener('click', () => {
                if (currentChatType !== 'group' || !currentChatId) return;
                let hiddenInput = document.getElementById('addMemberHiddenInput');
                if (!hiddenInput) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = 'addMemberHiddenInput';
                    document.body.appendChild(hiddenInput);
                }
                hiddenInput.value = '';
                renderFriendSelection('addMemberSelectionList', 'addMemberHiddenInput');
                addMemberModal.classList.add('show');
            });
        }
        if (closeAddMemberModal) {
            closeAddMemberModal.addEventListener('click', () => {
                addMemberModal.classList.remove('show');
            });
        }
        if (addMemberModal) {
             addMemberModal.addEventListener('click', (e) => {
                if (e.target === addMemberModal) {
                    addMemberModal.classList.remove('show');
                }
            });
        }
        if (confirmAddMemberBtn) {
            confirmAddMemberBtn.addEventListener('click', async () => {
                const hiddenInput = document.getElementById('addMemberHiddenInput');
                const selectedUsernames = hiddenInput ? hiddenInput.value.split(',').filter(x => x) : [];
                if (selectedUsernames.length === 0) {
                    showNotification('Wybierz przynajmniej jednego członka.', 'warning');
                    return;
                }
                try {
                    const response = await fetch(`${API_URL}/groups/${currentChatId}/members`, {
                        method: 'POST',
                        headers: {
                             'Content-Type': 'application/json',
                             'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(selectedUsernames)
                    });
                    if (response.ok) {
                        const data = await response.json();
                        showNotification(data.message || 'Dodano członków do grupy.', 'success');
                        addMemberModal.classList.remove('show');
                    } else {
                        await handleApiError(response, 'Nie udało się dodać członków');
                    }
                } catch (error) {
                    console.error('Error adding members:', error);
                    showNotification('Wystąpił błąd podczas dodawania członków.', 'error');
                }
            });
        }
        const settingsButton = document.getElementById('settingsButton');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        const settingsForm = document.getElementById('settingsForm');
        const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
        const settingsUsername = document.getElementById('settingsUsername');
        const settingsEmail = document.getElementById('settingsEmail');
        const themeVibrantRadio = document.getElementById('themeVibrant');
        const themeDarkRadio = document.getElementById('themeDark');
        const themeClassicRadio = document.getElementById('themeClassic');
        const themeOriginalRadio = document.getElementById('themeOriginal');
        const themeNeonRadio = document.getElementById('themeNeon');
        const themeForestRadio = document.getElementById('themeForest');
        // Listeners for settings moved to top of DOMContentLoaded
        
        async function loadUserData() {
            try {
                // Force network request to ensure fresh data
                const response = await fetch(`${API_URL}/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Cache-Control': 'no-cache, no-store'
                    }
                });
                if (response.ok) {
                    const user = await response.json();
                    console.log('User data loaded:', user); // Debug

                    // Update LocalStorage to keep it in sync
                    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
                    const updatedUser = { ...currentUser, ...user };
                    localStorage.setItem('user', JSON.stringify(updatedUser));

                    if (settingsUsername) settingsUsername.value = user.username;
                    if (settingsEmail) settingsEmail.value = user.email;
                    
                    if (user.status || user.Status) {
                        const s = user.status || user.Status;
                        const radio = document.querySelector(`input[name="status"][value="${s}"]`);
                        if (radio) radio.checked = true;
                    }

                    if (settingsAvatarPreview) {
                        const uAv = user.avatarUrl || user.AvatarUrl || user.profilePictureUrl;
                        
                        // Always clear first
                        settingsAvatarPreview.textContent = '';
                        settingsAvatarPreview.style.display = 'flex';
                        settingsAvatarPreview.style.alignItems = 'center';
                        settingsAvatarPreview.style.justifyContent = 'center';
                        settingsAvatarPreview.style.border = '3px solid var(--accent-green)';
                        
                        if (uAv) {
                            const resolved = resolveUrl(uAv);
                            const urlWithCache = resolved + (resolved.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
                            
                            // Apply immediately without waiting for load
                            settingsAvatarPreview.style.background = `url('${urlWithCache}') center/cover no-repeat`;
                            
                            // Also update sidebar immediately
                            const sidebarAvatar = document.getElementById('userAvatar');
                            if (sidebarAvatar) {
                                sidebarAvatar.style.background = `url('${urlWithCache}') center/cover no-repeat`;
                                sidebarAvatar.textContent = '';
                            }
                        } else {
                            // Fallback
                            settingsAvatarPreview.style.background = 'var(--accent-green)';
                            settingsAvatarPreview.textContent = (user.username || user.userName || '?').charAt(0).toUpperCase();
                            settingsAvatarPreview.style.fontSize = '2.5rem';
                            settingsAvatarPreview.style.color = 'white';
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        }
        if (changeAvatarBtn && avatarInput) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarInput.click();
            });
        }
        async function uploadUserAvatar(blob) {
            const formData = new FormData();
            formData.append('file', blob);
            try {
                const response = await fetch(`${API_URL}/users/avatar`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                if (response.ok) {
                    const data = await response.json();
                    const fullUrl = resolveUrl(data.url);
                    
                    settingsAvatarPreview.style.background = `url('${fullUrl}') center/cover no-repeat`;
                    settingsAvatarPreview.textContent = '';
                    
                    const mainAvatar = document.getElementById('userAvatar');
                    if (mainAvatar) {
                        mainAvatar.style.background = `url('${fullUrl}') center/cover no-repeat`;
                        mainAvatar.textContent = '';
                    }
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    currentUser.avatarUrl = data.url;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    showNotification('Zdjęcie profilowe zostało zaktualizowane.', 'success');
                } else {
                    await handleApiError(response, 'Błąd aktualizacji zdjęcia');
                }
            } catch (error) {
                console.error('Error uploading avatar:', error);
                showNotification('Wystąpił błąd podczas wysyłania zdjęcia.', 'error');
            }
        }
        if (avatarInput) {
            avatarInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    uploadUserAvatar(file);
                }
            });
        }
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newUsername = settingsUsername.value.trim();
                const newPassword = document.getElementById('settingsPassword').value;
                const newEmail = settingsEmail ? settingsEmail.value.trim() : '';
                const updateData = {};
                if (newUsername) updateData.username = newUsername;
                if (newPassword) updateData.password = newPassword;

                const currentUserStr = localStorage.getItem('user');
                let currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
                const oldUsername = currentUser ? (currentUser.username || currentUser.userName || currentUser.Username) : null;
                const oldEmail = currentUser ? (currentUser.email || currentUser.Email) : null;

                try {
                    const response = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(updateData)
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (currentUser && data.user) {
                            currentUser.username = data.user.username;
                            currentUser.userName = data.user.username;
                            currentUser.Username = data.user.username;
                            if (data.user.email) {
                                currentUser.email = data.user.email;
                                currentUser.Email = data.user.email;
                            }
                            localStorage.setItem('user', JSON.stringify(currentUser));
                        }
                        const userNameEl = document.getElementById('userName');
                        if (userNameEl && data.user) userNameEl.textContent = data.user.username;
                        showNotification('Profil został zaktualizowany.', 'success');

                        const usernameChanged = data.user && oldUsername && oldUsername !== data.user.username;
                        const emailChanged = data.user && oldEmail && data.user.email && oldEmail !== data.user.email;
                        const passwordChanged = !!newPassword;

                        if (usernameChanged || emailChanged || passwordChanged) {
                            showNotification('Dane logowania zmienione. Wylogowywanie...', 'info');
                            setTimeout(() => {
                                localStorage.removeItem('token');
                                localStorage.removeItem('user');
                                window.location.href = '/';
                            }, 1500);
                            return;
                        }

                        settingsModal.classList.remove('show');
                        document.getElementById('settingsPassword').value = '';
                    } else {
                        await handleApiError(response, 'Błąd aktualizacji profilu');
                    }
                } catch (error) {
                    console.error('Error updating profile:', error);
                    showNotification('Wystąpił błąd podczas aktualizacji profilu.', 'error');
                }
            });
        }
        
        function updateUserStatusUI(el, status) {
            if (!el) return;
            el.classList.remove('status-online', 'status-away', 'status-dnd', 'status-invisible', 'status-offline');
            let text = 'Offline';
            let cls = 'status-offline';
            switch (status) {
                case 1: text = 'Online'; cls = 'status-online'; break;
                case 2: text = 'Zaraz wracam'; cls = 'status-away'; break;
                case 3: text = 'Nie przeszkadzać'; cls = 'status-dnd'; break;
                case 4: text = 'Niewidoczny'; cls = 'status-invisible'; break;
                default: text = 'Offline'; cls = 'status-offline'; break;
            }
            el.textContent = text;
            el.classList.add(cls);
        }

        const saveStatusBtn = document.getElementById('saveStatusBtn');
        if (saveStatusBtn) {
            saveStatusBtn.addEventListener('click', async () => {
                const selected = document.querySelector('input[name="status"]:checked');
                if (!selected) return;
                const status = parseInt(selected.value);
                try {
                    if (connection && typeof signalR !== 'undefined' && connection.state === signalR.HubConnectionState.Connected) {
                        await connection.invoke("UpdateStatus", status);
                        const userStr = localStorage.getItem('user');
                        if (userStr) {
                            const userObj = JSON.parse(userStr);
                            userObj.status = status;
                            userObj.Status = status;
                            localStorage.setItem('user', JSON.stringify(userObj));
                        }
                        if (userStatusEl) {
                            updateUserStatusUI(userStatusEl, status);
                        }
                        showNotification('Status zaktualizowany', 'success');
                    } else {
                        showNotification('Brak połączenia z serwerem.', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    if (e.message && e.message.includes("Method does not exist")) {
                        showNotification('Błąd: Serwer wymaga restartu, aby obsłużyć zmianę statusu.', 'error');
                    } else {
                        showNotification('Błąd aktualizacji statusu', 'error');
                    }
                }
            });
        }


        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                });
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.dataset.tab + 'Tab';
                const tabContent = document.getElementById(tabId);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        function applyTheme(themeName) {
            const root = document.documentElement;
            if (!root) return;
            const allowed = ['vibrant', 'dark', 'classic', 'original', 'neon', 'forest'];
            const finalTheme = allowed.includes(themeName) ? themeName : 'original';
            root.setAttribute('data-theme', finalTheme);
        }

        const preferredTheme = localStorage.getItem('preferredTheme') || 'original';
        applyTheme(preferredTheme);
        if (themeDarkRadio) {
            themeDarkRadio.checked = (preferredTheme === 'dark');
        }
        if (themeVibrantRadio) {
            themeVibrantRadio.checked = (preferredTheme === 'vibrant');
        }
        if (themeClassicRadio) {
            themeClassicRadio.checked = (preferredTheme === 'classic');
        }
        if (themeOriginalRadio) {
            themeOriginalRadio.checked = (preferredTheme === 'original');
        }
        if (themeNeonRadio) {
            themeNeonRadio.checked = (preferredTheme === 'neon');
        }
        if (themeForestRadio) {
            themeForestRadio.checked = (preferredTheme === 'forest');
        }

        if (themeVibrantRadio) {
            themeVibrantRadio.addEventListener('change', () => {
                if (themeVibrantRadio.checked) {
                    applyTheme('vibrant');
                }
            });
        }
        if (themeDarkRadio) {
            themeDarkRadio.addEventListener('change', () => {
                if (themeDarkRadio.checked) {
                    applyTheme('dark');
                }
            });
        }
        if (themeClassicRadio) {
            themeClassicRadio.addEventListener('change', () => {
                if (themeClassicRadio.checked) {
                    applyTheme('classic');
                }
            });
        }
        if (themeOriginalRadio) {
            themeOriginalRadio.addEventListener('change', () => {
                if (themeOriginalRadio.checked) {
                    applyTheme('original');
                }
            });
        }
        if (themeNeonRadio) {
            themeNeonRadio.addEventListener('change', () => {
                if (themeNeonRadio.checked) {
                    applyTheme('neon');
                }
            });
        }
        if (themeForestRadio) {
            themeForestRadio.addEventListener('change', () => {
                if (themeForestRadio.checked) {
                    applyTheme('forest');
                }
            });
        }
        const saveThemeBtn = document.getElementById('saveThemeBtn');
        if (saveThemeBtn) {
            saveThemeBtn.addEventListener('click', () => {
                let selected = 'original';
                if (themeDarkRadio && themeDarkRadio.checked) selected = 'dark';
                else if (themeVibrantRadio && themeVibrantRadio.checked) selected = 'vibrant';
                else if (themeClassicRadio && themeClassicRadio.checked) selected = 'classic';
                else if (themeOriginalRadio && themeOriginalRadio.checked) selected = 'original';
                else if (themeNeonRadio && themeNeonRadio.checked) selected = 'neon';
                else if (themeForestRadio && themeForestRadio.checked) selected = 'forest';
                localStorage.setItem('preferredTheme', selected);
                applyTheme(selected);
                showNotification('Motyw zapisany.', 'success');
            });
        }
        const userProfileModal = document.getElementById('userProfileModal');
        const closeUserProfileModal = document.getElementById('closeUserProfileModal');
        if (closeUserProfileModal && userProfileModal) {
            closeUserProfileModal.onclick = () => {
                userProfileModal.classList.remove('show');
            };
            userProfileModal.addEventListener('click', (e) => {
                if (e.target === userProfileModal) {
                    userProfileModal.classList.remove('show');
                }
            });
        }
        async function showUserProfile(userId, username, avatarUrl, isOwnProfile = false) {
            if (!userProfileModal) return;
            const avatarEl = document.getElementById('profileAvatar');
            const usernameEl = document.getElementById('profileUsername');
            const statusEl = document.getElementById('profileStatus');
            const mutualsSection = document.getElementById('profileMutualsSection');
            const mutualsList = document.getElementById('profileMutualFriendsList');
            const serversList = document.getElementById('profileCommonServersList');
            usernameEl.textContent = username;
            if (avatarUrl) {
                avatarEl.style.backgroundImage = `url('${resolveUrl(avatarUrl)}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.textContent = '';
            } else {
                avatarEl.style.backgroundImage = 'none';
                avatarEl.textContent = username.charAt(0).toUpperCase();
                avatarEl.style.backgroundColor = 'var(--accent-color)';
                avatarEl.style.display = 'flex';
                avatarEl.style.alignItems = 'center';
                avatarEl.style.justifyContent = 'center';
                avatarEl.style.color = 'white';
                avatarEl.style.fontSize = '2rem';
            }
            let status = 'Niedostępny';
            const friend = friends.find(f => (f.id == userId) || (f.Id == userId));
            if (friend && (friend.isOnline || friend.IsOnline)) {
                status = 'Dostępny';
            } else if (isOwnProfile) {
                 status = 'Twój profil';
            } else {
                statusEl.style.color = 'var(--text-muted)';
            }
            statusEl.textContent = status;
            if (isOwnProfile) {
                mutualsSection.style.display = 'none';
            } else {
                mutualsSection.style.display = 'block';
                mutualsList.innerHTML = '<div style="padding:10px;">Ładowanie...</div>';
                serversList.innerHTML = '<div style="padding:10px;">Ładowanie...</div>';
                try {
                    const res = await fetch(`${API_URL}/friends/mutual/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const mutuals = await res.json();
                        renderProfileList(mutualsList, mutuals, 'Brak wspólnych znajomych.');
                    } else {
                        mutualsList.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania</div>';
                    }
                } catch (e) {
                    console.error(e);
                    mutualsList.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania</div>';
                }
                try {
                    const res = await fetch(`${API_URL}/groups/common/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const commons = await res.json();
                        renderProfileList(serversList, commons, 'Brak wspólnych serwerów.');
                    } else {
                        serversList.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania</div>';
                    }
                } catch (e) {
                    console.error(e);
                    serversList.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania</div>';
                }
            }
            userProfileModal.classList.add('show');
        }
        function renderProfileList(container, items, emptyText) {
            container.innerHTML = '';
            if (!items || items.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem;">${emptyText}</div>`;
                return;
            }
            items.forEach(item => {
                const tile = document.createElement('div');
                tile.className = 'friend-tile';
                tile.style.cursor = 'default';
                
                const av = document.createElement('div');
                av.className = 'avatar';
                const url = item.avatarUrl || item.AvatarUrl;
                const name = item.username || item.Username || item.name || item.Name;
                if (url) {
                    av.style.backgroundImage = `url('${resolveUrl(url)}')`;
                    av.style.backgroundSize = 'cover';
                    av.style.backgroundPosition = 'center';
                    av.textContent = '';
                } else {
                    av.textContent = name.charAt(0).toUpperCase();
                }
                const label = document.createElement('span');
                label.textContent = name;
                tile.appendChild(av);
                tile.appendChild(label);
                container.appendChild(tile);
            });
        }
        function renderGroupMembersList(container, members, isAdmin, groupId) {
            container.innerHTML = '';
            if (!members || members.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Brak uczestników.</div>';
                return;
            }
            members.forEach(member => {
                const tile = document.createElement('div');
                tile.className = 'friend-tile';
                tile.style.cursor = 'default';

                const av = document.createElement('div');
                av.className = 'avatar';
                
                const url = member.avatarUrl || member.AvatarUrl;
                const name = member.username || member.Username || 'Użytkownik';
                
                if (url) {
                    av.style.backgroundImage = `url('${resolveUrl(url)}')`;
                    av.style.backgroundSize = 'cover';
                    av.style.backgroundPosition = 'center';
                    av.textContent = '';
                } else {
                    av.textContent = name.charAt(0).toUpperCase();
                }

                const label = document.createElement('span');
                label.textContent = name;
                
                tile.appendChild(av);
                tile.appendChild(label);

                if (isAdmin) {
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const isSelf = member.id == currentUser.id || member.Id == currentUser.id;
                    
                    if (!isSelf) {
                        const removeBtn = document.createElement('button');
                        removeBtn.className = 'btn-remove-member';
                        removeBtn.innerHTML = '➖';
                        removeBtn.title = 'Usuń z grupy';
                        removeBtn.onclick = async (e) => {
                            e.stopPropagation();
                            if (!confirm(`Czy na pewno usunąć użytkownika ${name} z grupy?`)) return;
                            try {
                                const response = await fetch(`${API_URL}/groups/${groupId}/members/${member.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (response.ok) {
                                    showNotification('Użytkownik usunięty.', 'success');
                                    updateConversationSidebar(); // Refresh list
                                } else {
                                    await handleApiError(response, 'Nie udało się usunąć użytkownika');
                                }
                            } catch (err) {
                                console.error(err);
                                showNotification('Błąd usuwania użytkownika.', 'error');
                            }
                        };
                        tile.appendChild(removeBtn);
                    }
                }

                container.appendChild(tile);
            });
        }

        async function openAddMemberModal(groupId) {
            const modal = document.getElementById('addMemberModal');
            const list = document.getElementById('addMemberSelectionList');
            const hiddenInput = document.getElementById('addMemberHiddenInput');
            let confirmBtn = document.getElementById('confirmAddMemberBtn');
            
            if (!modal || !list || !hiddenInput || !confirmBtn) return;
            
            // Clone button to remove old event listeners to prevent conflicts
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            confirmBtn = newConfirmBtn;
            
            list.innerHTML = 'Ładowanie...';
            hiddenInput.value = '';
            modal.classList.add('show');
            
            try {
                // Fetch friends and current members in parallel
                const [friendsRes, membersRes] = await Promise.all([
                    fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/groups/${groupId}/members`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                
                if (friendsRes.ok && membersRes.ok) {
                    const friendsList = await friendsRes.json();
                    const membersList = await membersRes.json();
                    
                    const memberIds = new Set(membersList.map(m => String(m.id || m.Id)));
                    const availableFriends = friendsList.filter(f => !memberIds.has(String(f.id || f.Id)));
                    
                    list.innerHTML = '';
                    if (availableFriends.length === 0) {
                        list.innerHTML = '<div style="padding:10px;text-align:center;color:var(--text-muted)">Brak znajomych do dodania.</div>';
                        return;
                    }
                    
                    availableFriends.forEach(friend => {
                        const item = document.createElement('div');
                        item.className = 'friend-select-item';
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        item.style.gap = '10px';
                        item.style.padding = '8px';
                        item.style.borderBottom = '1px solid var(--border-color)';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = friend.id || friend.Id;
                        checkbox.style.marginRight = '10px';
                        
                        const name = document.createElement('span');
                        name.textContent = friend.username || friend.Username;
                        
                        item.appendChild(checkbox);
                        item.appendChild(name);
                        list.appendChild(item);
                    });
                    
                    // Setup confirm button logic
                    confirmBtn.onclick = async () => {
                        const selectedIds = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                        if (selectedIds.length === 0) {
                            showNotification('Wybierz przynajmniej jedną osobę.', 'warning');
                            return;
                        }
                        
                        try {
                            let successCount = 0;
                            for (const userId of selectedIds) {
                                const res = await fetch(`${API_URL}/groups/${groupId}/members`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ userId: userId })
                                });
                                if (res.ok) successCount++;
                            }
                            
                            if (successCount > 0) {
                                showNotification(`Dodano ${successCount} użytkowników.`, 'success');
                                modal.classList.remove('show');
                                updateConversationSidebar();
                            } else {
                                showNotification('Nie udało się dodać użytkowników.', 'error');
                            }
                        } catch (e) {
                            console.error(e);
                            showNotification('Błąd podczas dodawania.', 'error');
                        }
                    };
                    
                } else {
                    list.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania danych.</div>';
                }
            } catch (e) {
                console.error(e);
                list.innerHTML = '<div style="color:var(--error-color)">Błąd połączenia.</div>';
            }
        }

        async function changeGroupPhoto(groupId) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.onchange = async (e) => {
                if (input.files && input.files[0]) {
                    const formData = new FormData();
                    formData.append('avatar', input.files[0]);
                    try {
                        showNotification('Wysyłanie ikony...', 'info');
                        const response = await fetch(`${API_URL}/groups/${groupId}/avatar`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
                        if (response.ok) {
                            showNotification('Ikona grupy zmieniona!', 'success');
                            updateConversationSidebar();
                            loadGroups(); // Refresh sidebar list
                            // Also update header if active
                            const headerAvatar = document.querySelector('.chat-header .avatar');
                            if (headerAvatar) {
                                // Simple reload or fetch to get new URL
                                // For now just assume sidebar update handles it or page refresh
                            }
                        } else {
                            await handleApiError(response, 'Błąd zmiany ikony');
                        }
                    } catch (err) {
                        console.error(err);
                        showNotification('Wystąpił błąd.', 'error');
                    }
                }
                document.body.removeChild(input);
            };
            input.click();
        }

        async function deleteGroup(groupId) {
            if (!confirm('Czy na pewno chcesz usunąć tę grupę? Tej operacji nie można cofnąć.')) return;
            try {
                const response = await fetch(`${API_URL}/groups/${groupId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    showNotification('Grupa została usunięta.', 'success');
                    conversationSidebar.classList.remove('open');
                    if (dashboardContainer) dashboardContainer.classList.remove('sidebar-open');
                    await loadGroups();
                    selectChat(null, 'Ogólny', null, 'global');
                } else {
                    await handleApiError(response, 'Nie udało się usunąć grupy');
                }
            } catch (err) {
                console.error(err);
                showNotification('Błąd usuwania grupy.', 'error');
            }
        }

        async function leaveGroup(groupId) {
            if (!confirm('Czy na pewno chcesz opuścić grupę?')) return;
            try {
                const response = await fetch(`${API_URL}/groups/${groupId}/members/me`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    showNotification('Opuściłeś grupę.', 'success');
                    conversationSidebar.classList.remove('open');
                    if (dashboardContainer) dashboardContainer.classList.remove('sidebar-open');
                    await loadGroups();
                    selectChat(null, 'Ogólny', null, 'global');
                } else {
                    await handleApiError(response, 'Nie udało się opuścić grupy');
                }
            } catch (err) {
                console.error(err);
                showNotification('Błąd opuszczania grupy.', 'error');
            }
        }

        async function updateConversationSidebar() {
            if (!conversationSidebar) return;
            const titleEl = document.getElementById('conversationSidebarTitle');
            const avatarEl = document.getElementById('conversationSidebarAvatar');
            const nameEl = document.getElementById('conversationSidebarName');
            const statusEl = document.getElementById('conversationSidebarStatus');
            const mutualsSection = document.getElementById('conversationSidebarMutualsSection');
            const mutualsContainer = document.getElementById('conversationSidebarMutualFriends');
            const groupsSection = document.getElementById('conversationSidebarGroupsSection');
            const groupsContainer = document.getElementById('conversationSidebarGroups');
            const membersSection = document.getElementById('conversationSidebarMembersSection');
            const membersContainer = document.getElementById('conversationSidebarMembers');
            const imagesContainer = document.getElementById('conversationSidebarImages');
            
            // Find or create admin controls container
            let adminControls = document.getElementById('sidebarAdminControls');
            if (!adminControls) {
                adminControls = document.createElement('div');
                adminControls.id = 'sidebarAdminControls';
                adminControls.className = 'admin-controls';
                const sidebarBody = document.getElementById('conversationSidebarBody');
                if (sidebarBody) sidebarBody.appendChild(adminControls);
            }
            adminControls.innerHTML = ''; 
            adminControls.style.display = 'none';

            if (mutualsContainer) mutualsContainer.innerHTML = '';
            if (groupsContainer) groupsContainer.innerHTML = '';
            if (membersContainer) membersContainer.innerHTML = '';
            if (imagesContainer) imagesContainer.innerHTML = '';

            if (currentChatType === 'global') {
                if(titleEl) titleEl.textContent = 'Czat ogólny';
                nameEl.textContent = 'Kanał ogólny';
                avatarEl.style.backgroundImage = '';
                avatarEl.textContent = ''; 
                avatarEl.style.backgroundColor = 'transparent';
                statusEl.textContent = '';
                
                if (mutualsSection) mutualsSection.style.display = 'none';
                if (groupsSection) groupsSection.style.display = 'none';
                if (membersSection) membersSection.style.display = 'block';

                if (membersContainer) {
                     renderProfileList(membersContainer, friends, 'Brak dostępnych użytkowników.');
                }
            } else if (currentChatType === 'private' && currentChatId) {
                const friend = friends.find(f => f.id == currentChatId || f.Id == currentChatId);
                titleEl.textContent = 'Rozmowa prywatna';
                const username = friend ? (friend.username || friend.Username || 'Użytkownik') : 'Użytkownik';
                const avatarUrl = friend ? (friend.avatarUrl || friend.AvatarUrl) : null;
                nameEl.textContent = username;
                if (avatarUrl) {
                    const url = resolveUrl(avatarUrl);
                    avatarEl.style.backgroundImage = `url('${url}')`;
                    avatarEl.textContent = '';
                } else {
                    avatarEl.style.backgroundImage = '';
                    avatarEl.textContent = username.charAt(0).toUpperCase();
                }
                let status = 'Niedostępny';
                if (friend && (friend.isOnline || friend.IsOnline)) {
                    status = 'Dostępny';
                }
                statusEl.textContent = status;
                if (mutualsSection) mutualsSection.style.display = 'block';
                if (groupsSection) {
                    groupsSection.style.display = 'block';
                    const h4 = groupsSection.querySelector('h4');
                    if (h4) h4.textContent = 'Wspólne grupy';
                }
                if (membersSection) membersSection.style.display = 'none';

                await loadSidebarMutualsAndGroups(currentChatId);
            } else if (currentChatType === 'group' && currentChatId) {
                const group = groups.find(g => g.id == currentChatId || g.Id == currentChatId);
                if(titleEl) titleEl.textContent = 'Grupa';
                const groupName = group ? (group.name || group.Name || 'Grupa') : 'Grupa';
                const avatarUrl = group ? (group.avatarUrl || group.AvatarUrl) : null;
                nameEl.textContent = groupName;
                if (avatarUrl) {
                    const url = resolveUrl(avatarUrl);
                    avatarEl.style.backgroundImage = `url('${url}')`;
                    avatarEl.textContent = '';
                } else {
                    avatarEl.style.backgroundImage = '';
                    avatarEl.textContent = groupName.charAt(0).toUpperCase();
                }
                statusEl.textContent = '';
                if (mutualsSection) mutualsSection.style.display = 'none';
                if (groupsSection) groupsSection.style.display = 'none';
                if (membersSection) membersSection.style.display = 'block';

                // --- ACTIONS INJECTION ---
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const currentUserId = currentUser ? (currentUser.id || currentUser.Id) : null;
                const groupOwnerId = group ? (group.ownerId || group.OwnerId) : null;
                
                const isAdmin = group && currentUserId && groupOwnerId && (String(groupOwnerId) === String(currentUserId));
                
                adminControls.style.display = 'flex';
                adminControls.style.flexDirection = 'column';
                adminControls.style.gap = '10px';
                adminControls.style.padding = '10px';

                if (isAdmin) {
                    // Add Member Button
                    const addBtn = document.createElement('button');
                    addBtn.className = 'btn-secondary btn-sidebar-action';
                    addBtn.innerHTML = '➕ Dodaj członków';
                    addBtn.onclick = () => openAddMemberModal(currentChatId);
                    adminControls.appendChild(addBtn);

                    // Edit Group Button
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-secondary btn-sidebar-action';
                    editBtn.innerHTML = '✏️ Edytuj grupę';
                    editBtn.onclick = () => openEditGroupModal(currentChatId, group.name || group.Name);
                    adminControls.appendChild(editBtn);
                    
                    // Change Photo Button
                    const photoBtn = document.createElement('button');
                    photoBtn.className = 'btn-secondary btn-sidebar-action';
                    photoBtn.innerHTML = '🖼️ Zmień zdjęcie grupy';
                    photoBtn.onclick = () => changeGroupPhoto(currentChatId);
                    adminControls.appendChild(photoBtn);
                    
                    // Delete Group Button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-secondary btn-sidebar-action danger';
                    deleteBtn.innerHTML = '🗑️ Usuń grupę';
                    deleteBtn.onclick = () => deleteGroup(currentChatId);
                    adminControls.appendChild(deleteBtn);
                } else {
                    // Leave Group Button
                    const leaveBtn = document.createElement('button');
                    leaveBtn.className = 'btn-secondary btn-sidebar-action danger';
                    leaveBtn.innerHTML = '🚪 Opuść grupę';
                    leaveBtn.onclick = () => leaveGroup(currentChatId);
                    adminControls.appendChild(leaveBtn);
                }

                if (membersContainer) {
                    membersContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Ładowanie uczestników...</div>';
                    try {
                        const res = await fetch(`${API_URL}/groups/${currentChatId}/members`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            const members = await res.json();
                            renderGroupMembersList(membersContainer, members, isAdmin, currentChatId);
                        } else {
                            membersContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Nie udało się wczytać uczestników.</div>';
                        }
                    } catch (e) {
                        console.error(e);
                        membersContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Błąd ładowania uczestników.</div>';
                    }
                }
            }
            if (imagesContainer) {
                const messagesContainer = document.getElementById('chat-messages');
                if (messagesContainer) {
                    const imgs = messagesContainer.querySelectorAll('img.message-image');
                    if (!imgs.length) {
                        imagesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Brak obrazków w tej konwersacji.</div>';
                    } else {
                        imgs.forEach(img => {
                            const thumb = document.createElement('img');
                            thumb.src = img.src;
                            thumb.onclick = () => openLightbox(img.src);
                            imagesContainer.appendChild(thumb);
                        });
                    }
                }
            }
        }

        async function loadSidebarMutualsAndGroups(userId) {
            const mutualsSection = document.getElementById('conversationSidebarMutualsSection');
            const mutualsContainer = document.getElementById('conversationSidebarMutualFriends');
            const groupsSection = document.getElementById('conversationSidebarGroupsSection');
            const groupsContainer = document.getElementById('conversationSidebarGroups');
            if (!mutualsContainer || !groupsContainer) return;
            try {
                const res = await fetch(`${API_URL}/friends/mutual/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const mutuals = await res.json();
                    if (mutuals && mutuals.length > 0) {
                        renderProfileList(mutualsContainer, mutuals, 'Brak wspólnych znajomych.');
                    } else {
                        mutualsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Brak wspólnych znajomych.</div>';
                    }
                } else {
                    mutualsContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Błąd ładowania</div>';
                }
            } catch (e) {
                console.error(e);
                mutualsContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Błąd ładowania</div>';
            }
            try {
                const res = await fetch(`${API_URL}/groups/common/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const commons = await res.json();
                    if (commons && commons.length > 0) {
                        renderProfileList(groupsContainer, commons, 'Brak wspólnych serwerów.');
                    } else {
                        groupsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Brak wspólnych serwerów.</div>';
                    }
                } else {
                    groupsContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Błąd ładowania</div>';
                }
            } catch (e) {
                console.error(e);
                groupsContainer.innerHTML = '<div style="color: var(--error-color); font-size: 0.85rem;">Błąd ładowania</div>';
            }
        }
        async function startConnection() {
            try {
                if (!signalRAvailable || !connection) return;
                if (connection.state === signalR.HubConnectionState.Disconnected) {
                    await connection.start();
                    console.log("SignalR Connected.");
                    loadFriends();
                    loadGroups();
                }
            } catch (err) {
                console.error("SignalR Connection Error: ", err);
                setTimeout(startConnection, 6069);
            }
        }
        if (connection) {
            connection.onclose(async () => {
                console.log("SignalR Connection Closed. Reconnecting...");
                await startConnection();
            });
        }
        loadFriends();
        loadGroups();
        await startConnection();
        setInterval(() => {
            loadPendingRequests();
            loadFriends();
            loadGroups();
        }, 6069);
        const imageModal = document.getElementById('image-modal');
        const modalImg = document.getElementById("img-preview");
        const closeImageModal = document.getElementsByClassName("close-image-modal")[0];
        function openLightbox(src) {
            if (imageModal && modalImg) {
                imageModal.style.display = "flex";
                // Reset zoom state
                modalImg.classList.remove('zoomed');
                setTimeout(() => {
                    imageModal.style.opacity = "1";
                }, 10);
                modalImg.src = src;
            }
        }
        if (modalImg) {
            modalImg.onclick = function(e) {
                e.stopPropagation();
                this.classList.toggle('zoomed');
            };
        }
        if (closeImageModal) {
            closeImageModal.onclick = function() {
                if (imageModal) {
                    imageModal.style.opacity = "0";
                    setTimeout(() => {
                        imageModal.style.display = "none";
                    }, 300);
                }
            }
        }
        if (imageModal) {
            imageModal.onclick = function(e) {
                if (e.target === imageModal) {
                    imageModal.style.opacity = "0";
                    setTimeout(() => {
                        imageModal.style.display = "none";
                    }, 300);
                }
            }
        }

        function toggleSidebar() {
            if (!conversationSidebar) return;
            const isOpen = conversationSidebar.classList.contains('open');
            if (isOpen) {
                conversationSidebar.classList.remove('open');
                if (dashboardContainer) dashboardContainer.classList.remove('sidebar-open');
            } else {
                updateConversationSidebar();
                conversationSidebar.classList.add('open');
                if (dashboardContainer) dashboardContainer.classList.add('sidebar-open');
            }
        }

        if (conversationInfoButton) {
            conversationInfoButton.addEventListener('click', toggleSidebar);
        }
        if (closeConversationSidebarButton) {
            closeConversationSidebarButton.addEventListener('click', () => {
                conversationSidebar.classList.remove('open');
                if (dashboardContainer) dashboardContainer.classList.remove('sidebar-open');
            });
        }

        // Edit Group Modal Logic
        const editGroupModal = document.getElementById('editGroupModal');
        const closeEditGroupModalBtn = document.getElementById('closeEditGroupModal');
        const confirmEditGroupBtn = document.getElementById('confirmEditGroupBtn');
        const editGroupNameInput = document.getElementById('editGroupName');
        let currentEditingGroupId = null;

        function openEditGroupModal(groupId, currentName) {
            currentEditingGroupId = groupId;
            if (editGroupNameInput) editGroupNameInput.value = currentName || '';
            if (editGroupModal) editGroupModal.classList.add('show');
        }

        if (closeEditGroupModalBtn) {
            closeEditGroupModalBtn.addEventListener('click', () => {
                if (editGroupModal) editGroupModal.classList.remove('show');
                currentEditingGroupId = null;
            });
        }
        
        // Close on outside click for edit group modal
        window.addEventListener('click', (e) => {
             if (e.target === editGroupModal) {
                 editGroupModal.classList.remove('show');
                 currentEditingGroupId = null;
             }
        });

        if (confirmEditGroupBtn) {
            confirmEditGroupBtn.addEventListener('click', async () => {
                if (!currentEditingGroupId) return;
                const newName = editGroupNameInput.value.trim();
                if (!newName) {
                    showNotification('Nazwa grupy nie może być pusta.', 'error');
                    return;
                }
                
                try {
                    const res = await fetch(`${API_URL}/groups/${currentEditingGroupId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ Name: newName })
                    });
                    
                    if (res.ok) {
                        showNotification('Nazwa grupy została zmieniona.', 'success');
                        if (editGroupModal) editGroupModal.classList.remove('show');
                        // Reload groups list
                        loadGroups();
                        // Update current chat view if open
                        if (currentChatId == currentEditingGroupId && currentChatType === 'group') {
                            const titleEl = document.getElementById('chat-title-text');
                            if (titleEl) titleEl.textContent = newName;
                            // Update sidebar if open
                            updateConversationSidebar();
                        }
                    } else {
                        const err = await res.json();
                        showNotification(err.message || 'Błąd edycji grupy.', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showNotification('Błąd połączenia.', 'error');
                }
            });
        }

    })();
    }
});
