const SERVER_URL = window.SERVER_BASE || (window.location.protocol === 'file:' ? 'http://localhost:6069' : window.location.origin);
const HUB_URL = `${SERVER_URL}/chatHub`;
const apiBase = window.API_URL || `${SERVER_URL}/api`;
const currentApiUrl = typeof API_URL !== 'undefined' ? API_URL : apiBase;
window.API_URL = currentApiUrl;
window.APP_JS_VERSION = '34';
const debugNetwork = (() => {
    try { return localStorage.getItem('debugNetwork') === '1'; } catch { return false; }
})();
if (debugNetwork) {
    console.info(`[diag] app.js loaded v=${window.APP_JS_VERSION} api=${currentApiUrl}`);
    window.addEventListener('load', () => console.info(`[diag] window load v=${window.APP_JS_VERSION}`), { once: true });
}
let productionBanner = null;
function ensureProductionBanner() {
    if (productionBanner && document.body.contains(productionBanner)) return productionBanner;
    const chatArea = document.querySelector('.chat-area');
    if (!chatArea) return null;
    const header = chatArea.querySelector('.chat-header');
    if (!header) return null;
    let el = document.getElementById('productionBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'productionBanner';
        el.className = 'production-banner';
        header.insertAdjacentElement('afterend', el);
    }
    productionBanner = el;
    return el;
}
function setProductionContent(content) {
    const el = ensureProductionBanner();
    if (!el) return;
    const text = (content ?? '').toString().trim();
    if (!text) {
        el.textContent = '';
        el.classList.remove('show');
        return;
    }
    el.textContent = text;
    el.classList.add('show');
}

let generalChannel = { name: 'Ogólny', avatarUrl: 'logo.png', updatedAt: null };
function applyGeneralChannelToGlobalItem() {
    const globalChatItem = document.getElementById('globalChatItem');
    if (!globalChatItem) return;
    const title = globalChatItem.querySelector('h4');
    if (title) title.textContent = generalChannel.name || 'Ogólny';
    const avatar = globalChatItem.querySelector('.avatar');
    if (avatar) {
        const av = generalChannel.avatarUrl;
        if (av) {
            avatar.style.backgroundImage = `url('${resolveUrl(av)}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.textContent = (generalChannel.name || 'O').charAt(0).toUpperCase();
        }
    }
}
async function loadGeneralChannel() {
    try {
        const res = await fetch(`${currentApiUrl}/general`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        generalChannel = {
            name: data.name || data.Name || 'Ogólny',
            avatarUrl: data.avatarUrl || data.AvatarUrl || 'logo.png',
            updatedAt: data.updatedAt || data.UpdatedAt || null
        };
        applyGeneralChannelToGlobalItem();
        if (currentChatType === 'global') {
            const chatHeader = document.querySelector('.chat-header h3');
            if (chatHeader) chatHeader.textContent = generalChannel.name || 'Ogólny';
            const headerAvatar = document.querySelector('.chat-header .avatar');
            if (headerAvatar) {
                headerAvatar.style.backgroundImage = `url('${resolveUrl(generalChannel.avatarUrl)}')`;
                headerAvatar.style.backgroundSize = 'cover';
                headerAvatar.style.backgroundPosition = 'center';
                headerAvatar.textContent = '';
            }
        }
    } catch (e) {}
}

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
            let base = window.API_BASE_URL || window.SERVER_BASE || (typeof SERVER_URL !== 'undefined' ? SERVER_URL : null);
            
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

    let replyingTo = null;
    let sentRequestsFailCount = 0;

    window.cancelReply = function() {
        replyingTo = null;
        const replyPreview = document.getElementById('reply-preview');
        if (replyPreview) {
            replyPreview.classList.remove('visible');
            setTimeout(() => {
                replyPreview.innerHTML = '';
                replyPreview.style.display = 'none';
            }, 200);
        }
    };

    window.replyToMessage = function(id, sender, content) {
        replyingTo = { id, sender, content };
        const replyPreview = document.getElementById('reply-preview');
        if (replyPreview) {
            replyPreview.style.display = 'flex';
            // Force reflow
            void replyPreview.offsetWidth;
            replyPreview.classList.add('visible');
            
            replyPreview.innerHTML = `
                <div class="reply-info">
                    <span class="reply-label">Odpowiadasz użytkownikowi <strong>${sender}</strong></span>
                    <span class="reply-content-preview">${content ? content.substring(0, 60) + (content.length > 60 ? '...' : '') : '📷 Obraz'}</span>
                </div>
                <button class="btn-close-reply" onclick="cancelReply()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            `;
        }
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    };

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
                localStorage.setItem('preferredTheme', 'original'); // Reset theme to original on logout
                localStorage.setItem('preferredTextSize', 'medium'); // Reset text size
                localStorage.removeItem('preferredSimpleText'); // Reset simple text preference
                
                // Force theme update immediately
                document.documentElement.setAttribute('data-theme', 'original');
                document.documentElement.setAttribute('data-text-size', 'medium');
                document.documentElement.removeAttribute('data-simple-text');

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
        // Initialize UI elements for settings and theme
        const themeDarkRadio = document.getElementById('themeDark');
        const themeClassicRadio = document.getElementById('themeClassic');
        const themeOriginalRadio = document.getElementById('themeOriginal');
        const themeNeonRadio = document.getElementById('themeNeon');
        const themeForestRadio = document.getElementById('themeForest');
        const themeKontrastRadio = document.getElementById('themeKontrast');
        const textSizeSlider = document.getElementById('textSizeSlider');
        const simpleTextToggle = document.getElementById('simpleTextToggle');
        const settingsUsername = document.getElementById('settingsUsername');
        const settingsEmail = document.getElementById('settingsEmail');
        const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        const settingsForm = document.getElementById('settingsForm');

        window.themeDarkRadio = themeDarkRadio;
        window.themeClassicRadio = themeClassicRadio;
        window.themeOriginalRadio = themeOriginalRadio;
        window.themeNeonRadio = themeNeonRadio;
        window.themeForestRadio = themeForestRadio;
        window.themeKontrastRadio = themeKontrastRadio;
        window.textSizeSlider = textSizeSlider;
        window.simpleTextToggle = simpleTextToggle;
        
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
                // Apply cached theme immediately to avoid flash
                const theme = user.Theme || user.theme;
                if (theme) {
                    const currentTheme = localStorage.getItem('preferredTheme');
                    if (theme !== currentTheme) {
                         applyTheme(theme);
                         localStorage.setItem('preferredTheme', theme);
                    }
                }
                const textSize = user.TextSize || user.textSize;
                if (textSize) {
                    const currentSize = localStorage.getItem('preferredTextSize');
                    if (textSize !== currentSize) {
                         applyTextSize(textSize);
                         localStorage.setItem('preferredTextSize', textSize);
                    }
                }
                const isSimpleText = user.IsSimpleText !== undefined ? user.IsSimpleText : user.isSimpleText;
                if (isSimpleText !== undefined) {
                    const currentSimple = localStorage.getItem('preferredSimpleText') === 'true';
                    if (isSimpleText !== currentSimple) {
                         applySimpleText(isSimpleText);
                         localStorage.setItem('preferredSimpleText', isSimpleText);
                    }
                }
            } catch (e) {
                console.error('Error parsing user from localStorage', e);
            }
        }

        if (!token) {
            window.location.href = '/login.php';
            return;
        }

        // Always fetch latest user data to sync settings
        try {
                    const response = await fetch(`${currentApiUrl}/Users/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
            if (response.ok) {
                const freshUser = await response.json();
                user = freshUser;
                localStorage.setItem('user', JSON.stringify(user));
                
                // Apply fresh theme settings
                const theme = user.Theme || user.theme;
                if (theme) {
                    applyTheme(theme);
                    localStorage.setItem('preferredTheme', theme);
                    if (window.themeDarkRadio) window.themeDarkRadio.checked = (theme === 'dark');
                    if (window.themeClassicRadio) window.themeClassicRadio.checked = (theme === 'classic');
                    if (window.themeOriginalRadio) window.themeOriginalRadio.checked = (theme === 'original');
                    if (window.themeNeonRadio) window.themeNeonRadio.checked = (theme === 'neon');
                    if (window.themeForestRadio) window.themeForestRadio.checked = (theme === 'forest');
                    if (window.themeKontrastRadio) window.themeKontrastRadio.checked = (theme === 'kontrast');
                }
                const textSize = user.TextSize || user.textSize;
                if (textSize) {
                    applyTextSize(textSize);
                    localStorage.setItem('preferredTextSize', textSize);
                    if (window.textSizeSlider) {
                         const sizeMap = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
                         window.textSizeSlider.value = sizeMap[textSize] !== undefined ? sizeMap[textSize] : 1;
                    }
                }
                const isSimpleText = user.IsSimpleText !== undefined ? user.IsSimpleText : user.isSimpleText;
                if (isSimpleText !== undefined) {
                    applySimpleText(isSimpleText);
                    localStorage.setItem('preferredSimpleText', isSimpleText);
                    if (window.simpleTextToggle) window.simpleTextToggle.checked = isSimpleText;
                }
                console.log('User session synced:', user);
            } else {
                if (!user) {
                    console.warn('Session expired or invalid');
                    localStorage.removeItem('token');
                    window.location.href = '/login.php';
                    return;
                }
            }
        } catch (e) {
            console.error('Network error recovering session:', e);
            if (!user) {
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
        const userAvatarLargeEls = document.querySelectorAll('.avatar-large');
        
        if (userNameEl) {
            userNameEl.textContent = user.username || user.userName || user.email || 'Użytkownik';
        }
        
        if (userAvatarEl) {
            const uAv = user.avatarUrl || user.AvatarUrl;
            if (uAv) {
                const url = `url('${resolveUrl(uAv)}')`;
                userAvatarEl.style.backgroundImage = url;
                userAvatarEl.style.backgroundSize = 'cover';
                userAvatarEl.textContent = '';
                
                // Update .avatar-large elements
                userAvatarLargeEls.forEach(el => {
                    el.style.backgroundImage = url;
                    el.style.backgroundSize = 'cover';
                    el.textContent = '';
                    el.style.display = '';
                    el.style.alignItems = '';
                    el.style.justifyContent = '';
                    el.style.backgroundColor = '';
                });
            } else {
                const nameForAvatar = user.username || user.userName || user.email || '?';
                const initial = nameForAvatar.charAt(0).toUpperCase();
                
                userAvatarEl.textContent = initial;
                userAvatarEl.style.backgroundImage = '';
                userAvatarEl.style.display = 'flex';
                userAvatarEl.style.alignItems = 'center';
                userAvatarEl.style.justifyContent = 'center';
                
                // Update .avatar-large elements
                userAvatarLargeEls.forEach(el => {
                    el.textContent = initial;
                    el.style.backgroundImage = '';
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.style.backgroundColor = 'var(--accent-green)'; // Fallback color if needed
                });
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
        let sentRequests = [];
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
        let globalVolume = parseFloat(localStorage.getItem('globalVolume'));
        if (isNaN(globalVolume)) globalVolume = 1.0;
        notificationSound.volume = globalVolume;
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
        loadSentRequests();

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

        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.value = Math.round(globalVolume * 100);
            volumeSlider.title = `Głośność: ${volumeSlider.value}%`;
            
            volumeSlider.addEventListener('input', () => {
                const val = parseInt(volumeSlider.value);
                globalVolume = val / 100;
                localStorage.setItem('globalVolume', globalVolume);
                volumeSlider.title = `Głośność: ${val}%`;
                
                if (notificationSound) notificationSound.volume = globalVolume;
                if (window.logoAudio) window.logoAudio.volume = globalVolume;
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
        {
            const savedVol = parseFloat(localStorage.getItem('globalVolume'));
            window.logoAudio.volume = isNaN(savedVol) ? 1.0 : savedVol;
        }
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
        
        // Apply persisted experimental modes on load
        try {
            const savedRainbow = localStorage.getItem('exp_rainbowMode') === 'true';
            if (savedRainbow) document.body.classList.add('rainbow-mode');
            const savedSpin = localStorage.getItem('exp_spinMode') === 'true';
            if (savedSpin) document.body.classList.add('spin-avatars');
        } catch {}
        if (logoContainer) {
            let logoClickCount = 0;
            let logoClickResetTimeout = null;

            logoContainer.onclick = () => {
                // Secret Menu Logic
                logoClickCount++;
                if (logoClickResetTimeout) clearTimeout(logoClickResetTimeout);
                logoClickResetTimeout = setTimeout(() => {
                    logoClickCount = 0;
                }, 5000); // 5 seconds reset

                if (logoClickCount >= 15) {
                    logoClickCount = 0;
                    
                    console.log(`%c
_____                     _   _   _           _   
  |  __ \\                   | | | \\ | |         | |  
  | |__) |_ _ _ __ _ __ ___ | |_|  \\| | ___  ___| |_ 
  |  ___/ _\` | '__| '__/ _ \\| __| . \` |/ _ \\/ __| __| 
  | |  | (_| | |  | | | (_) | |_| |\\  |  __/\__ \\ |_ 
  |_|   \\__,_|_|  |_|  \\___/ \\__|_| \\_\\|___||___/\\__| 
                                                     
`, "color: #00ff00; font-weight: bold;");

                    // Logic for Secret Menu visibility:
                    // Requirement: Only friends defined in the system should see it.
                    // Implementation: If the user has any friends (is part of the network), allow access.
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const isAuthorized = friends && friends.length > 0;
                    
                    if (!isAuthorized) {
                        console.warn("Access to Secret Menu denied: User must have friends in the system.");
                        showNotification("Tylko zweryfikowani członkowie gniazda (posiadający znajomych) mają tu wstęp!", "warning");
                        return;
                    }

                    const secretMenu = document.getElementById('secretMenu');
                    if (secretMenu) {
                        secretMenu.classList.add('show');
                        
                        // Initialize secret menu controls if not already done
                         if (!secretMenu.dataset.initialized) {
                            secretMenu.dataset.initialized = "true";
                            
                            const closeSecretMenu = document.getElementById('closeSecretMenu');
                            if (closeSecretMenu) {
                                closeSecretMenu.onclick = () => secretMenu.classList.remove('show');
                            }

                            // Rainbow Mode
                            const rainbowMode = document.getElementById('rainbowMode');
                            if (rainbowMode) {
                                try {
                                    const wasOn = localStorage.getItem('exp_rainbowMode') === 'true';
                                    rainbowMode.checked = wasOn;
                                    if (wasOn) document.body.classList.add('rainbow-mode');
                                } catch {}
                                rainbowMode.onchange = (e) => {
                                    const checked = !!e.target.checked;
                                    try { localStorage.setItem('exp_rainbowMode', checked ? 'true' : 'false'); } catch {}
                                    if (checked) document.body.classList.add('rainbow-mode');
                                    else document.body.classList.remove('rainbow-mode');
                                };
                            }

                            // Spin Mode
                            const spinMode = document.getElementById('spinMode');
                            if (spinMode) {
                                try {
                                    const wasOn = localStorage.getItem('exp_spinMode') === 'true';
                                    spinMode.checked = wasOn;
                                    if (wasOn) document.body.classList.add('spin-avatars');
                                } catch {}
                                spinMode.onchange = (e) => {
                                    const checked = !!e.target.checked;
                                    try { localStorage.setItem('exp_spinMode', checked ? 'true' : 'false'); } catch {}
                                    if (checked) document.body.classList.add('spin-avatars');
                                    else document.body.classList.remove('spin-avatars');
                                };
                            }
                            
                            // Hell Mode
                            const hellMode = document.getElementById('hellMode');
                            if (hellMode) {
                                hellMode.onchange = (e) => {
                                    if (e.target.checked) {
                                        hellMode.checked = false;
                                                                                window.location.href = '/doom/doom.html';
                                    }
                                };
                            }
                         }
                    }
                }

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
                        const ext = (selectedImageFile.name.split('.').pop() || '').toLowerCase();
                        attachmentPreview.className = 'attachment-preview visible';
                        let previewInner = `
                            <div class="attachment-preview-close" title="Usuń">×</div>
                            <div style="display:flex;align-items:center;gap:8px;">
                        `;
                        if (['png','jpg','jpeg','gif','webp','bmp'].includes(ext)) {
                            previewInner += `<img src="${url}" alt="Podgląd" style="max-height:64px;border-radius:6px;">`;
                        } else if (['mp4','avi','webm','mov'].includes(ext)) {
                            previewInner += `<video src="${url}" style="max-height:64px;border-radius:6px;" muted></video>`;
                        } else {
                            previewInner += `<span class="material-symbols-outlined">description</span>`;
                        }
                        previewInner += `
                            <div style="font-size: 0.8rem; color: var(--text-muted);">
                                ${selectedImageFile.name} (${sizeKb} KB)
                            </div>
                            </div>
                        `;
                        attachmentPreview.innerHTML = previewInner;
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
                    try {
                        const maxSize = 100 * 1024 * 1024;
                        if (selectedImageFile.size > maxSize) {
                            showNotification('Plik przekracza limit 100MB.', 'error');
                            return;
                        }
                        let uploadUrl = null;
                        if (selectedImageFile.size > (5 * 1024 * 1024)) {
                            const initRes = await fetch(`${currentApiUrl}/files/initiate`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    fileName: selectedImageFile.name, 
                                    size: selectedImageFile.size, 
                                    mimeType: selectedImageFile.type || null 
                                })
                            });
                            if (!initRes.ok) {
                                await handleApiError(initRes, 'Nie udało się zainicjować przesyłania');
                                return;
                            }
                            const initData = await initRes.json();
                            const uploadId = initData.uploadId;
                            const chunkSize = initData.chunkSize || (2 * 1024 * 1024);
                            let offset = 0;
                            while (offset < selectedImageFile.size) {
                                const slice = selectedImageFile.slice(offset, Math.min(offset + chunkSize, selectedImageFile.size));
                                const chunkBuf = await slice.arrayBuffer();
                                const chunkRes = await fetch(`${currentApiUrl}/files/chunk/${uploadId}?offset=${offset}`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}` },
                                    body: chunkBuf
                                });
                                if (!chunkRes.ok) {
                                    await handleApiError(chunkRes, 'Błąd przesyłania fragmentu');
                                    return;
                                }
                                const jr = await chunkRes.json();
                                offset = jr.nextOffset || (offset + chunkSize);
                            }
                            const completeRes = await fetch(`${currentApiUrl}/files/complete/${uploadId}`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (!completeRes.ok) {
                                await handleApiError(completeRes, 'Nie udało się zakończyć przesyłania');
                                return;
                            }
                            const comp = await completeRes.json();
                            uploadUrl = comp.url;
                        } else {
                            const formData = new FormData();
                            formData.append('file', selectedImageFile);
                            const response = await fetch(`${currentApiUrl}/messages/upload`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                                body: formData
                            });
                            if (!response.ok) {
                                await handleApiError(response, 'Upload nie powiódł się');
                                return;
                            }
                            const data = await response.json();
                            uploadUrl = data.url;
                        }
                        imageUrl = uploadUrl;
                        selectedImageFile = null;
                        imageInput.value = '';
                        if (attachmentPreview) {
                            attachmentPreview.className = 'attachment-preview';
                            attachmentPreview.style.display = 'none';
                            attachmentPreview.innerHTML = '';
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
                        
                        // Ensure IDs are integers or null
                        let chatIdInt = null;
                        if (currentChatId !== null && currentChatId !== undefined && !isNaN(currentChatId)) {
                             chatIdInt = parseInt(currentChatId);
                        }
                        
                        let replyId = null;
                        if (replyingTo && replyingTo.id) {
                            replyId = parseInt(replyingTo.id);
                            if (isNaN(replyId)) replyId = null;
                        }

                        const safeImageUrl = imageUrl || null;
                        const safeReplyId = replyId ? parseInt(replyId) : null;
                        const safeChatId = isNaN(chatIdInt) ? null : chatIdInt;

                        console.log("Sending message:", { senderName, message, safeImageUrl, currentChatType, safeChatId, safeReplyId });

                        if (currentChatType === 'group') {
                            await connection.invoke("SendMessage", senderName, message, safeImageUrl, null, safeChatId, safeReplyId);
                        } else if (currentChatType === 'private') {
                            await connection.invoke("SendMessage", senderName, message, safeImageUrl, safeChatId, null, safeReplyId);
                        } else {
                            await connection.invoke("SendMessage", senderName, message, safeImageUrl, null, null, safeReplyId);
                        }
                        
                        cancelReply();

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
                        let errMsg = 'Nie udało się wysłać wiadomości.';
                        if (err && err.message) {
                            if (err.message.includes("HubException:")) {
                                errMsg = err.message.split("HubException:")[1].trim();
                            } else {
                                errMsg += ' ' + err.message;
                            }
                        }
                        showNotification(errMsg, 'error');
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
        connection.on("FriendRequestAccepted", async (data) => {
            console.log("[App] FriendRequestAccepted EVENT RECEIVED:", data);
            
            // Play sound
            if (typeof notificationsMuted === 'undefined' || !notificationsMuted) {
                try {
                    const key = localStorage.getItem('notificationSound') || 'original';
                    if (typeof notificationSoundConfig !== 'undefined') {
                        const cfg = notificationSoundConfig[key] || notificationSoundConfig.original;
                        if (cfg && notificationSound) {
                            notificationSound.src = cfg.src;
                            notificationSound.play().catch(e => console.log('Sound play error:', e));
                        }
                    }
                } catch (e) { console.warn('Sound error:', e); }
            }
            
            // Show toast
            if (typeof showNotification === 'function') {
                showNotification(`Użytkownik ${data.username} zaakceptował Twoje zaproszenie!`, 'success');
            }
            
            // Browser notification
            try {
                if (window.Notification && Notification.permission === "granted" && document.hidden) {
                    new Notification(`Zaproszenie zaakceptowane`, {
                        body: `${data.username} jest teraz Twoim znajomym!`,
                        icon: data.avatarUrl ? resolveUrl(data.avatarUrl) : 'parrot.png'
                    });
                }
            } catch (e) {}
            
            // Refresh lists
            try {
                if (typeof loadFriends === 'function') await loadFriends();
                if (typeof loadSentRequests === 'function') await loadSentRequests();
            } catch (e) { console.error('Refresh list error:', e); }
        });

        connection.on("FriendRequestReceived", async (data) => {
            console.log("[App] FriendRequestReceived EVENT RECEIVED:", data);
            
            // Play sound
            if (typeof notificationsMuted === 'undefined' || !notificationsMuted) {
                try {
                    const key = localStorage.getItem('notificationSound') || 'original';
                    if (typeof notificationSoundConfig !== 'undefined') {
                        const cfg = notificationSoundConfig[key] || notificationSoundConfig.original;
                        if (cfg && notificationSound) {
                            notificationSound.src = cfg.src;
                            notificationSound.play().catch(e => console.log('Sound play error:', e));
                        }
                    }
                } catch (e) { console.warn('Sound error:', e); }
            }
            
            // Show toast
            if (typeof showNotification === 'function') {
                showNotification(`Nowe zaproszenie od: ${data.username}`, 'info');
            }
            
            // Browser notification
            try {
                if (window.Notification && Notification.permission === "granted" && document.hidden) {
                    new Notification(`Nowe zaproszenie`, {
                        body: `Użytkownik ${data.username} chce Cię dodać do znajomych.`,
                        icon: data.avatarUrl ? resolveUrl(data.avatarUrl) : 'parrot.png'
                    });
                }
            } catch (e) {}
            
            // Refresh lists
            try {
                if (typeof loadPendingRequests === 'function') await loadPendingRequests();
            } catch (e) { console.error('Refresh list error:', e); }
        });

        connection.on("ReceiveMessage", (arg1, ...args) => {
            let senderId, senderUsername, message, imageUrl, receiverId, groupId, senderAvatarUrl, msgId, replyToId, replyToSender, replyToContent, reactions;
            
            if (typeof arg1 === 'object') {
                const d = arg1;
                senderId = d.SenderId || d.senderId;
                senderUsername = d.Sender || d.sender;
                message = d.Content || d.content;
                imageUrl = d.ImageUrl || d.imageUrl;
                receiverId = d.ReceiverId || d.receiverId;
                groupId = d.GroupId || d.groupId;
                senderAvatarUrl = d.SenderAvatarUrl || d.senderAvatarUrl;
                msgId = d.Id || d.id;
                replyToId = d.ReplyToId || d.replyToId;
                replyToSender = d.ReplyToSender || d.replyToSender;
                replyToContent = d.ReplyToContent || d.replyToContent;
                reactions = d.Reactions || d.reactions;
            } else {
                 [senderId, senderUsername, message, imageUrl, receiverId, groupId, senderAvatarUrl, msgId] = [arg1, ...args];
            }

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
                    // Mark unread on chat list if message not in active view
                    try {
                        if (groupId) {
                            markUnreadBadge('group', groupId);
                        } else if (receiverId) {
                            // If it's a private message and not our own, mark the other participant
                            const currentUser = JSON.parse(localStorage.getItem('user'));
                            const currentUserId = currentUser.id || currentUser.Id;
                            const peerId = (parseInt(senderId) === parseInt(currentUserId)) ? receiverId : senderId;
                            markUnreadBadge('private', peerId);
                        } else {
                            markUnreadBadge('global', null);
                        }
                    } catch {}
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

            if (msgId) {
                const actionsDiv = document.createElement("div");
                actionsDiv.className = "message-actions";
                
                const replyBtn = document.createElement("button");
                replyBtn.className = "btn-msg-action";
                replyBtn.title = "Odpowiedz";
                replyBtn.innerHTML = `<span class="material-symbols-outlined">reply</span>`;
                replyBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.replyToMessage(msgId, senderUsername, message);
                };
                actionsDiv.appendChild(replyBtn);

                const reactBtn = document.createElement("button");
                reactBtn.className = "btn-msg-action";
                reactBtn.title = "Zareaguj";
                reactBtn.innerHTML = `<span class="material-symbols-outlined">add_reaction</span>`;
                reactBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.toggleReactionPicker(msgId, reactBtn);
                };
                actionsDiv.appendChild(reactBtn);

                if (isOwnMessage) {
                    const deleteBtn = document.createElement("button");
                    deleteBtn.className = "btn-msg-action btn-delete";
                    deleteBtn.title = "Usuń wiadomość";
                    deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteMessage(msgId);
                    };
                    actionsDiv.appendChild(deleteBtn);
                }
                
                row.appendChild(actionsDiv);
            }
            
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
            
            if (replyToId && replyToSender) {
                 const quote = document.createElement("div");
                 quote.className = "message-reply-quote";
                 quote.onclick = (e) => {
                     e.stopPropagation();
                     if (window.scrollToMessage) window.scrollToMessage(replyToId);
                 };
                 quote.innerHTML = `<strong>${replyToSender}</strong><span>${replyToContent || '📷 Obraz'}</span>`;
                 msgDiv.appendChild(quote);
            }

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

            if (reactions) {
                try {
                    const rList = typeof reactions === 'string' ? JSON.parse(reactions) : reactions;
                    if (rList && rList.length > 0) {
                        const rDiv = document.createElement("div");
                        rDiv.className = "message-reactions";
                        const groups = {};
                        rList.forEach(r => {
                            if (!groups[r.e]) groups[r.e] = [];
                            groups[r.e].push(r.u);
                        });
                        Object.keys(groups).forEach(e => {
                            const badge = document.createElement("div");
                            badge.className = "reaction-badge";
                            const count = groups[e].length;
                            const isMe = groups[e].includes(parseInt(currentUserId));
                            if (isMe) badge.classList.add('self-reacted');
                            badge.innerHTML = `<span class="emoji">${e}</span> <span class="count">${count}</span>`;
                            badge.onclick = (ev) => { ev.stopPropagation(); window.reactToMessage(msgId, e); };
                            rDiv.appendChild(badge);
                        });
                        const addBtn = document.createElement("div");
                        addBtn.className = "reaction-badge add-reaction-btn";
                        addBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.1rem;">add_reaction</span>`;
                        addBtn.title = "Dodaj reakcję";
                        addBtn.onclick = (e) => {
                            e.stopPropagation();
                            window.toggleReactionPicker(msgId, addBtn);
                        };
                        rDiv.appendChild(addBtn);
                        
                        msgDiv.appendChild(rDiv);
                    }
                } catch(e) {}
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
        connection.on("MessageReactionUpdated", (messageId, reactionsJson) => {
            const wrapper = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
            if (!wrapper) return;
            
            const msgDiv = wrapper.querySelector('.message');
            if (!msgDiv) return;

            let rDiv = msgDiv.querySelector('.message-reactions');
            
            try {
                const rList = typeof reactionsJson === 'string' ? JSON.parse(reactionsJson) : reactionsJson;
                
                if (!rList || rList.length === 0) {
                    if (rDiv) rDiv.remove();
                    return;
                }

                if (!rDiv) {
                    rDiv = document.createElement("div");
                    rDiv.className = "message-reactions";

                    const timestamp = msgDiv.querySelector('.message-time');
                    if (timestamp) {
                        msgDiv.insertBefore(rDiv, timestamp);
                    } else {
                        msgDiv.appendChild(rDiv);
                    }
                }
                
                rDiv.innerHTML = '';
                
                const groups = {};
                rList.forEach(r => {
                    if (!groups[r.e]) groups[r.e] = [];
                    groups[r.e].push(r.u);
                });
                
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const currentUserId = currentUser.id || currentUser.Id;

                Object.keys(groups).forEach(e => {
                    const badge = document.createElement("div");
                    badge.className = "reaction-badge";
                    const count = groups[e].length;
                    const isMe = groups[e].includes(parseInt(currentUserId));
                    if (isMe) badge.classList.add('self-reacted');
                    badge.innerHTML = `<span class="emoji">${e}</span> <span class="count">${count}</span>`;
                    badge.onclick = (ev) => { ev.stopPropagation(); window.reactToMessage(messageId, e); };
                    rDiv.appendChild(badge);
                });
                
                // Add "Add Reaction" button at the end
                const addBtn = document.createElement("div");
                addBtn.className = "reaction-badge add-reaction-btn";
                addBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.1rem;">add_reaction</span>`;
                addBtn.title = "Dodaj reakcję";
                addBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.toggleReactionPicker(messageId, addBtn);
                };
                rDiv.appendChild(addBtn);
            } catch (e) {
                console.error("Error updating reactions", e);
            }
        });

        connection.on("ReceiveSignal", async (user, signal) => {
            try {
                const signalData = JSON.parse(signal);
                console.log("Received signal from", user, signalData);
            } catch (e) {
                console.error("Error parsing signal:", e);
            }
        });
        connection.on("ProductionContentUpdated", (payload) => {
            try {
                setProductionContent(payload?.content ?? '');
            } catch (e) {}
        });
        connection.on("GeneralChannelUpdated", (payload) => {
            try {
                generalChannel = {
                    name: payload?.name || generalChannel.name,
                    avatarUrl: payload?.avatarUrl || generalChannel.avatarUrl,
                    updatedAt: payload?.updatedAt || generalChannel.updatedAt
                };
                applyGeneralChannelToGlobalItem();
                if (currentChatType === 'global') {
                    selectChat(null, generalChannel.name, generalChannel.avatarUrl, 'global');
                }
            } catch (e) {}
        });
        let allUsersEndpointAvailable = true;
        let allUsersInFlight = null;
        let allUsersCache = null;
        let allUsersCacheAt = 0;
        let allUsersDisabledUntil = 0;
        const ALL_USERS_CACHE_MS = 15000;
        async function fetchAllUsersSafe() {
            if (!token) return null;
            if (!allUsersEndpointAvailable) return null;
            const now = Date.now();
            if (now < allUsersDisabledUntil) return null;
            if (allUsersCache && (now - allUsersCacheAt) < ALL_USERS_CACHE_MS) return allUsersCache;
            if (allUsersInFlight) return allUsersInFlight;

            allUsersInFlight = (async () => {
                const start = performance && performance.now ? performance.now() : Date.now();
                try {
                    if (debugNetwork) console.info('[diag] Users/all fetch start');
                    const res = await fetch(`${currentApiUrl}/Users/all`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                        cache: 'no-store'
                    });
                    if (debugNetwork) console.info(`[diag] Users/all fetch response status=${res.status} ms=${Math.round(((performance && performance.now ? performance.now() : Date.now()) - start))}`);
                    if (res.status === 404) {
                        allUsersEndpointAvailable = false;
                        return null;
                    }
                    if (!res.ok) return null;
                    let data;
                    try {
                        data = await res.json();
                    } catch {
                        return null;
                    }
                    const users = Array.isArray(data) ? data : [];
                    allUsersCache = users;
                    allUsersCacheAt = Date.now();
                    return users;
                } catch (e) {
                    if (e && (e.name === 'AbortError' || String(e).includes('ERR_ABORTED'))) {
                        allUsersDisabledUntil = Date.now() + 10000;
                        if (debugNetwork) console.warn('[diag] Users/all fetch aborted');
                    }
                    if (debugNetwork) console.warn('[diag] Users/all fetch failed', e);
                    return null;
                } finally {
                    if (debugNetwork) console.info('[diag] Users/all fetch end');
                    allUsersInFlight = null;
                }
            })();

            return allUsersInFlight;
        }

        function markUnreadBadge(type, id) {
            try {
                let item = null;
                if (type === 'group' && id != null) {
                    item = document.querySelector(`.chat-item[data-group-id="${id}"]`);
                } else if (type === 'private' && id != null) {
                    item = document.querySelector(`.chat-item[data-friend-id="${id}"]`);
                } else if (type === 'global') {
                    item = document.getElementById('globalChatItem');
                }
                if (!item) return;
                let badge = item.querySelector('.chat-unread-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'chat-unread-badge';
                    badge.textContent = '1';
                    item.appendChild(badge);
                } else {
                    const n = parseInt(badge.textContent || '0') || 0;
                    badge.textContent = String(n + 1);
                }
            } catch {}
        }

        function clearUnreadBadge(type, id) {
            try {
                let item = null;
                if (type === 'group' && id != null) {
                    item = document.querySelector(`.chat-item[data-group-id="${id}"]`);
                } else if (type === 'private' && id != null) {
                    item = document.querySelector(`.chat-item[data-friend-id="${id}"]`);
                } else if (type === 'global') {
                    item = document.getElementById('globalChatItem');
                }
                if (!item) return;
                const badge = item.querySelector('.chat-unread-badge');
                if (badge) badge.remove();
            } catch {}
        }
        async function loadFriends() {
            try {
                const response = await fetch(`${currentApiUrl}/friends`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    cache: 'no-store'
                });
                if (response.ok) {
                    friends = await response.json();
                    updateChatList();
                    
                    // If Global Chat is open, refresh member list (uses all users now)
                    if (currentChatType === 'global' && conversationSidebar && conversationSidebar.classList.contains('open')) {
                         updateConversationSidebar();
                    }
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
                const response = await fetch(`${currentApiUrl}/groups`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    cache: 'no-store'
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
        async function loadProductionContent() {
            try {
                const res = await fetch(`${currentApiUrl}/production/current`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    cache: 'no-store'
                });
                if (!res.ok) return;
                const data = await res.json();
                setProductionContent(data?.content ?? '');
            } catch (e) {}
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
                const response = await fetch(`${currentApiUrl}/friends/pending`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    cache: 'no-store'
                });
                if (response.ok) {
                    try {
                        pendingRequests = await response.json();
                        updateChatList();
                        updateNotificationBadge();
                        renderPendingRequestsModal();
                    } catch (e) {
                         console.error('Error parsing pending requests JSON:', e);
                    }
                } else {
                    await handleApiError(response, 'Błąd pobierania zaproszeń');
                }
            } catch (error) {
                console.error('Error loading pending requests:', error);
            }
        }

        async function loadSentRequests() {
            // Retry logic relaxed for debugging
            if (sentRequestsFailCount > 10) {
                console.warn('loadSentRequests stopped due to repeated failures');
                return;
            }
            try {
                console.log(`Fetching sent requests from: ${currentApiUrl}/friends/sent`);
                const response = await fetch(`${currentApiUrl}/friends/sent`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    sentRequestsFailCount = 0;
                    try {
                        sentRequests = await response.json();
                        updateChatList();
                        renderSentRequestsModal();
                    } catch (e) {
                        console.error('Error parsing sent requests JSON:', e);
                    }
                } else {
                    sentRequestsFailCount++;
                    const errorText = await response.text();
                    console.error('Failed to load sent requests', response.status, errorText);
                    if (response.status === 405 || response.status === 404) {
                        console.error("Method Not Allowed or Not Found. Check CORS or API endpoint:", `${currentApiUrl}/friends/sent`);
                        sentRequestsFailCount = 100; // Stop retrying immediately
                    }
                }
            } catch (error) {
                sentRequestsFailCount++;
                console.error('Error loading sent requests:', error);
            }
        }
        async function cancelSentRequest(friendshipId) {
            if (!confirm('Czy na pewno chcesz anulować wysłane zaproszenie?')) return;
            try {
                const response = await fetch(`${currentApiUrl}/friends/${friendshipId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    showNotification('Zaproszenie anulowane.', 'success');
                    loadSentRequests();
                } else {
                    showNotification('Nie udało się anulować zaproszenia.', 'error');
                }
            } catch (error) {
                console.error('Error canceling request:', error);
            }
        }

        async function acceptFriend(friendshipId) {
            try {
                const response = await fetch(`${currentApiUrl}/friends/accept/${friendshipId}`, {
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
                const response = await fetch(`${currentApiUrl}/friends/${friendshipId}`, {
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
            if (groupsFolder) chatList.appendChild(groupsFolder);
            if (friendsFolder) chatList.appendChild(friendsFolder);

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
                    const rAv = req.avatarUrl || req.AvatarUrl;
                    if (rAv) {
                        avatar.style.backgroundImage = `url('${resolveUrl(rAv)}')`;
                        avatar.style.backgroundSize = 'cover';
                        avatar.style.backgroundPosition = 'center';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = (req.username || req.Username || 'U').charAt(0).toUpperCase();
                    }
                    const nameDiv = document.createElement('div');
                    nameDiv.style.fontWeight = 'bold';
                    nameDiv.textContent = req.username || req.Username || 'Użytkownik';
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
                    acceptBtn.style.color = 'var(--btn-text-color, white)';
                    acceptBtn.style.cursor = 'pointer';
                    acceptBtn.style.fontSize = '0.8rem';
                    acceptBtn.onclick = (e) => {
                        e.stopPropagation();
                        acceptFriend(req.id || req.Id);
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
                        rejectFriend(req.id || req.Id);
                    };
                    actionsDiv.appendChild(acceptBtn);
                    actionsDiv.appendChild(rejectBtn);
                    reqItem.appendChild(headerDiv);
                    reqItem.appendChild(actionsDiv);
                    chatList.appendChild(reqItem);
                });
            }

            if (sentRequests && sentRequests.length > 0) {
                const sentHeader = document.createElement('div');
                sentHeader.textContent = 'Wysłane zaproszenia';
                sentHeader.style.padding = '10px 20px';
                sentHeader.style.fontSize = '0.75rem';
                sentHeader.style.fontWeight = 'bold';
                sentHeader.style.color = 'var(--text-secondary)';
                sentHeader.style.textTransform = 'uppercase';
                sentHeader.style.letterSpacing = '1px';
                chatList.appendChild(sentHeader);

                sentRequests.forEach(req => {
                    const reqItem = document.createElement('div');
                    reqItem.className = 'chat-item sent-request';
                    reqItem.style.cursor = 'default';
                    reqItem.style.gap = '10px';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    
                    const rAv = req.avatarUrl || req.AvatarUrl;
                    if (rAv) {
                        avatar.style.backgroundImage = `url('${resolveUrl(rAv)}')`;
                        avatar.style.backgroundSize = 'cover';
                        avatar.style.backgroundPosition = 'center';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = (req.username || req.Username || 'U').charAt(0).toUpperCase();
                    }

                    const nameDiv = document.createElement('div');
                    nameDiv.style.fontWeight = 'bold';
                    nameDiv.textContent = req.username || req.Username || 'Użytkownik';
                    
                    const actionsDiv = document.createElement('div');
                    actionsDiv.style.marginLeft = 'auto';
                    
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Anuluj';
                    cancelBtn.style.padding = '2px 8px';
                    cancelBtn.style.fontSize = '0.7rem';
                    cancelBtn.style.backgroundColor = 'transparent';
                    cancelBtn.style.color = 'var(--text-muted)';
                    cancelBtn.style.border = '1px solid var(--border-color)';
                    cancelBtn.style.borderRadius = '4px';
                    cancelBtn.style.cursor = 'pointer';
                    cancelBtn.onclick = (e) => {
                        e.stopPropagation();
                        cancelSentRequest(req.id || req.Id);
                    };
                    
                    actionsDiv.appendChild(cancelBtn);

                    reqItem.appendChild(avatar);
                    reqItem.appendChild(nameDiv);
                    reqItem.appendChild(actionsDiv);
                    chatList.appendChild(reqItem);
                });
            }
            if (groups.length > 0 && groupsFolderBody) {
                groupsFolderBody.innerHTML = '';
                groups.forEach(group => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    const gId = group.id || group.Id;
                    chatItem.dataset.groupId = gId;
                    if (currentChatType === 'group' && currentChatId == gId) {
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
                            avatar.textContent = (group.name || group.Name || 'G').charAt(0).toUpperCase();
                            avatar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }
                    }
                    const chatInfo = document.createElement('div');
                    chatInfo.className = 'chat-info';
                    const h4 = document.createElement('h4');
                    h4.textContent = group.name || group.Name;
                    chatInfo.appendChild(h4);
                    chatItem.appendChild(avatar);
                    chatItem.appendChild(chatInfo);
                    chatItem.addEventListener('click', () => {
                        const gAv = group.avatarUrl || group.AvatarUrl;
                        selectChat(gId, group.name || group.Name, gAv, 'group');
                    });
                    groupsFolderBody.appendChild(chatItem);
                });
            }
            if (friends.length > 0 && friendsFolderBody) {
                friendsFolderBody.innerHTML = '';
                friends.forEach(friend => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    const fId = friend.id || friend.Id;
                    chatItem.dataset.friendId = fId;
                    if (currentChatType === 'private' && currentChatId == fId) {
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
                            avatar.textContent = (friend.username || friend.Username || 'U').charAt(0).toUpperCase();
                        }
                    }
                    const chatInfo = document.createElement('div');
                    chatInfo.className = 'chat-info';
                    const h4 = document.createElement('h4');
                    h4.textContent = friend.username || friend.Username;
                    chatInfo.appendChild(h4);
                    
                    const status = friend.status || friend.Status || (friend.isOnline || friend.IsOnline ? 1 : 0);
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
                        if (!confirm(`Usunąć znajomego ${friend.username || friend.Username}?`)) return;
                        try {
                            const response = await fetch(`${currentApiUrl}/friends/${fId}`, {
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
                name.textContent = req.username || req.Username || `Użytkownik ${req.requesterId}`;
                const accept = document.createElement('button');
                accept.className = 'btn-secondary';
                accept.textContent = 'Akceptuj';
                accept.onclick = async () => {
                    try {
                        const response = await fetch(`${currentApiUrl}/friends/accept/${req.id || req.Id}`, {
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
                        const response = await fetch(`${currentApiUrl}/friends/${req.id || req.Id}`, {
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

        function renderSentRequestsModal() {
            const list = document.getElementById('sentRequestsList');
            if (!list) return;
            list.innerHTML = '';
            if (!sentRequests || sentRequests.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = 'var(--text-muted)';
                empty.style.fontSize = '0.8rem';
                empty.style.width = '100%';
                empty.style.textAlign = 'center';
                empty.textContent = 'Brak wysłanych zaproszeń.';
                list.appendChild(empty);
                return;
            }
            sentRequests.forEach(req => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '10px';
                const avatar = document.createElement('div');
                avatar.className = 'avatar';
                
                const rAv = req.avatarUrl || req.AvatarUrl;
                if (rAv) {
                    avatar.style.backgroundImage = `url('${resolveUrl(rAv)}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'center';
                    avatar.textContent = '';
                } else {
                    avatar.textContent = (req.username || 'U').charAt(0).toUpperCase();
                }
                
                const name = document.createElement('div');
                name.style.flex = '1';
                name.textContent = req.username || req.Username || 'Użytkownik';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn-secondary';
                cancelBtn.textContent = 'Anuluj';
                cancelBtn.onclick = () => cancelSentRequest(req.id || req.Id);

                row.appendChild(avatar);
                row.appendChild(name);
                row.appendChild(cancelBtn);
                list.appendChild(row);
            });
        }
        function normalizeChatType(inputType, chatId) {
            const t = (inputType ?? '').toString().toLowerCase();
            const hasId = !(chatId === null || chatId === undefined || chatId === '' || chatId === 'null' || chatId === 'undefined');
            if (t === 'global') return 'global';
            if (t === 'group' || t === 'private') return hasId ? t : 'global';
            if (!hasId) return 'global';
            return 'private';
        }
        async function selectChat(chatId, chatName, chatAvatar, type = 'private') {
            // Mobile: Open chat view
            document.body.classList.add('chat-open');

            type = normalizeChatType(type, chatId);
            if (type === 'global') chatId = null;

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
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const isAdminGlobal = currentUser && (currentUser.isAdmin || currentUser.IsAdmin);
                if (typeof window.initAdminPanel === 'function') {
                    await window.initAdminPanel();
                }
                if (type === 'global' && isAdminGlobal) {
                    newAvatar.style.cursor = 'pointer';
                    newAvatar.title = 'Kliknij, aby zmienić ikonę kanału ogólnego';
                    newAvatar.onclick = async () => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('avatar', file);
                            try {
                                showNotification('Wysyłanie ikony...', 'info');
                                const response = await fetch(`${currentApiUrl}/general/avatar`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${token}` },
                                    body: formData
                                });
                                if (response.ok) {
                                    const data = await response.json();
                                    const newUrl = resolveUrl(data.url);
                                    generalChannel.avatarUrl = data.url;
                                    newAvatar.style.backgroundImage = `url('${newUrl}')`;
                                    newAvatar.style.backgroundSize = 'cover';
                                    newAvatar.style.backgroundPosition = 'center';
                                    newAvatar.textContent = '';
                                    applyGeneralChannelToGlobalItem();
                                    showNotification('Ikona kanału ogólnego zaktualizowana.', 'success');
                                } else {
                                    await handleApiError(response, 'Nie udało się zmienić ikony kanału ogólnego');
                                }
                            } catch (err) {
                                showNotification('Błąd połączenia podczas zmiany ikony.', 'error');
                            }
                        };
                        input.click();
                    };
                }
                // Clear unread badge for selected chat
                clearUnreadBadge(type, chatId);
                if (type === 'group' && chatId) {
                    const group = groups.find(g => g.id == chatId);
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
                                    const response = await fetch(`${currentApiUrl}/groups/${chatId}`, {
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
                                        const response = await fetch(`${currentApiUrl}/groups/${chatId}/avatar`, {
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
                const normalizedType = normalizeChatType(type, id);
                const normalizedId = normalizedType === 'global' ? null : id;
                if (normalizedType === 'private' || normalizedType === 'group') {
                    if (normalizedId !== null && normalizedId !== undefined && normalizedId !== '') {
                        selectChat(normalizedId, name, avatar, normalizedType);
                        restored = true;
                    }
                } else {
                    selectChat(null, name || 'Ogólny', avatar || null, 'global');
                    restored = true;
                }
            } catch (e) {
                console.error('Error parsing lastChat', e);
            }
        }
        if (!restored) {
            loadPreviousMessages();
        }
        
        function ensureScrollBottom() {
            const c = document.getElementById('chat-messages');
            if (!c) return;
            const scroll = () => { c.scrollTop = c.scrollHeight; };
            scroll();
            requestAnimationFrame(scroll);
            setTimeout(scroll, 50);
            setTimeout(scroll, 200);
            setTimeout(scroll, 500);
        }
        async function loadPreviousMessages() {
            const messagesContainer = document.getElementById("chat-messages");
            if (messagesContainer) {
                messagesContainer.innerHTML = '<div class="message received"><div class="message-text">Ładowanie wiadomości...</div></div>';
            }
            try {
                let url = `${currentApiUrl}/messages`;
                const cacheBuster = `t=${new Date().getTime()}`;
                
                if (currentChatType === 'private' && currentChatId) {
                    url = `${currentApiUrl}/messages?receiverId=${currentChatId}&${cacheBuster}`;
                } else if (currentChatType === 'group' && currentChatId) {
                    url = `${currentApiUrl}/messages?groupId=${currentChatId}&${cacheBuster}`;
                } else {
                     url = `${currentApiUrl}/messages?${cacheBuster}`;
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
                console.log(`Loaded ${messages?.length || 0} messages (full history, no limit)`);
                if (!messagesContainer) {
                    console.error('Messages container not found');
                    return;
                }
                const currentUser = JSON.parse(localStorage.getItem('user'));
                if (!currentUser) {
                    console.error('Current user not found');
                    return;
                }
                const isAdmin = !!(currentUser.isAdmin || currentUser.IsAdmin);
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
                        messageWrapper.dataset.messageId = msg.id || msg.Id;

                        const row = document.createElement("div");
                        row.className = "message-row";

                        const actionsDiv = document.createElement("div");
                        actionsDiv.className = "message-actions";

                        const replyBtn = document.createElement("button");
                        replyBtn.className = "btn-msg-action";
                        replyBtn.title = "Odpowiedz";
                        replyBtn.innerHTML = `<span class="material-symbols-outlined">reply</span>`;
                        replyBtn.onclick = (e) => {
                            e.stopPropagation();
                            replyToMessage(msg.id || msg.Id, senderUsername, msg.content || msg.Content);
                        };
                        actionsDiv.appendChild(replyBtn);

                        const reactBtn = document.createElement("button");
                        reactBtn.className = "btn-msg-action";
                        reactBtn.title = "Zareaguj";
                        reactBtn.innerHTML = `<span class="material-symbols-outlined">add_reaction</span>`;
                        reactBtn.onclick = (e) => {
                            e.stopPropagation();
                            window.toggleReactionPicker(msg.id || msg.Id, reactBtn);
                        };
                        actionsDiv.appendChild(reactBtn);
                        
                        if (isOwnMessage || isAdmin) {
                            const deleteBtn = document.createElement("button");
                            deleteBtn.className = "btn-msg-action btn-delete";
                            deleteBtn.title = "Usuń wiadomość";
                            deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
                            deleteBtn.onclick = (e) => {
                                e.stopPropagation();
                                if (window.deleteMessage) {
                                    window.deleteMessage(msg.id || msg.Id);
                                } else {
                                    console.error("window.deleteMessage is not defined");
                                }
                            };
                            actionsDiv.appendChild(deleteBtn);
                        }
                        row.appendChild(actionsDiv);

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
                                    const settingsModal = document.getElementById('settingsModal');
                                    if (settingsModal) {
                                        settingsModal.classList.add('show');
                                        if (typeof loadUserData === 'function') loadUserData();
                                    }
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
                        
                        // Reply Quote
                        const replyToId = msg.replyToId || msg.ReplyToId;
                        const replyToSender = msg.replyToSender || msg.ReplyToSender;
                        const replyToContent = msg.replyToContent || msg.ReplyToContent;

                        if (replyToId && replyToSender) {
                            const replyQuote = document.createElement("div");
                            replyQuote.className = "message-reply-quote";
                            replyQuote.onclick = (e) => {
                                e.stopPropagation();
                                if (window.scrollToMessage) window.scrollToMessage(replyToId);
                            };
                            replyQuote.innerHTML = `
                                <strong>${replyToSender}</strong>
                                <span>${replyToContent || 'Obraz'}</span>
                            `;
                            msgDiv.appendChild(replyQuote);
                        }

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

                        // Reactions
                        const reactionsStr = msg.reactions || msg.Reactions;
                        if (reactionsStr) {
                            try {
                                const reactions = typeof reactionsStr === 'string' ? JSON.parse(reactionsStr) : reactionsStr;
                                if (Array.isArray(reactions) && reactions.length > 0) {
                                    const reactionsDiv = document.createElement("div");
                                    reactionsDiv.className = "message-reactions";
                                    
                                    const groups = {};
                                    reactions.forEach(r => {
                                        if (!groups[r.e]) groups[r.e] = [];
                                        groups[r.e].push(r.u);
                                    });

                                    const currentUserId = parseInt(currentUser.id || currentUser.Id);

                                    for (const [emoji, userIds] of Object.entries(groups)) {
                                        const badge = document.createElement("div");
                                        badge.className = "reaction-badge";
                                        if (userIds.includes(currentUserId)) {
                                            badge.classList.add("self-reacted");
                                        }
                                        badge.innerHTML = `<span class="emoji">${emoji}</span> <span class="count">${userIds.length}</span>`;
                                        badge.onclick = (e) => {
                                            e.stopPropagation();
                                            window.reactToMessage(msg.id || msg.Id, emoji);
                                        };
                                        reactionsDiv.appendChild(badge);
                                    }
                                    
                                    // Add "Add Reaction" button at the end
                                    const addBtn = document.createElement("div");
                                    addBtn.className = "reaction-badge add-reaction-btn";
                                    addBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.1rem;">add_reaction</span>`;
                                    addBtn.title = "Dodaj reakcję";
                                    addBtn.onclick = (e) => {
                                        e.stopPropagation();
                                        window.toggleReactionPicker(msg.id || msg.Id, addBtn);
                                    };
                                    reactionsDiv.appendChild(addBtn);

                                    msgDiv.appendChild(reactionsDiv);
                                }
                            } catch (e) {
                                console.error("Error parsing reactions", e);
                            }
                        }

                        row.appendChild(avatarEl);
                        row.appendChild(msgDiv);
                        messageWrapper.appendChild(row);
                        messagesContainer.appendChild(messageWrapper);
                    } catch (msgError) {
                        console.error('Error processing message:', msgError, msg);
                    }
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                try {
                    const imgs = messagesContainer.querySelectorAll('img.message-image');
                    imgs.forEach(img => {
                        if (!img.complete) {
                            img.addEventListener('load', ensureScrollBottom, { once: true });
                        }
                    });
                } catch {}
                ensureScrollBottom();
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
            
            (async () => {
                const allUsers = await fetchAllUsersSafe();
                const usersArray = Array.isArray(allUsers) ? allUsers : [];
                if (usersArray.length === 0) {
                    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak użytkowników w systemie.</div>';
                    return;
                }
                
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const currentUserId = currentUser ? (currentUser.id || currentUser.Id) : null;
                const filteredUsers = usersArray.filter(u => (u.id || u.Id) != currentUserId);

                if (filteredUsers.length === 0) {
                    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak innych użytkowników w systemie.</div>';
                    return;
                }

                filteredUsers.forEach(friend => {
                    const tile = document.createElement('div');
                    tile.className = 'friend-tile';
                    
                    const fAvatarUrl = friend.avatarUrl || friend.AvatarUrl;
                    const fName = friend.username || friend.Username;

                    if (selectedUsernames.has(fName)) {
                        tile.classList.add('selected');
                    }
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    
                    if (fAvatarUrl) {
                        avatar.style.backgroundImage = `url('${resolveUrl(fAvatarUrl)}')`;
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = fName ? fName.charAt(0).toUpperCase() : '?';
                    }
                    
                    const name = document.createElement('span');
                    name.textContent = fName;
                    name.title = fName;

                    const check = document.createElement('div');
                    check.className = 'check-icon';
                    check.textContent = '✓';
                    
                    tile.appendChild(avatar);
                    tile.appendChild(name);
                    tile.appendChild(check);
                    tile.onclick = () => {
                        tile.classList.toggle('selected');
                        if (tile.classList.contains('selected')) {
                            selectedUsernames.add(fName);
                        } else {
                            selectedUsernames.delete(fName);
                        }
                        hiddenInput.value = Array.from(selectedUsernames).join(',');
                    };
                    container.appendChild(tile);
                });
            })().catch(() => {
                container.innerHTML = '<div style="color: var(--error-color); font-size: 0.8rem; width: 100%; text-align: center;">Błąd ładowania użytkowników.</div>';
            });
        }
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const friendTab = document.getElementById('friendTab');
                const groupTab = document.getElementById('groupTab');
                const requestsTab = document.getElementById('requestsTab');

                if (friendTab) friendTab.classList.remove('active');
                if (groupTab) groupTab.classList.remove('active');
                if (requestsTab) requestsTab.classList.remove('active');

                if (tab === 'friend') {
                    if (friendTab) friendTab.classList.add('active');
                } else if (tab === 'group') {
                    if (groupTab) groupTab.classList.add('active');
                    renderFriendSelection('friendsSelectionList', 'groupMembers');
                } else if (tab === 'requests') {
                    if (requestsTab) requestsTab.classList.add('active');
                    renderPendingRequestsModal();
                    renderSentRequestsModal();
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
                    const response = await fetch(`${currentApiUrl}/friends/add`, {
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
                        
                        await loadFriends();
                        
                        if (data.pending) {
                            showNotification('Zaproszenie zostało wysłane.', 'success');
                            await loadSentRequests();
                            
                            // Switch to requests tab to show the new request
                            const requestsTabBtn = document.querySelector('.tab-button[data-tab="requests"]');
                            if (requestsTabBtn) requestsTabBtn.click();
                            
                        } else if (data.alreadyFriends) {
                             showNotification(data.message || 'Jesteście już znajomymi.', 'info');
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
                    const response = await fetch(`${currentApiUrl}/groups`, {
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
                                await fetch(`${currentApiUrl}/groups/${groupId}/avatar`, {
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
                
                if (typeof openAddMemberModal === 'function') {
                    openAddMemberModal(currentChatId);
                } else {
                    console.error('openAddMemberModal not found');
                    // Fallback to old logic
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
                }
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
                    const response = await fetch(`${currentApiUrl}/groups/${currentChatId}/members`, {
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
        // Listeners for settings moved to top of DOMContentLoaded
        
        async function loadUserData() {
            try {
                // Force network request to ensure fresh data
                const response = await fetch(`${currentApiUrl}/Users/me`, {
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
                    
                    // Fix: Preserve local avatar if server returns null/empty
                    // This handles the case where avatar is uploaded but server hasn't updated the view model yet
                    const serverAvatar = user.avatarUrl || user.AvatarUrl || user.profilePictureUrl;
                    const localAvatar = currentUser.avatarUrl || currentUser.AvatarUrl || currentUser.profilePictureUrl;
                    
                    if (!serverAvatar && localAvatar) {
                        user.avatarUrl = localAvatar;
                        user.AvatarUrl = localAvatar;
                    }

                    const updatedUser = { ...currentUser, ...user };
                    localStorage.setItem('user', JSON.stringify(updatedUser));

                    if (settingsUsername) settingsUsername.value = user.username;
                    if (settingsEmail) settingsEmail.value = user.email;
                    
                    if (user.status || user.Status) {
                        const s = user.status || user.Status;
                        const radio = document.querySelector(`input[name="status"][value="${s}"]`);
                        if (radio) radio.checked = true;
                    }

                    // Apply appearance settings to UI controls
                    if (user.Theme) {
                        const themeName = user.Theme.charAt(0).toUpperCase() + user.Theme.slice(1);
                        const themeRadio = document.getElementById('theme' + themeName);
                        if (themeRadio) themeRadio.checked = true;
                        applyTheme(user.Theme);
                    }
                    if (user.TextSize) {
                         const sizeMap = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
                         const textSizeSlider = document.getElementById('textSizeSlider');
                         if (textSizeSlider && sizeMap[user.TextSize] !== undefined) {
                             textSizeSlider.value = sizeMap[user.TextSize];
                         }
                         applyTextSize(user.TextSize);
                    }
                    if (user.IsSimpleText !== undefined) {
                        const simpleTextToggle = document.getElementById('simpleTextToggle');
                        if (simpleTextToggle) simpleTextToggle.checked = user.IsSimpleText;
                        applySimpleText(user.IsSimpleText);
                    }

                    // Update settings avatar preview
                    const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
                    if (settingsAvatarPreview) {
                        // Use updatedUser to fallback to local data if server returns null/empty
                        // We also check currentUser (before merge) in case server returns explicit null which overwrites in updatedUser
                        const uAv = user.avatarUrl || user.AvatarUrl || user.profilePictureUrl || updatedUser.avatarUrl || updatedUser.AvatarUrl || currentUser.avatarUrl || currentUser.AvatarUrl;
                        
                        // Default fallback text (initials)
                        const fallbackText = (user.username || user.userName || '?').charAt(0).toUpperCase();

                        // Reset styles
                        settingsAvatarPreview.style.display = 'flex';
                        settingsAvatarPreview.style.alignItems = 'center';
                        settingsAvatarPreview.style.justifyContent = 'center';
                        
                        if (uAv) {
                            const resolved = resolveUrl(uAv);
                            const urlWithCache = resolved + (resolved.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
                            
                            // Use img element for better reliability and error handling
                            settingsAvatarPreview.innerHTML = '';
                            settingsAvatarPreview.style.backgroundImage = 'none';
                            settingsAvatarPreview.style.backgroundColor = 'transparent';
                            
                            const imgEl = document.createElement('img');
                            imgEl.src = urlWithCache;
                            imgEl.style.width = '100%';
                            imgEl.style.height = '100%';
                            imgEl.style.objectFit = 'cover';
                            imgEl.style.borderRadius = '50%';
                            
                            imgEl.onerror = () => {
                                console.warn('Avatar image failed to load, using fallback.');
                                settingsAvatarPreview.innerHTML = '';
                                settingsAvatarPreview.style.backgroundImage = 'none';
                                // Ensure variable fallback
                                const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim();
                                settingsAvatarPreview.style.backgroundColor = accent || '#16a34a'; 
                                settingsAvatarPreview.textContent = fallbackText;
                                settingsAvatarPreview.style.fontSize = '2.5rem';
                                settingsAvatarPreview.style.color = 'white';
                                settingsAvatarPreview.style.display = 'flex'; // Ensure flex for centering
                                settingsAvatarPreview.style.alignItems = 'center';
                                settingsAvatarPreview.style.justifyContent = 'center';
                                
                                // Also update sidebar fallback
                                const sidebarAvatar = document.getElementById('userAvatar');
                                if (sidebarAvatar) {
                                    sidebarAvatar.style.backgroundImage = 'none';
                                    sidebarAvatar.style.backgroundColor = accent || '#16a34a';
                                    sidebarAvatar.textContent = fallbackText;
                                }
                            };
                            
                            imgEl.onload = () => {
                                // Update sidebar as well (keep using BG there for now)
                                const sidebarAvatar = document.getElementById('userAvatar');
                                if (sidebarAvatar) {
                                    sidebarAvatar.style.backgroundImage = `url('${urlWithCache}')`;
                                    sidebarAvatar.style.backgroundSize = 'cover';
                                    sidebarAvatar.style.backgroundPosition = 'center';
                                    sidebarAvatar.textContent = '';
                                }
                            };
                            
                            settingsAvatarPreview.appendChild(imgEl);
                        } else {
                            settingsAvatarPreview.innerHTML = '';
                            settingsAvatarPreview.style.backgroundImage = 'none';
                            settingsAvatarPreview.style.backgroundColor = 'var(--accent-green)';
                            settingsAvatarPreview.textContent = fallbackText;
                            settingsAvatarPreview.style.fontSize = '2.5rem';
                            settingsAvatarPreview.style.color = 'white';
                        }
                    }
                    
                    loadSentRequests();
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
                const response = await fetch(`${currentApiUrl}/users/avatar`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                if (response.ok) {
                    const data = await response.json();
                    const fullUrl = resolveUrl(data.url);
                    const urlWithCache = fullUrl + (fullUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
                    
                    // Apply properly to settings preview
                    settingsAvatarPreview.style.backgroundImage = `url('${urlWithCache}')`;
                    settingsAvatarPreview.style.backgroundSize = 'cover';
                    settingsAvatarPreview.style.backgroundPosition = 'center';
                    settingsAvatarPreview.style.backgroundRepeat = 'no-repeat';
                    // settingsAvatarPreview.style.backgroundColor = 'transparent';
                    settingsAvatarPreview.textContent = '';
                    
                    const mainAvatar = document.getElementById('userAvatar');
                    if (mainAvatar) {
                        mainAvatar.style.backgroundImage = `url('${urlWithCache}')`;
                        mainAvatar.style.backgroundSize = 'cover';
                        mainAvatar.style.backgroundPosition = 'center';
                        mainAvatar.style.backgroundRepeat = 'no-repeat';
                        // mainAvatar.style.backgroundColor = 'transparent';
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
                
                if (newUsername.length > 16) {
                    showNotification('Nazwa użytkownika nie może być dłuższa niż 16 znaków.', 'error');
                    return;
                }

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
                    const response = await fetch(`${currentApiUrl}/users/profile`, {
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
            const allowed = ['dark', 'classic', 'original', 'neon', 'forest', 'kontrast'];
            const finalTheme = allowed.includes(themeName) ? themeName : 'original';
            root.setAttribute('data-theme', finalTheme);
        }

        function applyTextSize(size) {
            const root = document.documentElement;
            if (!root) return;
            const allowed = ['small', 'medium', 'large', 'xlarge'];
            const finalSize = allowed.includes(size) ? size : 'medium';
            root.setAttribute('data-text-size', finalSize);
        }

        function applySimpleText(isSimple) {
            const root = document.documentElement;
            if (!root) return;
            if (isSimple) {
                root.setAttribute('data-simple-text', 'true');
            } else {
                root.removeAttribute('data-simple-text');
            }
        }

        async function saveThemeSettings() {
            const theme = localStorage.getItem('preferredTheme') || 'original';
            const textSize = localStorage.getItem('preferredTextSize') || 'medium';
            const isSimpleText = localStorage.getItem('preferredSimpleText') === 'true';
            
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                
                const response = await fetch(`${currentApiUrl}/users/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        theme: theme,
                        textSize: textSize,
                        isSimpleText: isSimpleText
                    })
                });
                
                if (response.ok) {
                    // Update local user object
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        try {
                            const user = JSON.parse(userStr);
                            user.Theme = theme;
                            user.TextSize = textSize;
                            user.IsSimpleText = isSimpleText;
                            localStorage.setItem('user', JSON.stringify(user));
                        } catch(e) {}
                    }
                }
            } catch (e) {
                console.error('Failed to save theme settings to server', e);
            }
        }

        const preferredTheme = localStorage.getItem('preferredTheme') || 'original';
        applyTheme(preferredTheme);

        const preferredTextSize = localStorage.getItem('preferredTextSize') || 'medium';
        applyTextSize(preferredTextSize);

        const preferredSimpleText = localStorage.getItem('preferredSimpleText') === 'true';
        applySimpleText(preferredSimpleText);

        const sizeMap = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
        const sizeRevMap = ['small', 'medium', 'large', 'xlarge'];
        
        if (textSizeSlider) {
            textSizeSlider.value = sizeMap[preferredTextSize] !== undefined ? sizeMap[preferredTextSize] : 1;
            textSizeSlider.addEventListener('input', () => {
                const val = parseInt(textSizeSlider.value);
                const size = sizeRevMap[val];
                applyTextSize(size);
            });
        }

        if (simpleTextToggle) {
            simpleTextToggle.checked = preferredSimpleText;
            simpleTextToggle.addEventListener('change', () => {
                applySimpleText(simpleTextToggle.checked);
                localStorage.setItem('preferredSimpleText', simpleTextToggle.checked);
                saveThemeSettings();
            });
        }

        if (themeDarkRadio) {
            themeDarkRadio.checked = (preferredTheme === 'dark');
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
        if (themeKontrastRadio) {
            themeKontrastRadio.checked = (preferredTheme === 'kontrast');
        }


        if (themeDarkRadio) {
            themeDarkRadio.addEventListener('change', () => {
                if (themeDarkRadio.checked) {
                    applyTheme('dark');
                    localStorage.setItem('preferredTheme', 'dark');
                    saveThemeSettings();
                }
            });
        }
        if (themeClassicRadio) {
            themeClassicRadio.addEventListener('change', () => {
                if (themeClassicRadio.checked) {
                    applyTheme('classic');
                    localStorage.setItem('preferredTheme', 'classic');
                    saveThemeSettings();
                }
            });
        }
        if (themeOriginalRadio) {
            themeOriginalRadio.addEventListener('change', () => {
                if (themeOriginalRadio.checked) {
                    applyTheme('original');
                    localStorage.setItem('preferredTheme', 'original');
                    saveThemeSettings();
                }
            });
        }
        if (themeNeonRadio) {
            themeNeonRadio.addEventListener('change', () => {
                if (themeNeonRadio.checked) {
                    applyTheme('neon');
                    localStorage.setItem('preferredTheme', 'neon');
                    saveThemeSettings();
                }
            });
        }
        if (themeForestRadio) {
            themeForestRadio.addEventListener('change', () => {
                if (themeForestRadio.checked) {
                    applyTheme('forest');
                    localStorage.setItem('preferredTheme', 'forest');
                    saveThemeSettings();
                }
            });
        }
        if (themeKontrastRadio) {
            themeKontrastRadio.addEventListener('change', () => {
                if (themeKontrastRadio.checked) {
                    applyTheme('kontrast');
                    localStorage.setItem('preferredTheme', 'kontrast');
                    saveThemeSettings();
                }
            });
        }
        /* saveThemeBtn removed - auto save implemented */
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
            
            const actionsDiv = document.getElementById('profileActions');
            const adminActionsDiv = document.getElementById('profileAdminActions');
            const profileMuteBtn = document.getElementById('profileMuteBtn');
            const profileUnmuteBtn = document.getElementById('profileUnmuteBtn');
            const profileBanBtn = document.getElementById('profileBanBtn');
            const profileUnbanBtn = document.getElementById('profileUnbanBtn');
            const profileDeleteBtn = document.getElementById('profileDeleteBtn');
            const msgBtn = document.getElementById('profileMessageBtn');
            const friendBtn = document.getElementById('profileFriendBtn');

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
                avatarEl.style.color = 'var(--btn-text-color, white)';
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
                if (actionsDiv) actionsDiv.style.display = 'none';
            } else {
                mutualsSection.style.display = 'block';
                if (actionsDiv) actionsDiv.style.display = 'flex';
                
                // Configure Message Button
                if (msgBtn) {
                    const newMsgBtn = msgBtn.cloneNode(true);
                    msgBtn.parentNode.replaceChild(newMsgBtn, msgBtn);
                    
                    newMsgBtn.addEventListener('click', () => {
                         userProfileModal.classList.remove('show');
                         selectChat(userId, username, avatarUrl);
                    });
                }
                
                // Configure Friend Button
                if (friendBtn) {
                    const newFriendBtn = friendBtn.cloneNode(true);
                    friendBtn.parentNode.replaceChild(newFriendBtn, friendBtn);
                    
                    if (friend) {
                        newFriendBtn.textContent = 'Usuń ze znajomych';
                        newFriendBtn.className = 'btn-primary';
                        newFriendBtn.style.backgroundColor = 'var(--error-color)';
                        newFriendBtn.style.color = '';
                        
                        newFriendBtn.addEventListener('click', async () => {
                            if (!confirm(`Czy na pewno usunąć ${username} ze znajomych?`)) return;
                            try {
                                const res = await fetch(`${currentApiUrl}/friends/${userId}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                    showNotification('Usunięto ze znajomych.', 'success');
                                    userProfileModal.classList.remove('show');
                                    await loadFriends();
                                } else {
                                    handleApiError(res, 'Nie udało się usunąć znajomego');
                                }
                            } catch (e) {
                                console.error(e);
                                showNotification('Błąd sieci.', 'error');
                            }
                        });
                    } else {
                        newFriendBtn.textContent = 'Dodaj do znajomych';
                        newFriendBtn.className = 'btn-primary';
                        newFriendBtn.style.backgroundColor = '';
                        newFriendBtn.style.color = '';
                        
                        newFriendBtn.addEventListener('click', async () => {
                             try {
                                const res = await fetch(`${currentApiUrl}/friends/add`, {
                                    method: 'POST',
                                    headers: { 
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ usernameOrEmail: username })
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    showNotification(data.message || 'Zaproszenie wysłane.', 'success');
                                    userProfileModal.classList.remove('show');
                                } else {
                                    handleApiError(res, 'Nie udało się dodać znajomego');
                                }
                            } catch (e) {
                                console.error(e);
                                showNotification('Błąd sieci.', 'error');
                            }
                        });
                    }
                }

                // Admin actions
                const currentUserAdminCheck = JSON.parse(localStorage.getItem('user'));
                const isAdminProfileView = currentUserAdminCheck && (currentUserAdminCheck.isAdmin || currentUserAdminCheck.IsAdmin);
                if (adminActionsDiv) adminActionsDiv.style.display = isAdminProfileView ? 'flex' : 'none';
                function showConfirm(message, confirmText, onConfirm) {
                    const modal = document.getElementById('confirmationModal');
                    const msgEl = document.getElementById('confirmationMessage');
                    const confirmBtn = document.getElementById('confirmActionBtn');
                    const cancelBtn = document.getElementById('cancelConfirmBtn');
                    if (!modal || !msgEl || !confirmBtn || !cancelBtn) { if (confirm(message)) onConfirm(); return; }
                    msgEl.textContent = message;
                    confirmBtn.textContent = confirmText || 'Potwierdź';
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    const newCancelBtn = cancelBtn.cloneNode(true);
                    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                    newCancelBtn.onclick = () => { modal.classList.remove('show'); };
                    newConfirmBtn.onclick = () => { modal.classList.remove('show'); onConfirm(); };
                    modal.classList.add('show');
                }
                if (isAdminProfileView) {
                    if (profileMuteBtn) {
                        const btn = profileMuteBtn.cloneNode(true); profileMuteBtn.parentNode.replaceChild(btn, profileMuteBtn);
                        btn.onclick = () => {
                            showConfirm(`Wyciszyć użytkownika ${username} na 60 minut?`, 'Wycisz', async () => {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/mute/${userId}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ minutes: 60, reason: 'Profil admin' }),
                                        cache: 'no-store'
                                    });
                                    if (res.ok) { showNotification('Użytkownik wyciszony na 60 min.', 'success'); await loadAdminLogs(); }
                                    else { await handleApiError(res, 'Nie udało się wyciszyć'); }
                                } catch { showNotification('Błąd sieci.', 'error'); }
                            });
                        };
                    }
                    if (profileUnmuteBtn) {
                        const btn = profileUnmuteBtn.cloneNode(true); profileUnmuteBtn.parentNode.replaceChild(btn, profileUnmuteBtn);
                        btn.onclick = () => {
                            showConfirm(`Odciszyć użytkownika ${username}?`, 'Odcisz', async () => {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/unmute/${userId}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                        cache: 'no-store'
                                    });
                                    if (res.ok) { showNotification('Użytkownik odciszony.', 'success'); await loadAdminLogs(); }
                                    else { await handleApiError(res, 'Nie udało się odciszyć'); }
                                } catch { showNotification('Błąd sieci.', 'error'); }
                            });
                        };
                    }
                    if (profileBanBtn) {
                        const btn = profileBanBtn.cloneNode(true); profileBanBtn.parentNode.replaceChild(btn, profileBanBtn);
                        btn.onclick = () => {
                            showConfirm(`Zbanować użytkownika ${username} na 60 minut?`, 'Zbanuj', async () => {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/ban/${userId}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ minutes: 60, reason: 'Profil admin' }),
                                        cache: 'no-store'
                                    });
                                    if (res.ok) { showNotification('Użytkownik zbanowany na 60 min.', 'success'); await loadAdminLogs(); }
                                    else { await handleApiError(res, 'Nie udało się zbanować'); }
                                } catch { showNotification('Błąd sieci.', 'error'); }
                            });
                        };
                    }
                    if (profileUnbanBtn) {
                        const btn = profileUnbanBtn.cloneNode(true); profileUnbanBtn.parentNode.replaceChild(btn, profileUnbanBtn);
                        btn.onclick = () => {
                            showConfirm(`Odbanować użytkownika ${username}?`, 'Odbanuj', async () => {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/unban/${userId}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                        cache: 'no-store'
                                    });
                                    if (res.ok) { showNotification('Użytkownik odbanowany.', 'success'); await loadAdminLogs(); }
                                    else { await handleApiError(res, 'Nie udało się odbanować'); }
                                } catch { showNotification('Błąd sieci.', 'error'); }
                            });
                        };
                    }
                    if (profileDeleteBtn) {
                        const btn = profileDeleteBtn.cloneNode(true); profileDeleteBtn.parentNode.replaceChild(btn, profileDeleteBtn);
                        btn.onclick = () => {
                            showConfirm(`Czy na pewno usunąć konto użytkownika ${username}?`, 'Usuń', async () => {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/users/${userId}`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                        cache: 'no-store'
                                    });
                                    if (res.ok) { showNotification('Konto użytkownika usunięte.', 'success'); userProfileModal.classList.remove('show'); await loadAdminLogs(); }
                                    else { await handleApiError(res, 'Nie udało się usunąć konta'); }
                                } catch { showNotification('Błąd sieci.', 'error'); }
                            });
                        };
                    }
                }
                mutualsList.innerHTML = '<div style="padding:10px;">Ładowanie...</div>';
                serversList.innerHTML = '<div style="padding:10px;">Ładowanie...</div>';
                try {
                    const res = await fetch(`${currentApiUrl}/friends/mutual/${userId}`, {
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
                    const res = await fetch(`${currentApiUrl}/groups/common/${userId}`, {
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
                
                const av = document.createElement('div');
                av.className = 'avatar';
                const url = item.avatarUrl || item.AvatarUrl;
                const name = item.username || item.Username || item.name || item.Name;
                const itemId = item.id || item.Id || item.userId || item.UserId;

                if (url) {
                    av.style.backgroundImage = `url('${resolveUrl(url)}')`;
                    av.style.backgroundSize = 'cover';
                    av.style.backgroundPosition = 'center';
                    av.textContent = '';
                } else {
                    av.textContent = name ? name.charAt(0).toUpperCase() : '?';
                }

                const label = document.createElement('span');
                label.textContent = name;
                
                // Online status indicator
                const status = item.status || item.Status || (item.isOnline || item.IsOnline ? 1 : 0);
                if (status > 0 && status != 4) {
                    const statusDot = document.createElement('span');
                    statusDot.className = 'status-dot';
                    statusDot.textContent = ' ●';
                    statusDot.style.fontSize = '10px';
                    if (status == 1) statusDot.style.color = 'var(--accent-green)';
                    else if (status == 2) statusDot.style.color = '#f1c40f';
                    else if (status == 3) statusDot.style.color = '#e74c3c';
                    label.appendChild(statusDot);
                }

                tile.appendChild(av);
                tile.appendChild(label);
                
                // Make clickable to open private chat
                if (itemId) {
                    tile.style.cursor = 'pointer';
                    tile.onclick = () => {
                        selectChat(itemId, name, url, 'private');
                    };
                } else {
                    tile.style.cursor = 'default';
                }

                container.appendChild(tile);
            });
        }
        function renderGroupMembersList(container, members, isAdmin, groupId) {
            container.innerHTML = '';

            // Show all members
            console.log(`Rendering group members. Total: ${members.length}`);

            if (!members || members.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Brak uczestników.</div>';
                return;
            }
            members.forEach(member => {
                const tile = document.createElement('div');
                tile.className = 'group-member-card';
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
                
                // Online status indicator
                const status = member.status || member.Status || (member.isOnline || member.IsOnline ? 1 : 0);
                if (status > 0 && status != 4) {
                    const statusDot = document.createElement('span');
                    statusDot.className = 'status-dot';
                    statusDot.textContent = ' ●';
                    statusDot.style.fontSize = '10px';
                    if (status == 1) statusDot.style.color = 'var(--accent-green)';
                    else if (status == 2) statusDot.style.color = '#f1c40f';
                    else if (status == 3) statusDot.style.color = '#e74c3c';
                    label.appendChild(statusDot);
                }

                tile.appendChild(av);
                tile.appendChild(label);
                
                // Make clickable to open private chat
                const memberId = member.userId || member.UserId || member.id || member.Id;
                if (memberId) {
                    tile.style.cursor = 'pointer';
                    tile.onclick = () => {
                        selectChat(memberId, name, url, 'private');
                    };
                }

                if (isAdmin) {
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const memberId = member.userId || member.UserId || member.id || member.Id;
                    
                    if (memberId) {
                        const isSelf = memberId == currentUser.id || memberId == currentUser.Id;
                        
                        if (!isSelf) {
                            const removeBtn = document.createElement('button');
                            removeBtn.className = 'btn-remove-member';
                            removeBtn.innerHTML = '➖';
                            removeBtn.title = 'Usuń z grupy';
                            removeBtn.onclick = async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Czy na pewno usunąć użytkownika ${name} z grupy?`)) return;
                                try {
                                    const response = await fetch(`${currentApiUrl}/groups/${groupId}/members/${memberId}`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (response.ok) {
                                        showNotification('Użytkownik usunięty.', 'success');
                                        // Refresh the list if possible, or remove element
                                        // updateConversationSidebar() might be too heavy or not refresh this view?
                                        // But the original code called it.
                                        if (typeof updateConversationSidebar === 'function') updateConversationSidebar();
                                        // Also remove from DOM immediately
                                        tile.remove();
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
                const [allUsersList, membersRes] = await Promise.all([
                    fetchAllUsersSafe(),
                    fetch(`${currentApiUrl}/groups/${groupId}/members`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                
                if (membersRes.ok) {
                    const usersArray = Array.isArray(allUsersList) ? allUsersList : [];
                    const membersList = await membersRes.json();
                    
                    const memberIds = new Set(membersList.map(m => String(m.userId || m.UserId)));
                    // Filter out existing members and current user
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const currentUserId = currentUser ? (currentUser.id || currentUser.Id) : null;
                    const availableUsers = usersArray.filter(u => !memberIds.has(String(u.id || u.Id)) && (u.id || u.Id) != currentUserId);
                    
                    list.innerHTML = '';
                    if (availableUsers.length === 0) {
                        list.innerHTML = '<div style="padding:10px;text-align:center;color:var(--text-muted)">Brak użytkowników do dodania.</div>';
                        return;
                    }
                    
                    availableUsers.forEach(friend => {
                        const tile = document.createElement('div');
                        tile.className = 'friend-tile';
                        // Inline styles removed to rely on CSS class
                        
                        const avatar = document.createElement('div');
                        avatar.className = 'avatar';
                        // Inline styles removed to rely on CSS class
                        
                        const fAvatarUrl = friend.avatarUrl || friend.AvatarUrl;
                        const fName = friend.username || friend.Username;

                        if (fAvatarUrl) {
                            avatar.style.backgroundImage = `url('${resolveUrl(fAvatarUrl)}')`;
                            avatar.textContent = '';
                        } else {
                            avatar.textContent = (fName && fName.length > 0) ? fName.charAt(0).toUpperCase() : '?';
                        }
                        
                        const name = document.createElement('span');
                        name.textContent = fName || 'Nieznany';
                        name.title = fName || 'Nieznany';
                        // Inline styles removed to rely on CSS class

                        const check = document.createElement('div');
                        check.className = 'check-icon';
                        check.textContent = '✓';
                        
                        tile.appendChild(avatar);
                        tile.appendChild(name);
                        tile.appendChild(check);
                        
                        tile.onclick = () => {
                            tile.classList.toggle('selected');
                            const fUsername = friend.username || friend.Username;
                            let currentSelected = hiddenInput.value ? hiddenInput.value.split(',').filter(x=>x) : [];
                            
                            if (tile.classList.contains('selected')) {
                                if (!currentSelected.includes(fUsername)) currentSelected.push(fUsername);
                            } else {
                                currentSelected = currentSelected.filter(u => u !== fUsername);
                            }
                            hiddenInput.value = currentSelected.join(',');
                        };
                        
                        list.appendChild(tile);
                    });
                    
                    // Setup confirm button logic
                    confirmBtn.onclick = async () => {
                        const selectedUsernames = hiddenInput.value ? hiddenInput.value.split(',').filter(x => x) : [];
                        if (selectedUsernames.length === 0) {
                            showNotification('Wybierz przynajmniej jedną osobę.', 'warning');
                            return;
                        }
                        
                        try {
                            const res = await fetch(`${currentApiUrl}/groups/${groupId}/members`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(selectedUsernames)
                            });
                            
                            if (res.ok) {
                                const data = await res.json();
                                showNotification(data.message || 'Dodano użytkowników.', 'success');
                                modal.classList.remove('show');
                                updateConversationSidebar();
                            } else {
                                await handleApiError(res, 'Nie udało się dodać użytkowników');
                            }
                        } catch (e) {
                            showNotification('Błąd podczas dodawania.', 'error');
                        }
                    };
                    
                } else {
                    list.innerHTML = '<div style="color:var(--error-color)">Błąd ładowania danych.</div>';
                }
            } catch (e) {
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
                        const response = await fetch(`${currentApiUrl}/groups/${groupId}/avatar`, {
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
                const response = await fetch(`${currentApiUrl}/groups/${groupId}`, {
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
            if (!groupId && currentChatType === 'group') groupId = currentChatId;
            if (!groupId) {
                console.error('Brak ID grupy do opuszczenia');
                showNotification('Błąd: nieprawidłowe ID grupy.', 'error');
                return;
            }
            if (!confirm('Czy na pewno chcesz opuścić grupę?')) return;
            try {
        const response = await fetch(`${currentApiUrl}/groups/${groupId}/members/me`, {
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
            
            // Admin panel container
            const adminPanel = document.getElementById('adminPanel');
            const adminControls = document.getElementById('adminActionsArea');
            const adminUsersList = document.getElementById('adminUsersList');
            const adminUserSearch = document.getElementById('adminUserSearch');
            const adminAccessWarning = document.getElementById('adminAccessWarning');
            const adminActionSelect = document.getElementById('adminActionSelect');
            const adminDurationMinutes = document.getElementById('adminDurationMinutes');
            const adminReason = document.getElementById('adminReason');
            const adminExecuteActionBtn = document.getElementById('adminExecuteActionBtn');
            const adminLogsList = document.getElementById('adminLogsList');
            if (typeof window.adminSelectedUserId === 'undefined') window.adminSelectedUserId = null;
            let adminAllUsersCacheLocal = [];
            const adminLogsState = { inFlight:false, controller:null, backoff:2000, cache:[] };
            async function loadAdminLogs() {
                try {
                    if (adminLogsState.inFlight) return;
                    adminLogsState.inFlight = true;
                    adminLogsState.controller = new AbortController();
                    const res = await fetch(`${currentApiUrl}/admin/logs?limit=200`, { headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, cache: 'no-store', signal: adminLogsState.controller.signal });
                    if (res.ok) {
                        const logs = await res.json();
                        adminLogsState.cache = logs || [];
                        renderAdminLogs(adminLogsState.cache);
                        adminLogsState.backoff = 2000;
                    } else {
                        if (res.status === 401 || res.status === 403) {
                            adminLogsList.innerHTML = '<div style="color:var(--error-color)">Brak uprawnień do pobrania logów.</div>';
                        } else {
                            adminLogsList.innerHTML = '<div style="color:var(--error-color)">Nie udało się pobrać logów.</div>';
                        }
                        scheduleAdminLogsRetry();
                    }
                } catch (e) {
                    if (!(e && (e.name === 'AbortError' || String(e).includes('ERR_ABORTED')))) {
                        adminLogsList.innerHTML = '<div style="color:var(--error-color)">Błąd sieci.</div>';
                    }
                    scheduleAdminLogsRetry();
                } finally {
                    adminLogsState.inFlight = false;
                    adminLogsState.controller = null;
                }
            }
            function renderAdminLogs(items) {
                adminLogsList.innerHTML = '';
                (items || []).forEach(l => {
                    const line = document.createElement('div');
                    const when = new Date(l.timestamp);
                    const actor = l.PerformedBy?.Username || `#${l.PerformedBy?.Id ?? '?'}`;
                    const target = l.TargetUser ? (l.TargetUser.Username || `#${l.TargetUser.Id}`) : '-';
                    const dur = l.DurationMinutes ? `${l.DurationMinutes}m` : '';
                    const ok = l.success ? 'OK' : 'ERR';
                    line.textContent = `[${when.toLocaleString()}] ${ok} ${l.ActionType} by ${actor} -> ${target} ${dur} ${l.Reason ? `| ${l.Reason}` : ''}`;
                    adminLogsList.appendChild(line);
                });
            }
            function scheduleAdminLogsRetry() {
                const next = Math.min(adminLogsState.backoff * 2, 30000);
                adminLogsState.backoff = next;
                setTimeout(() => { loadAdminLogs(); }, next);
            }
            function renderAdminUsersList(items) {
                adminUsersList.innerHTML = '';
                if (!items || items.length === 0) {
                    adminUsersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Brak dostępnych użytkowników.</div>';
                    return;
                }
                if (!window.adminSelectedUserIds) window.adminSelectedUserIds = new Set();
                items.forEach(u => {
                    const row = document.createElement('div');
                    row.className = 'friend-tile';
                    const av = document.createElement('div'); av.className = 'avatar';
                    const url = u.avatarUrl || u.AvatarUrl;
                    const name = u.username || u.Username || 'Użytkownik';
                    const id = u.id || u.Id;
                    if (url) { av.style.backgroundImage = `url('${resolveUrl(url)}')`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.textContent = ''; }
                    else { av.textContent = name.charAt(0).toUpperCase(); }
                    const label = document.createElement('span'); label.textContent = `${name} (ID ${id})`;
                    const checkIcon = document.createElement('span'); checkIcon.className = 'material-symbols-outlined check-icon'; checkIcon.textContent = 'check_circle';
                    row.appendChild(av); row.appendChild(label);
                    row.appendChild(checkIcon);
                    row.style.cursor = 'pointer';
                    row.onclick = (e) => {
                        e.stopPropagation();
                        const selected = window.adminSelectedUserIds.has(id);
                        if (selected) {
                            window.adminSelectedUserIds.delete(id);
                            row.classList.remove('selected');
                        } else {
                            window.adminSelectedUserIds.add(id);
                            row.classList.add('selected');
                        }
                        updateAdminSelectionToolsState();
                    };
                    row.ondblclick = (e) => { e.stopPropagation(); if (typeof window.openUserProfile === 'function') window.openUserProfile(id); };
                    adminUsersList.appendChild(row);
                });
            }
            function updateAdminSelectionToolsState() {
                const hasSel = window.adminSelectedUserIds && window.adminSelectedUserIds.size > 0;
                ['profileMuteBtn','profileUnmuteBtn','profileBanBtn','profileUnbanBtn','profileDeleteBtn'].forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) btn.disabled = !hasSel;
                });
            }
            async function initAdminPanel() {
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const isAdmin = currentUser && (currentUser.isAdmin || currentUser.IsAdmin);
                if (!adminPanel) return;
                adminPanel.style.display = isAdmin ? 'block' : 'none';
                if (!isAdmin) { if (adminAccessWarning) adminAccessWarning.style.display = 'block'; return; }
                if (adminAccessWarning) adminAccessWarning.style.display = 'none';
                try {
                    const usersArray = (await fetchAllUsersSafe()) || null;
                    adminAllUsersCacheLocal = (usersArray || []).map(u => ({
                        id: u.id || u.Id,
                        username: u.username || u.Username,
                        email: u.email || u.Email,
                        avatarUrl: u.avatarUrl || u.AvatarUrl
                    }));
                    renderAdminUsersList(adminAllUsersCacheLocal);
                } catch { renderAdminUsersList([]); }
                if (adminUserSearch) {
                    adminUserSearch.oninput = () => {
                        const q = adminUserSearch.value.trim().toLowerCase();
                        const filtered = adminAllUsersCacheLocal.filter(u =>
                            (u.username && u.username.toLowerCase().includes(q)) ||
                            (u.email && u.email.toLowerCase().includes(q)) ||
                            (String(u.id).includes(q))
                        );
                        renderAdminUsersList(filtered);
                    };
                }
                function showConfirmGlobal(message, confirmText, onConfirm) {
                    const modal = document.getElementById('confirmationModal');
                    const msgEl = document.getElementById('confirmationMessage');
                    const confirmBtn = document.getElementById('confirmActionBtn');
                    const closeBtn = document.getElementById('closeConfirmationModal');
                    if (!modal || !msgEl || !confirmBtn || !closeBtn) { if (confirm(message)) onConfirm(); return; }
                    msgEl.textContent = message;
                    confirmBtn.textContent = confirmText || 'Potwierdź';
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    const newCloseBtn = closeBtn.cloneNode(true);
                    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                    newCloseBtn.onclick = () => { modal.classList.remove('show'); };
                    newConfirmBtn.onclick = () => { modal.classList.remove('show'); onConfirm(); };
                    modal.classList.add('show');
                }
                const muteSel = document.getElementById('profileMuteBtn');
                const unmuteSel = document.getElementById('profileUnmuteBtn');
                const banSel = document.getElementById('profileBanBtn');
                const unbanSel = document.getElementById('profileUnbanBtn');
                const deleteSel = document.getElementById('profileDeleteBtn');
                if (muteSel) {
                    muteSel.onclick = async () => {
                        const ids = Array.from(window.adminSelectedUserIds || []);
                        if (ids.length === 0) return;
                        showConfirmGlobal(`Wyciszyć ${ids.length} użytkowników na 60 minut?`, 'Wycisz', async () => {
                            for (const id of ids) {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/mute/${id}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ minutes: 60, reason: 'Panel admin (bulk)' }),
                                        cache: 'no-store'
                                    });
                                    if (!res.ok) await handleApiError(res, 'Nie udało się wyciszyć');
                                } catch {}
                            }
                            showNotification('Operacja wyciszenia wykonana.', 'success'); await loadAdminLogs();
                        });
                    };
                }
                if (unmuteSel) {
                    unmuteSel.onclick = async () => {
                        const ids = Array.from(window.adminSelectedUserIds || []);
                        if (ids.length === 0) return;
                        showConfirmGlobal(`Odciszyć ${ids.length} użytkowników?`, 'Odcisz', async () => {
                            for (const id of ids) {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/unmute/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' });
                                    if (!res.ok) await handleApiError(res, 'Nie udało się odciszyć');
                                } catch {}
                            }
                            showNotification('Operacja odciszenia wykonana.', 'success'); await loadAdminLogs();
                        });
                    };
                }
                if (banSel) {
                    banSel.onclick = async () => {
                        const ids = Array.from(window.adminSelectedUserIds || []);
                        if (ids.length === 0) return;
                        showConfirmGlobal(`Zbanować ${ids.length} użytkowników na 60 minut?`, 'Zbanuj', async () => {
                            for (const id of ids) {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/ban/${id}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ minutes: 60, reason: 'Panel admin (bulk)' }),
                                        cache: 'no-store'
                                    });
                                    if (!res.ok) await handleApiError(res, 'Nie udało się zbanować');
                                } catch {}
                            }
                            showNotification('Operacja banowania wykonana.', 'success'); await loadAdminLogs();
                        });
                    };
                }
                if (unbanSel) {
                    unbanSel.onclick = async () => {
                        const ids = Array.from(window.adminSelectedUserIds || []);
                        if (ids.length === 0) return;
                        showConfirmGlobal(`Odbanować ${ids.length} użytkowników?`, 'Odbanuj', async () => {
                            for (const id of ids) {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/unban/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' });
                                    if (!res.ok) await handleApiError(res, 'Nie udało się odbanować');
                                } catch {}
                            }
                            showNotification('Operacja odbanowania wykonana.', 'success'); await loadAdminLogs();
                        });
                    };
                }
                if (deleteSel) {
                    deleteSel.onclick = async () => {
                        const ids = Array.from(window.adminSelectedUserIds || []);
                        if (ids.length === 0) return;
                        showConfirmGlobal(`Usunąć konta ${ids.length} użytkowników? Tej operacji nie można cofnąć.`, 'Usuń', async () => {
                            for (const id of ids) {
                                try {
                                    const res = await fetch(`${currentApiUrl}/admin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' });
                                    if (!res.ok) await handleApiError(res, 'Nie udało się usunąć konta');
                                } catch {}
                            }
                            showNotification('Usunięto konta wybranych użytkowników.', 'success'); await loadAdminLogs();
                        });
                    };
                }
                updateAdminSelectionToolsState();
                if (adminExecuteActionBtn) {
                    adminExecuteActionBtn.onclick = async () => {
                        if (!window.adminSelectedUserId) { showNotification('Wybierz użytkownika z listy.', 'warning'); return; }
                        const action = adminActionSelect ? adminActionSelect.value : 'mute';
                        const minutesVal = adminDurationMinutes && adminDurationMinutes.value ? parseInt(adminDurationMinutes.value, 10) : null;
                        const reasonVal = adminReason ? adminReason.value.trim() : null;
                        try {
                            let url = ''; let method = 'POST'; let body = null;
                            if (action === 'mute') { url = `${currentApiUrl}/admin/mute/${window.adminSelectedUserId}`; body = { minutes: minutesVal || 60, reason: reasonVal }; }
                            else if (action === 'unmute') { url = `${currentApiUrl}/admin/unmute/${window.adminSelectedUserId}`; }
                            else if (action === 'ban') { url = `${currentApiUrl}/admin/ban/${window.adminSelectedUserId}`; body = { minutes: minutesVal || 60, reason: reasonVal }; }
                            else if (action === 'unban') { url = `${currentApiUrl}/admin/unban/${window.adminSelectedUserId}`; }
                            else if (action === 'delete') { url = `${currentApiUrl}/admin/users/${window.adminSelectedUserId}`; method = 'DELETE'; }
                            const headers = { 'Authorization': `Bearer ${token}` };
                            if (body) headers['Content-Type'] = 'application/json';
                            const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
                            if (res.ok) {
                                const data = await res.json().catch(() => ({}));
                                showNotification(data.message || 'Operacja wykonana.', 'success');
                                await loadAdminLogs();
                            } else {
                                await handleApiError(res, 'Operacja nie powiodła się');
                            }
                        } catch (e) { showNotification('Błąd sieci.', 'error'); }
                    };
                }
                await loadAdminLogs();
            }
            window.initAdminPanel = initAdminPanel;

            if (mutualsContainer) mutualsContainer.innerHTML = '';
            if (groupsContainer) groupsContainer.innerHTML = '';
            if (membersContainer) membersContainer.innerHTML = '';
            if (imagesContainer) imagesContainer.innerHTML = '';

            if (currentChatType === 'global') {
                if (titleEl) titleEl.textContent = 'Czat ogólny';
                if (nameEl) nameEl.textContent = generalChannel.name || 'Kanał ogólny';
                if (avatarEl) {
                    avatarEl.style.backgroundImage = `url('${resolveUrl(generalChannel.avatarUrl || 'logo.png')}')`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.style.backgroundPosition = 'center';
                    avatarEl.textContent = '';
                    avatarEl.style.backgroundColor = 'transparent';
                }
                if (statusEl) statusEl.textContent = '';
                
                if (mutualsSection) mutualsSection.style.display = 'none';
                if (groupsSection) groupsSection.style.display = 'none';
                if (membersSection) membersSection.style.display = 'block';

            const currentUser = JSON.parse(localStorage.getItem('user'));
            const isAdminGlobal = currentUser && (currentUser.isAdmin || currentUser.IsAdmin);

            function renderAdminUsers(container, items) {
                container.innerHTML = '';
                if (!items || items.length === 0) {
                    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Brak dostępnych użytkowników.</div>';
                    return;
                }
                items.forEach(item => {
                    const tile = document.createElement('div');
                    tile.className = 'friend-tile';

                    const av = document.createElement('div');
                    av.className = 'avatar';
                    const url = item.avatarUrl || item.AvatarUrl;
                    const name = item.username || item.Username || 'Użytkownik';
                    const id = item.id || item.Id;

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

                    const actions = document.createElement('div');
                    actions.style.marginLeft = 'auto';
                    actions.style.display = 'flex';
                    actions.style.gap = '6px';

                    const muteBtn = document.createElement('button');
                    muteBtn.className = 'btn-secondary btn-sidebar-action';
                    muteBtn.style.padding = '6px 10px';
                    muteBtn.textContent = 'Wycisz';
                    muteBtn.onclick = (e) => {
                        e.stopPropagation();
                        const p = document.getElementById('adminPanel');
                        if (p) {
                            adminSelectedUserId = id;
                            conversationSidebar.classList.add('open');
                            const container = document.getElementById('conversationSidebarBody');
                            if (container) container.scrollTop = container.scrollHeight;
                            showNotification('Wybrano użytkownika w panelu administracyjnym.', 'info');
                        }
                    };

                    const banBtn = document.createElement('button');
                    banBtn.className = 'btn-secondary btn-sidebar-action danger';
                    banBtn.style.padding = '6px 10px';
                    banBtn.textContent = 'Ban';
                    banBtn.onclick = (e) => {
                        e.stopPropagation();
                        const p = document.getElementById('adminPanel');
                        if (p) {
                            adminSelectedUserId = id;
                            conversationSidebar.classList.add('open');
                            const container = document.getElementById('conversationSidebarBody');
                            if (container) container.scrollTop = container.scrollHeight;
                            showNotification('Wybrano użytkownika w panelu administracyjnym.', 'info');
                        }
                    };

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn-secondary btn-sidebar-action danger';
                    delBtn.style.padding = '6px 10px';
                    delBtn.textContent = 'Usuń';
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Usunąć użytkownika ${name}? Tej operacji nie można cofnąć.`)) return;
                        try {
                            const res = await fetch(`${currentApiUrl}/admin/users/${id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                                showNotification('Użytkownik usunięty.', 'success');
                                updateConversationSidebar();
                            } else {
                                await handleApiError(res, 'Nie udało się usunąć użytkownika');
                            }
                        } catch (err) {
                            showNotification('Błąd połączenia.', 'error');
                        }
                    };

                    actions.appendChild(muteBtn);
                    actions.appendChild(banBtn);
                    actions.appendChild(delBtn);

                    tile.appendChild(av);
                    tile.appendChild(label);
                    tile.appendChild(actions);
                    tile.style.cursor = 'default';

                    container.appendChild(tile);
                });
            }

                if (membersContainer) {
                    membersContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Ładowanie użytkowników...</div>';
                    try {
                        const usersArray = (await fetchAllUsersSafe()) || null;
                        if (usersArray) {
                            const mappedUsers = usersArray.map(u => ({
                                id: u.id || u.Id,
                                username: u.username || u.Username,
                                avatarUrl: u.avatarUrl || u.AvatarUrl,
                                status: u.status || u.Status
                            }));
                        renderProfileList(membersContainer, mappedUsers, 'Brak dostępnych użytkowników.');
                        } else {
                            renderProfileList(membersContainer, friends || [], 'Brak dostępnych użytkowników.');
                        }
                    } catch (e) {
                        renderProfileList(membersContainer, friends || [], 'Brak dostępnych użytkowników.');
                    }
                }
                if (adminControls && !adminControls.closest('#adminSidebar')) { adminControls.innerHTML = ''; adminControls.style.display = 'none'; }
            } else if (currentChatType === 'private' && currentChatId) {
                if (avatarEl) avatarEl.style.backgroundColor = '';
                const friend = friends.find(f => f.id == currentChatId || f.Id == currentChatId);
                if (titleEl) titleEl.textContent = 'Rozmowa prywatna';
                const username = friend ? (friend.username || friend.Username || 'Użytkownik') : 'Użytkownik';
                const avatarUrl = friend ? (friend.avatarUrl || friend.AvatarUrl) : null;
                if (nameEl) nameEl.textContent = username;
                if (avatarEl) {
                    if (avatarUrl) {
                        const url = resolveUrl(avatarUrl);
                        avatarEl.style.backgroundImage = `url('${url}')`;
                        avatarEl.textContent = '';
                    } else {
                        avatarEl.style.backgroundImage = '';
                        avatarEl.textContent = username.charAt(0).toUpperCase();
                    }
                }
                let status = 'Niedostępny';
                if (friend && (friend.isOnline || friend.IsOnline)) {
                    status = 'Dostępny';
                }
                if (statusEl) statusEl.textContent = status;
                if (mutualsSection) mutualsSection.style.display = 'block';
                if (groupsSection) {
                    groupsSection.style.display = 'block';
                    const h4 = groupsSection.querySelector('h4');
                    if (h4) h4.textContent = 'Wspólne grupy';
                }
                if (membersSection) membersSection.style.display = 'none';

                await loadSidebarMutualsAndGroups(currentChatId);
            } else if (currentChatType === 'group' && currentChatId) {
                if (avatarEl) avatarEl.style.backgroundColor = '';
                const group = groups.find(g => g.id == currentChatId || g.Id == currentChatId);
                if (titleEl) titleEl.textContent = 'Grupa';
                const groupName = group ? (group.name || group.Name || 'Grupa') : 'Grupa';
                const avatarUrl = group ? (group.avatarUrl || group.AvatarUrl) : null;
                if (nameEl) nameEl.textContent = groupName;
                if (avatarEl) {
                    if (avatarUrl) {
                        const url = resolveUrl(avatarUrl);
                        avatarEl.style.backgroundImage = `url('${url}')`;
                        avatarEl.textContent = '';
                    } else {
                        avatarEl.style.backgroundImage = '';
                        avatarEl.textContent = groupName.charAt(0).toUpperCase();
                    }
                }
                if (statusEl) statusEl.textContent = '';
                if (mutualsSection) mutualsSection.style.display = 'none';
                if (groupsSection) groupsSection.style.display = 'none';
                if (membersSection) membersSection.style.display = 'block';

                // --- ACTIONS INJECTION ---
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const currentUserId = currentUser ? (currentUser.id || currentUser.Id) : null;
                const groupOwnerId = group ? (group.ownerId || group.OwnerId) : null;
                
                const isAdmin = group && currentUserId && groupOwnerId && (String(groupOwnerId) === String(currentUserId));
                
                if (adminControls) { adminControls.innerHTML=''; adminControls.style.display='none'; }

                if (isAdmin) {
                    if (adminControls) adminControls.innerHTML = '';
                    // Add Member Button
                    const addBtn = document.createElement('button');
                    addBtn.className = 'btn-secondary btn-sidebar-action';
                    addBtn.innerHTML = '<span class="material-symbols-outlined">person_add</span> Dodaj członków';
                    addBtn.onclick = () => openAddMemberModal(currentChatId);
                    /* admin actions removed from chat info */

                    // Edit Group Button
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-secondary btn-sidebar-action';
                    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> Edytuj grupę';
                    editBtn.onclick = () => openEditGroupModal(currentChatId, group.name || group.Name);
                    /* admin actions removed from chat info */
                    
                    // Change Photo Button
                    const photoBtn = document.createElement('button');
                    photoBtn.className = 'btn-secondary btn-sidebar-action';
                    photoBtn.innerHTML = '<span class="material-symbols-outlined">image</span> Zmień zdjęcie grupy';
                    photoBtn.onclick = () => changeGroupPhoto(currentChatId);
                    /* admin actions removed from chat info */
                    
                    // Delete Group Button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-secondary btn-sidebar-action danger';
                    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span> Usuń grupę';
                    deleteBtn.onclick = () => deleteGroup(currentChatId);
                    /* admin actions removed from chat info */
                } else {
                    // Leave Group Button
                    const leaveBtn = document.createElement('button');
                    leaveBtn.className = 'btn-secondary btn-sidebar-action danger';
                    leaveBtn.innerHTML = '<span class="material-symbols-outlined">logout</span> Opuść grupę';
                    leaveBtn.onclick = () => leaveGroup(currentChatId);
                    /* admin actions removed from chat info */
                }

                if (membersContainer) {
                    membersContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Ładowanie uczestników...</div>';
                    try {
                        const res = await fetch(`${currentApiUrl}/groups/${currentChatId}/members`, {
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
                imagesContainer.innerHTML = ''; // Clear existing images before repopulating
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
                const res = await fetch(`${currentApiUrl}/friends/mutual/${userId}`, {
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
                const res = await fetch(`${currentApiUrl}/groups/common/${userId}`, {
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
                    loadProductionContent();
                    loadGeneralChannel();
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
        // Initial data load and connection moved to end of file to prevent UI blocking

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

        const openAdminSidebarButtonEl = document.getElementById('openAdminSidebarButton');
        const adminSidebarEl = document.getElementById('adminSidebar');
        const adminSidebarBodyEl = document.getElementById('adminSidebarBody');
        const closeAdminSidebarButtonEl = document.getElementById('closeAdminSidebarButton');
        if (openAdminSidebarButtonEl) {
            try {
                const u = JSON.parse(localStorage.getItem('user'));
                const isAdminUser = u && (u.isAdmin || u.IsAdmin);
                openAdminSidebarButtonEl.style.display = isAdminUser ? 'inline-flex' : 'none';
            } catch {}
            openAdminSidebarButtonEl.addEventListener('click', () => {
                try {
                    if (adminSidebarEl) {
                        adminSidebarEl.style.display = 'block';
                        adminSidebarEl.classList.add('open');
                        if (typeof window.initAdminPanel === 'function') window.initAdminPanel();
                    }
                } catch (e) { console.error(e); }
            });
        }
        if (closeAdminSidebarButtonEl) {
            closeAdminSidebarButtonEl.addEventListener('click', () => {
                try {
                    if (adminSidebarEl) {
                        adminSidebarEl.classList.remove('open');
                        adminSidebarEl.style.display = 'none';
                    }
                } catch (e) { console.error(e); }
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
                    const res = await fetch(`${currentApiUrl}/groups/${currentEditingGroupId}`, {
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

        window.scrollToMessage = function(messageId) {
            const el = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-message');
                setTimeout(() => el.classList.remove('highlight-message'), 2000);
            } else {
                showNotification('Nie znaleziono wiadomości.', 'info');
            }
        };

        window.deleteMessage = function(messageId) {
            if (!messageId) {
                console.error('deleteMessage: ID is missing', messageId);
                return;
            }

            // Check if modal exists
            let modalOverlay = document.getElementById('deleteConfirmModal');
            if (!modalOverlay) {
                modalOverlay = document.createElement('div');
                modalOverlay.id = 'deleteConfirmModal';
                modalOverlay.className = 'custom-confirm-overlay';
                modalOverlay.innerHTML = `
                    <div class="custom-confirm-box">
                        <div class="confirm-icon">
                            <span class="material-symbols-outlined">delete_forever</span>
                        </div>
                        <h3 class="custom-confirm-title">Usunąć wiadomość?</h3>
                        <p class="custom-confirm-message">Tej operacji nie można cofnąć.</p>
                        <div class="custom-confirm-actions">
                            <button class="btn-confirm-cancel" id="cancelDeleteBtn">Anuluj</button>
                            <button class="btn-confirm-danger" id="confirmDeleteBtn">Usuń</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalOverlay);
            }

            const cancelBtn = modalOverlay.querySelector('#cancelDeleteBtn');
            const confirmBtn = modalOverlay.querySelector('#confirmDeleteBtn');
            
            // Clone buttons to remove old listeners
            const newCancel = cancelBtn.cloneNode(true);
            const newConfirm = confirmBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

            newCancel.onclick = () => {
                modalOverlay.classList.remove('show');
                setTimeout(() => modalOverlay.style.display = 'none', 300);
            };

            newConfirm.onclick = async () => {
                modalOverlay.classList.remove('show');
                setTimeout(() => modalOverlay.style.display = 'none', 300);
                
                try {
                    const token = localStorage.getItem('token');
                    if (!token) {
                        showNotification('Brak tokenu autoryzacji. Zaloguj się ponownie.', 'error');
                        return;
                    }
                    const response = await fetch(`${currentApiUrl}/messages/${messageId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const wrapper = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
                        if (wrapper) {
                            wrapper.style.transition = 'opacity 0.3s, height 0.3s';
                            wrapper.style.opacity = '0';
                            setTimeout(() => wrapper.remove(), 300);
                        }
                        showNotification('Wiadomość usunięta.', 'success');
                    } else {
                        // Error handling
                        let errorMsg = 'Nie udało się usunąć wiadomości';
                        try {
                            const text = await response.text();
                            const errData = JSON.parse(text);
                            errorMsg = errData.message || errData.error || text;
                        } catch {}
                        showNotification(errorMsg, 'error');
                    }
                } catch (e) {
                    console.error('Error deleting message', e);
                    showNotification('Błąd sieci/serwera.', 'error');
                }
            };

            modalOverlay.style.display = 'flex';
            // Force reflow
            void modalOverlay.offsetWidth;
            modalOverlay.classList.add('show');
        };

        window.clearGlobalChat = async function() {
            try {
                const res = await fetch(`${currentApiUrl}/admin/messages/global`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    cache: 'no-store'
                });
                if (res.ok) {
                    const data = await res.json();
                    showNotification(data.message || 'Kanał ogólny wyczyszczony.', 'success');
                    await loadMessages(null, 'global');
                } else {
                    await handleApiError(res, 'Nie udało się wyczyścić kanału ogólnego');
                }
            } catch (e) {
                console.error(e);
                showNotification('Błąd połączenia.', 'error');
            }
        };

        window.toggleReactionPicker = function(messageId, btnElement) {
            // Close any existing picker
            let existing = document.getElementById('reaction-picker-popup');
            if (existing) {
                const isSame = existing.dataset.messageId === messageId.toString();
                existing.classList.remove('show');
                setTimeout(() => existing.remove(), 200);
                if (isSame) return;
            }

            const picker = document.createElement('div');
            picker.id = 'reaction-picker-popup';
            picker.className = 'reaction-picker-popup';
            picker.dataset.messageId = messageId;
            
            // Common Discord-like emojis + extended set
            const emojiChars = (
                "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😉 🙂 🙃 😍 😘 😗 😜 🤪 🤩 😎 😏 " +
                "😡 😠 😢 😭 😱 🤔 🙄 😴 😇 😈 👿 " +
                "😺 😸 😹 😻 🙀 😿 😾 " +
                "👍 👎 👊 🤝 🙌 👏 👋 🤚 ✋ 🤞 🤟 🤘 🙏 " +
                "❤️ 💔 💕 💖 💙 💚 💛 💜 🖤 💩 🔥 ⭐ ✨ 🎉 🎁 🎵 💀 🤡 🥳 🥺"
            ).split(" ");
            
            emojiChars.forEach(emoji => {
                if (!emoji) return;
                const btn = document.createElement('span');
                btn.className = 'reaction-btn';
                btn.textContent = emoji;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    window.reactToMessage(messageId, emoji);
                    picker.classList.remove('show');
                    setTimeout(() => picker.remove(), 200);
                };
                picker.appendChild(btn);
            });

            document.body.appendChild(picker);
            
            // Positioning logic
            const rect = btnElement.getBoundingClientRect();
            // Assuming 8 cols, approx 40px per col + gaps + padding -> ~360-380px safe width
            const pickerWidth = 380; 
            const pickerHeight = 320; // Max height
            
            let left = rect.left - (pickerWidth / 2) + (rect.width / 2) - 200;
            let top = rect.top - pickerHeight - 10;
            let transformOrigin = 'bottom center';

            // Boundary checks
            if (left < 10) {
                left = 10;
                transformOrigin = 'bottom left';
            }
            
            // Strict right boundary check
            if (left + pickerWidth > window.innerWidth - 20) {
                left = window.innerWidth - pickerWidth - 20;
                transformOrigin = 'bottom right';
            }
            
            if (top < 10) {
                // If not enough space above, show below
                top = rect.bottom + 10;
                transformOrigin = transformOrigin.replace('bottom', 'top');
                
                // If showing below, verify it doesn't go off bottom
                if (top + pickerHeight > window.innerHeight - 10) {
                    // If tight on both sides, center vertically or prioritize visibility
                    // Try to fit where there is more space
                    const spaceAbove = rect.top;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    
                    if (spaceAbove > spaceBelow) {
                        top = 10; // Anchor to top of screen
                        picker.style.maxHeight = `${rect.top - 20}px`; // Limit height to fit above
                        transformOrigin = 'bottom center';
                    } else {
                        top = rect.bottom + 10;
                        picker.style.maxHeight = `${window.innerHeight - top - 10}px`; // Limit height to fit below
                        transformOrigin = 'top center';
                    }
                }
            } else {
                // Showing above, ensure it doesn't overlap top edge (already checked < 10)
                // Reset max-height just in case
                picker.style.maxHeight = '320px';
            }

            picker.style.top = `${top}px`;
            picker.style.left = `${left}px`;
            picker.style.transformOrigin = transformOrigin;
            
            // Trigger animation
            requestAnimationFrame(() => {
                picker.classList.add('show');
            });

            const closeHandler = (e) => {
                if (!picker.contains(e.target) && e.target !== btnElement) {
                    picker.classList.remove('show');
                    setTimeout(() => picker.remove(), 200);
                    document.removeEventListener('click', closeHandler);
                    document.removeEventListener('contextmenu', closeHandler);
                }
            };
            
            // Delay adding listener to avoid immediate close
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('contextmenu', closeHandler);
            }, 50);
        };

        window.reactToMessage = async function(messageId, emoji) {
            if (!messageId) return;
            const msgIdInt = parseInt(messageId);
            const safeEmoji = emoji || ""; // Ensure string
            if (isNaN(msgIdInt)) {
                console.error("Invalid message ID for reaction:", messageId);
                return;
            }
            try {
                if (window.connection && window.connection.state === signalR.HubConnectionState.Connected) {
                    await window.connection.invoke("ReactToMessage", msgIdInt, safeEmoji);
                } else {
                     console.warn('SignalR disconnected. Cannot react.');
                     showNotification('Brak połączenia z serwerem. Odśwież stronę.', 'error');
                }
            } catch (e) {
                console.error("Reaction failed", e);
                let errorMsg = 'Nie udało się dodać reakcji.';
                if (e && e.message) {
                     if (e.message.includes("HubException:")) {
                         errorMsg = e.message.split("HubException:")[1].trim();
                     } else if (e.message.length < 100) {
                         errorMsg = e.message;
                     }
                }
                showNotification(errorMsg, 'error');
            }
        };

        console.log("Initializing data and connection...");
        loadFriends();
        loadGroups();
        loadPendingRequests();
        
        // Non-blocking connection start (bez await, aby uniknąć błędu składni)
        startConnection().catch((e) => {
            console.error("Initial connection failed:", e);
        });

        setInterval(() => {
            loadPendingRequests();
            loadSentRequests();
            loadFriends();
            loadGroups();
        }, 6069);

        // Mobile Back Button Logic
        const mobileBackBtn = document.getElementById('mobileBackBtn');
        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.remove('chat-open');
                currentChatId = null;
                currentChatType = null;
                document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            });
        }

        console.log("App initialized successfully (v24)");
    })();
    }
});

// Global user profile open helper
window.openUserProfile = async function(userId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) { showNotification('Zaloguj się ponownie.', 'error'); return; }
        const res = await fetch(`${currentApiUrl}/Users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
            cache: 'no-store'
        });
        if (!res.ok) { await handleApiError(res, 'Nie udało się pobrać profilu'); return; }
        const data = await res.json();
        const modal = document.getElementById('userProfileModal');
        if (!modal) return;
        const avatar = document.getElementById('profileAvatar');
        const usernameEl = document.getElementById('profileUsername');
        const statusEl = document.getElementById('profileStatus');
        if (avatar) {
            const url = data.avatarUrl || data.AvatarUrl;
            if (url) { avatar.style.backgroundImage = `url('${resolveUrl(url)}')`; avatar.textContent = ''; }
            else { avatar.style.backgroundImage = ''; avatar.textContent = (data.username || data.Username || 'U').charAt(0).toUpperCase(); }
        }
        if (usernameEl) usernameEl.textContent = data.username || data.Username || 'Użytkownik';
        if (statusEl) statusEl.textContent = (data.status || data.Status || 0) > 0 ? 'Dostępny' : 'Niedostępny';
        modal.style.display = 'block';
        // force reflow and show
        void modal.offsetWidth;
        modal.classList.add('show');
        const closeBtn = document.getElementById('closeUserProfileModal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };
        }
    } catch (e) {
        console.error(e);
        showNotification('Błąd sieci profilu.', 'error');
    }
};
