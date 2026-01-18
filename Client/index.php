<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrotnest</title>
    <link rel="icon" href="logo.png" type="image/png">
    <link rel="stylesheet" href="style.css?v=8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js"></script>
    <script>

        (function() {
            try {
                const token = localStorage.getItem('token');
                const userStr = localStorage.getItem('user');
                
                if (!token || !userStr) {
                    console.warn('Brak tokena lub użytkownika w localStorage. Przekierowanie do logowania.');
                    window.location.href = '/login.php';
                    return;
                }

                const user = JSON.parse(userStr);
                if (!user) {
                    window.location.href = '/login.php';
                    return;
                }
                document.addEventListener('DOMContentLoaded', () => {
                    const userNameEl = document.getElementById('userName');
                    const userAvatarEl = document.getElementById('userAvatar');
                    
                    if (userNameEl) {
                        userNameEl.textContent = user.username || user.userName || user.email || 'Użytkownik';
                    }
                    
                    if (userAvatarEl) {
                        const uAv = user.avatarUrl || user.AvatarUrl;
                        if (uAv) {
                            let url = uAv;
                            if (!url.startsWith('http') && !url.startsWith('data:')) {
                                url = url.replace(/\\/g, '/');
                                if (!url.startsWith('/')) url = '/' + url;
                                let base = window.location.origin;
                                if (window.location.protocol === 'file:') {
                                    base = 'http://localhost:6069';
                                }
                                url = `${base}${url}`;
                            } else {
                                try {
                                    const target = new URL(url);
                                    const current = new URL(window.location.origin);
                                    if (target.hostname === 'localhost' || target.hostname === '0.0.0.0') {
                                        target.hostname = current.hostname;
                                        target.port = current.port || target.port;
                                        target.protocol = current.protocol;
                                        url = target.toString();
                                    }
                                } catch (e) {
                                }
                            }
                            
                            userAvatarEl.style.backgroundImage = `url('${url}')`;
                            userAvatarEl.style.backgroundSize = 'cover';
                            userAvatarEl.textContent = '';
                        } else {
                            const name = user.username || user.userName || user.email || '?';
                            userAvatarEl.textContent = name.charAt(0).toUpperCase();
                            userAvatarEl.style.backgroundImage = '';
                            userAvatarEl.style.display = 'flex';
                            userAvatarEl.style.alignItems = 'center';
                            userAvatarEl.style.justifyContent = 'center';
                            userAvatarEl.style.backgroundColor = 'var(--accent-color)';
                            userAvatarEl.style.color = 'white';
                            userAvatarEl.style.fontSize = '1.5rem';
                        }
                    }
                });
            } catch (e) {
                console.error('Błąd pre-loadera:', e);
            }
        })();
    </script>
</head>
<body>
    <div class="dashboard-container">
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo-container" id="logoContainer" title="Kliknij, aby usłyszeć papugę!">
                    <img src="logo.png" alt="Logo" class="header-logo">
                    <h2>Parrotnest</h2>
                </div>
            </div>
                <div class="chat-list">
                <div class="chat-item active" id="globalChatItem">
                    <div class="avatar"></div>
                    <div class="chat-info">
                        <h4>Ogólny</h4>
                    </div>
                </div>
            </div>
            <div class="sidebar-footer">
                <button class="btn-add-sidebar" id="addFriendGroupButton" title="Dodaj znajomego lub grupę">+</button>
                <div class="user-profile">
                    <div class="user-info">
                        <div class="avatar" id="userAvatar"></div>
                        <div>
                            <h4 id="userName">Ładowanie...</h4>
                            <span id="userStatus" class="status-online">Online</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-icon" id="notificationButton" title="Włącz/Wyłącz powiadomienia">🔔</button>
                        <button class="btn-icon" id="settingsButton" title="Ustawienia">⚙️</button>
                        <button class="btn-icon btn-logout" id="logoutButton" title="Wyloguj się">🚪</button>
                    </div>
                </div>
            </div>
        </aside>
        <main class="chat-area">
            <div class="chat-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar"></div>
                    <h3>Ogólny</h3>
                </div>
                <div class="chat-actions">
                    <button class="btn-icon" id="conversationInfoButton" title="Informacje o rozmowie">ℹ️</button>
                    <button class="btn-icon" id="addGroupMemberBtn" style="display: none;" title="Dodaj członków">➕</button>
                    <button class="btn-icon" id="removeGroupMemberBtn" style="display: none;" title="Usuń użytkownika">➖</button>
                    <button class="btn-icon" id="leaveGroupBtn" style="display: none;" title="Opuść grupę">🚪</button>
                    <button class="btn-icon" id="deleteGroupBtn" style="display: none;" title="Usuń grupę">🗑️</button>
                </div>
            </div>
            <div class="messages-container" id="chat-messages">
                <div class="message received">
                    Witaj w Parrotnest! To jest początek twojej konwersacji.
                </div>
            </div>
            <form class="chat-input-area" id="messageForm">
                <input type="file" id="imageInput" accept="image/*" style="display: none;">
                <button type="button" class="btn-icon" id="attachButton" title="Załącz plik">📎</button>
                <button type="button" class="btn-icon" id="emojiButton" title="Emoji">😊</button>
                <div id="attachmentPreview" style="display: none; margin-right: 10px; color: var(--accent-green);"></div>
                <input type="text" id="messageInput" placeholder="Napisz wiadomość...">
                <button type="submit" id="sendButton" class="btn-send" title="Wyślij wiadomość">➤</button>
            </form>
            <div id="emojiPicker" class="emoji-picker"></div>
        </main>
    </div>
    <div class="conversation-sidebar" id="conversationSidebar">
        <div class="conversation-sidebar-header">
            <h3 id="conversationSidebarTitle"></h3>
            <button class="btn-icon" id="closeConversationSidebarButton" title="Zamknij panel">✖</button>
        </div>
        <div class="conversation-sidebar-body">
            <div class="conversation-sidebar-section">
                <div class="avatar-large" id="conversationSidebarAvatar"></div>
                <div class="conversation-sidebar-main">
                    <h2 id="conversationSidebarName"></h2>
                    <span id="conversationSidebarStatus" class="status-badge"></span>
                </div>
            </div>
            <div class="conversation-sidebar-section" id="conversationSidebarMutualsSection">
                <h4>Wspólni znajomi</h4>
                <div id="conversationSidebarMutualFriends" class="conversation-sidebar-list"></div>
            </div>
            <div class="conversation-sidebar-section" id="conversationSidebarGroupsSection">
                <h4>Wspólne grupy</h4>
                <div id="conversationSidebarGroups" class="conversation-sidebar-list"></div>
            </div>
            <div class="conversation-sidebar-section">
                <h4>Zdjęcia na czacie</h4>
                <div id="conversationSidebarImages" class="conversation-sidebar-images"></div>
            </div>
        </div>
    </div>
    <div id="addModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Dodaj znajomego lub grupę</h3>
                <button class="modal-close" id="closeModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-tabs">
                    <button class="tab-button active" data-tab="friend">Znajomy</button>
                    <button class="tab-button" data-tab="group">Grupa</button>
                    <button class="tab-button" data-tab="requests">Zaproszenia</button>
                </div>
                <div class="tab-content active" id="friendTab">
                    <div class="input-group">
                        <label for="friendUsername">Nazwa użytkownika lub email</label>
                        <input type="text" id="friendUsername" placeholder="Wpisz nazwę użytkownika lub email">
                    </div>
                    <button class="btn-primary" id="addFriendBtn">Dodaj znajomego</button>
                </div>
                <div class="tab-content" id="groupTab">
                    <div class="input-group">
                        <label>Ikona grupy</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="avatar" id="groupAvatarPreview" style="cursor: pointer; background-color: var(--accent-green);"></div>
                            <button class="btn-secondary" id="changeGroupAvatarBtn" style="font-size: 0.8rem; padding: 5px 10px;">Wybierz ikonę</button>
                            <input type="file" id="groupAvatarInput" accept="image/*" style="display: none;">
                        </div>
                    </div>
                    <div class="input-group">
                        <label for="groupName">Nazwa grupy</label>
                        <input type="text" id="groupName" placeholder="Wpisz nazwę grupy">
                    </div>
                    <div class="input-group">
                        <label for="groupMembers">Członkowie (opcjonalnie)</label>
                        <div id="friendsSelectionList" style="display: flex; flex-wrap: wrap; gap: 10px; max-height: 200px; overflow-y: auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                            <div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak znajomych do wyboru.</div>
                        </div>
                        <input type="hidden" id="groupMembers">
                    </div>
                    <button class="btn-primary" id="addGroupBtn">Utwórz grupę</button>
                </div>
                <div class="tab-content" id="requestsTab">
                    <div class="input-group">
                        <label>Oczekujące zaproszenia</label>
                        <div id="pendingRequestsList" style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak zaproszeń.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="addMemberModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Dodaj członków do grupy</h3>
                <button class="modal-close" id="closeAddMemberModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label>Wybierz znajomych</label>
                    <div id="addMemberSelectionList" style="display: flex; flex-wrap: wrap; gap: 10px; max-height: 200px; overflow-y: auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                    </div>
                </div>
                <button class="btn-primary" id="confirmAddMemberBtn">Dodaj wybrane osoby</button>
            </div>
        </div>
    </div>
    <div id="settingsModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Ustawienia Profilu</h3>
                <button class="modal-close" id="closeSettingsModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="settings-avatar-section">
                    <div class="avatar-large" id="settingsAvatarPreview"></div>
                    <button class="btn-secondary" id="changeAvatarBtn">Zmień zdjęcie</button>
                    <input type="file" id="avatarInput" accept="image/*" style="display: none;">
                </div>
                <form id="settingsForm">
                    <div class="input-group">
                        <label for="settingsUsername">Nazwa użytkownika</label>
                        <input type="text" id="settingsUsername" name="username" placeholder="Twoja nazwa">
                    </div>
                    <div class="input-group">
                        <label for="settingsEmail">Adres e-mail</label>
                        <input type="email" id="settingsEmail" name="email" placeholder="Twój e-mail" disabled style="opacity: 0.7;">
                    </div>
                    <div class="input-group">
                        <label for="settingsPassword">Nowe hasło (opcjonalnie)</label>
                        <input type="password" id="settingsPassword" name="password" placeholder="Zostaw puste aby nie zmieniać">
                    </div>
                    <button type="submit" class="btn-primary" id="saveSettingsBtn">Zapisz zmiany</button>
                </form>
            </div>
        </div>
    </div>
    <div id="userProfileModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Profil użytkownika</h3>
                <button class="modal-close" id="closeUserProfileModal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div class="avatar-large" id="profileAvatar"></div>
                    <h2 id="profileUsername" style="margin: 0;"></h2>
                    <span id="profileStatus" class="status-badge"></span>
                </div>
                <div id="profileMutualsSection" style="display: none; width: 100%;">
                    <div class="input-group">
                        <label>Wspólni znajomi</label>
                        <div id="profileMutualFriendsList" style="display: flex; gap: 10px; overflow-x: auto; padding: 10px 0;">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Wspólne serwery</label>
                        <div id="profileCommonServersList" style="display: flex; gap: 10px; overflow-x: auto; padding: 10px 0;">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="image-modal" class="image-modal">
        <span class="close-image-modal">&times;</span>
        <img class="image-modal-content" id="img-preview">
        <div id="caption"></div>
    </div>
    <script src="auth.js?v=5"></script>
    <script src="app.js?v=15"></script>
</body>
</html>
