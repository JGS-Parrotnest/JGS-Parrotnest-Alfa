<!DOCTYPE html>
<html lang="pl">
<head>
    <script>
        (function() {
            try {
                var t = localStorage.getItem('preferredTheme');
                if (!t) {
                    t = 'original';
                    localStorage.setItem('preferredTheme', t);
                }
                document.documentElement.setAttribute('data-theme', t);
                
                var s = localStorage.getItem('preferredTextSize');
                if (!s) {
                    s = 'medium';
                    localStorage.setItem('preferredTextSize', s);
                }
                document.documentElement.setAttribute('data-text-size', s);

                var st = localStorage.getItem('preferredSimpleText');
                if (st === 'true') {
                    document.documentElement.setAttribute('data-simple-text', 'true');
                }
            } catch (e) {
                document.documentElement.setAttribute('data-theme', 'original');
            }
        })();
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrotnest</title>
    <link rel="icon" href="logo.png" type="image/png">
    <link rel="stylesheet" href="style.css?v=15">
    <link rel="stylesheet" href="mobile.css?v=3" media="(max-width: 768px)">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js"></script>
    <script>

        (function() {
            try {
                const token = localStorage.getItem('token');
                const userStr = localStorage.getItem('user');
                
                if (!token) {
                    console.warn('Brak tokena w localStorage. Przekierowanie do logowania.');
                    window.location.href = '/login.php';
                    return;
                }
                
                // Allow userStr to be missing, app.js will handle recovery
                let user = null;
                if (userStr) {
                    try {
                        user = JSON.parse(userStr);
                    } catch (e) {}
                }

                document.addEventListener('DOMContentLoaded', () => {
                    const userNameEl = document.getElementById('userName');
                    const userAvatarEl = document.getElementById('userAvatar');
                    
                    if (user) {
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
                                userAvatarEl.style.backgroundColor = 'transparent';
                                userAvatarEl.textContent = '';
                            } else {
                                const name = user.username || user.userName || user.email || '?';
                                userAvatarEl.textContent = name.charAt(0).toUpperCase();
                                userAvatarEl.style.backgroundImage = '';
                                userAvatarEl.style.display = 'flex';
                                userAvatarEl.style.alignItems = 'center';
                                userAvatarEl.style.justifyContent = 'center';
                                userAvatarEl.style.backgroundColor = 'var(--accent-green)';
                                userAvatarEl.style.backgroundColor = 'var(--accent-color)';
                                userAvatarEl.style.color = 'var(--btn-text-color, white)';
                                userAvatarEl.style.fontSize = '1.5rem';
                            }
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
                <div class="channel-folder" id="globalFolder">
                    <button class="channel-folder-header" id="globalFolderHeader">
                        <span>Kanały</span>
                        <span class="channel-folder-arrow">▼</span>
                    </button>
                    <div class="channel-folder-body" id="globalFolderBody">
                        <div class="chat-item active" id="globalChatItem">
                            <div class="avatar" style="background-image: url('logo.png'); background-size: cover; background-position: center;"></div>
                            <div class="chat-info">
                                <h4>Ogólny</h4>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="channel-folder" id="friendsFolder">
                    <button class="channel-folder-header" id="friendsFolderHeader">
                        <span>Znajomi</span>
                        <span class="channel-folder-arrow">▼</span>
                    </button>
                    <div class="channel-folder-body" id="friendsFolderBody">
                        <!-- Lista znajomych będzie renderowana dynamicznie -->
                    </div>
                </div>
                <div class="channel-folder" id="groupsFolder">
                    <button class="channel-folder-header" id="groupsFolderHeader">
                        <span>Grupy</span>
                        <span class="channel-folder-arrow">▼</span>
                    </button>
                    <div class="channel-folder-body" id="groupsFolderBody">
                        <!-- Lista grup będzie renderowana dynamicznie -->
                    </div>
                </div>
            </div>
            <div style="padding: 0 10px; position: relative;">
                <button class="btn-add-sidebar" id="addFriendGroupButton" title="Dodaj znajomego lub grupę">+</button>
                <div id="notificationBadge" class="notification-badge" style="display: none;">0</div>
            </div>
            <div class="sidebar-footer">
                <div class="user-profile">
                    <div class="user-info">
                        <div class="avatar" id="userAvatar"></div>
                        <div>
                            <h4 id="userName">Ładowanie...</h4>
                            <span id="userStatus" class="status-online">Online</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-icon" id="settingsButton" title="Ustawienia">⚙️</button>
                    </div>
                </div>
            </div>
        </aside>
        <main class="chat-area">
            <div class="chat-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="mobile-back-btn" id="mobileBackBtn" style="display: none;">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </div>
                    <div class="avatar"></div>
                    <h3>Ogólny</h3>
                </div>
                <div class="chat-actions">
                    <button class="btn-icon" id="conversationInfoButton" title="Informacje o czacie"><span class="material-symbols-outlined">info</span></button>
                </div>
            </div>
            <div class="messages-container" id="chat-messages">
                <div class="message received">
                    Witaj w Parrotnest! To jest początek twojej konwersacji.
                </div>
            </div>
            <div id="reply-preview"></div>
            <form class="chat-input-area" id="messageForm">
                <input type="file" id="imageInput" accept="image/*" style="display: none;">
                <button type="button" class="btn-icon" id="attachButton" title="Załącz plik"><span class="material-symbols-outlined">attach_file</span></button>
                <button type="button" class="btn-icon" id="emojiButton" title="Emoji"><span class="material-symbols-outlined">mood</span></button>
                <div id="attachmentPreview" style="display: none; margin-right: 10px; color: var(--accent-green);"></div>
                <input type="text" id="messageInput" placeholder="Napisz wiadomość...">
                <button type="submit" id="sendButton" class="btn-send" title="Wyślij wiadomość"><span class="material-symbols-outlined">send</span></button>
            </form>
            <div id="emojiPicker" class="emoji-picker"></div>
        </main>
    </div>
    <div class="conversation-sidebar" id="conversationSidebar">
        <div class="conversation-sidebar-header">
            <button class="btn-icon" id="closeConversationSidebarButton" title="Zamknij panel"><span class="material-symbols-outlined">close</span></button>
            <div class="info-card">
                <div class="avatar-large" id="conversationSidebarAvatar"></div>
                <h2 id="conversationSidebarName">Nazwa</h2>
                <div class="status-text" id="conversationSidebarStatus">Status</div>
            </div>
        </div>
        <div class="conversation-sidebar-body" id="conversationSidebarBody">
            <div class="sidebar-section" id="conversationSidebarMembersSection" style="display: none;">
                <h4>Uczestnicy</h4>
                <div class="conversation-sidebar-list" id="conversationSidebarMembers"></div>
            </div>

            <div class="sidebar-section" id="conversationSidebarMutualsSection">
                <h4>Wspólni znajomi</h4>
                <div class="conversation-sidebar-list" id="conversationSidebarMutualFriends"></div>
            </div>

            <div class="sidebar-section" id="conversationSidebarGroupsSection">
                <h4>Wspólne grupy</h4>
                <div class="conversation-sidebar-list" id="conversationSidebarGroups"></div>
            </div>

            <div class="sidebar-section">
                <h4>Zdjęcia i pliki</h4>
                <div class="conversation-sidebar-images" id="conversationSidebarImages"></div>
            </div>
            
            <div class="sidebar-section" id="adminPanel" style="display: none;">
                <h4>Panel administracyjny</h4>
                <div id="adminAccessWarning" style="display:none;color:var(--error-color);font-size:0.9rem;margin-bottom:10px;">Brak uprawnień administratora.</div>
                <div class="input-group">
                    <label for="adminUserSearch">Wyszukaj użytkowników</label>
                    <input type="text" id="adminUserSearch" placeholder="Filtruj po nazwie lub e-mailu">
                </div>
                <div class="input-group">
                    <label>Lista użytkowników</label>
                    <div id="adminUsersList" class="conversation-sidebar-list" style="max-height:250px;overflow-y:auto;"></div>
                </div>
                <div class="input-group">
                    <label>Akcje</label>
                    <div id="adminActionsArea" style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;gap:8px;">
                            <select id="adminActionSelect" style="flex:1;">
                                <option value="mute">Wycisz</option>
                                <option value="unmute">Odcisz</option>
                                <option value="ban">Zbanuj</option>
                                <option value="unban">Odbanuj</option>
                                <option value="delete">Usuń konto</option>
                            </select>
                            <input type="number" id="adminDurationMinutes" placeholder="Czas (min)" min="1" style="width:120px;">
                        </div>
                        <textarea id="adminReason" placeholder="Powód (opcjonalnie)" rows="2" style="resize:vertical;"></textarea>
                        <button class="btn-primary" id="adminExecuteActionBtn">Wykonaj akcję</button>
                    </div>
                </div>
                <div class="input-group">
                    <label>Logi aktywności administracyjnej</label>
                    <div id="adminLogsList" style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;padding:8px;font-family:monospace;font-size:0.85rem;"></div>
                </div>
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
                        <label for="groupMembers">Wybierz członków</label>
                        <div id="friendsSelectionList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; max-height: 250px; overflow-y: auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
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
                    <div class="input-group">
                        <label>Wysłane zaproszenia</label>
                        <div id="sentRequestsList" style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="color: var(--text-muted); font-size: 0.8rem; width: 100%; text-align: center;">Brak wysłanych zaproszeń.</div>
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
                    <div id="addMemberSelectionList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                    </div>
                    <input type="hidden" id="addMemberHiddenInput">
                </div>
                <button class="btn-primary" id="confirmAddMemberBtn">Dodaj wybrane osoby</button>
            </div>
        </div>
    </div>
    <div id="editGroupModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edytuj grupę</h3>
                <button class="modal-close" id="closeEditGroupModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label for="editGroupName">Nazwa grupy</label>
                    <input type="text" id="editGroupName" placeholder="Nowa nazwa grupy">
                </div>
                <button class="btn-primary" id="confirmEditGroupBtn">Zapisz zmiany</button>
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
                <div class="modal-tabs">
                    <button class="tab-button active" data-tab="settings-account">Konto</button>
                    <button class="tab-button" data-tab="settings-notifications">Powiadomienia</button>
                    <button class="tab-button" data-tab="settings-themes">Motywy</button>
                        <button class="tab-button" data-tab="settings-status">Status</button>
                </div>
                <div class="tab-content active" id="settings-accountTab">
                    <div class="settings-avatar-section">
                        <div class="avatar-large" id="settingsAvatarPreview"></div>
                        <button class="btn-secondary" id="changeAvatarBtn">Zmień zdjęcie</button>
                        <input type="file" id="avatarInput" accept="image/*" style="display: none;">
                    </div>
                    <form id="settingsForm">
                        <div class="input-group">
                            <label for="settingsUsername">Nazwa użytkownika</label>
                            <input type="text" id="settingsUsername" name="username" placeholder="Twoja nazwa" maxlength="16">
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
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color); text-align: center;">
                        <button type="button" id="accountLogoutBtn" style="background: transparent; border: 1px solid var(--error-color); color: var(--error-color); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%;">Wyloguj się</button>
                    </div>
                </div>
                <div class="tab-content" id="settings-notificationsTab">
                    <div class="input-group">
                        <label for="settingsNotificationsToggle">Powiadomienia</label>
                        <div class="notification-settings-row" style="display: flex; align-items: flex-start; gap: 20px;">
                            <button type="button" class="btn-secondary notification-toggle-btn" id="settingsNotificationsToggle" style="flex: 0 0 auto; height: 44px;">Przełącz powiadomienia</button>
                            <div class="volume-controls-wrapper" style="flex: 1; display: flex; flex-direction: column; justify-content: center; height: 44px;">
                                <input type="range" id="volumeSlider" min="0" max="100" value="100" style="width: 100%; cursor: pointer;" title="Głośność: 100%">
                                <div style="display: flex; justify-content: space-between; position: relative; height: 10px; margin-top: 5px; margin-left: 2px; margin-right: 2px;">
                                    <div style="position: absolute; left: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 1px; height: 4px; background: var(--text-muted); margin-bottom: 2px;"></div>
                                        <span style="font-size: 0.6rem; color: var(--text-muted);">0%</span>
                                    </div>
                                    <div style="position: absolute; left: 25%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 1px; height: 4px; background: var(--text-muted); margin-bottom: 2px;"></div>
                                        <span style="font-size: 0.6rem; color: var(--text-muted);">25%</span>
                                    </div>
                                    <div style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 1px; height: 4px; background: var(--text-muted); margin-bottom: 2px;"></div>
                                        <span style="font-size: 0.6rem; color: var(--text-muted);">50%</span>
                                    </div>
                                    <div style="position: absolute; left: 75%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 1px; height: 4px; background: var(--text-muted); margin-bottom: 2px;"></div>
                                        <span style="font-size: 0.6rem; color: var(--text-muted);">75%</span>
                                    </div>
                                    <div style="position: absolute; left: 100%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 1px; height: 4px; background: var(--text-muted); margin-bottom: 2px;"></div>
                                        <span style="font-size: 0.6rem; color: var(--text-muted);">100%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Dźwięk powiadomień</label>
                        <div class="themes-list" id="notificationSoundList">
                            <label class="theme-option">
                                <span class="theme-name">Oryginalny</span>
                                <input type="radio" class="theme-radio" name="notificationSound" value="original" id="soundOriginal">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Dźwięk 1</span>
                                <input type="radio" class="theme-radio" name="notificationSound" value="1.mp3" id="sound1">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Dźwięk 2</span>
                                <input type="radio" class="theme-radio" name="notificationSound" value="2.mp3" id="sound2">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Dźwięk 3</span>
                                <input type="radio" class="theme-radio" name="notificationSound" value="3.mp3" id="sound3">
                            </label>
                        </div>
                    </div>
                </div>
                <div class="tab-content" id="settings-themesTab">
                    <div class="input-group">
                        <label>Motyw interfejsu</label>
                        <div class="themes-list">
							<label class="theme-option">
                                <span class="theme-name">Oryginalny</span>
                                <input type="radio" class="theme-radio" name="theme" value="original" id="themeOriginal" checked>
                            </label>
							<label class="theme-option">
                                <span class="theme-name">Dark</span>
                                <input type="radio" class="theme-radio" name="theme" value="dark" id="themeDark">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Klasyczny</span>
                                <input type="radio" class="theme-radio" name="theme" value="classic" id="themeClassic">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Neonowy</span>
                                <input type="radio" class="theme-radio" name="theme" value="neon" id="themeNeon">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Leśny</span>
                                <input type="radio" class="theme-radio" name="theme" value="forest" id="themeForest">
                            </label>
                            <label class="theme-option">
                                <span class="theme-name">Kontrast</span>
                                <input type="radio" class="theme-radio" name="theme" value="kontrast" id="themeKontrast">
                            </label>
                        </div>
                        <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
    
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Wielkość tekstu</label>
                        <div style="padding: 0 10px;">
                            <input type="range" id="textSizeSlider" min="0" max="3" step="1" value="1">
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                                <span>Mały</span>
                                <span>Średni</span>
                                <span>Duży</span>
                                <span>X-Duży</span>
                            </div>
                        </div>
                    </div>
                    <label class="theme-option" style="cursor: pointer; margin-top: 15px;">
                        <div style="display:flex; align-items:center;">
                            <span class="theme-name">Prosty tekst</span>
                        </div>
                        <input type="checkbox" class="theme-radio" id="simpleTextToggle" style="border-radius: 4px;">
                    </label>
                </div>
                <div class="tab-content" id="settings-statusTab">
                    <div class="input-group">
                        <label>Twój status</label>
                        <div class="themes-list">
                            <label class="theme-option">
                                <div style="display:flex;align-items:center;">
                                    <span style="width:12px;height:12px;border-radius:50%;background-color:#2ecc71;margin-right:10px;"></span>
                                    <span class="theme-name">Aktywny</span>
                                </div>
                                <input type="radio" class="theme-radio" name="status" value="1" id="statusActive" checked>
                            </label>
                            <label class="theme-option">
                                <div style="display:flex;align-items:center;">
                                    <span style="width:12px;height:12px;border-radius:50%;background-color:#f1c40f;margin-right:10px;"></span>
                                    <span class="theme-name">Zaraz wracam</span>
                                </div>
                                <input type="radio" class="theme-radio" name="status" value="2" id="statusAway">
                            </label>
                            <label class="theme-option">
                                <div style="display:flex;align-items:center;">
                                    <span style="width:12px;height:12px;border-radius:50%;background-color:#e74c3c;margin-right:10px;"></span>
                                    <span class="theme-name">Nie przeszkadzać</span>
                                </div>
                                <input type="radio" class="theme-radio" name="status" value="3" id="statusDND">
                            </label>
                            <label class="theme-option">
                                <div style="display:flex;align-items:center;">
                                    <span style="width:12px;height:12px;border-radius:50%;background-color:#95a5a6;margin-right:10px;"></span>
                                    <span class="theme-name">Niewidoczny</span>
                                </div>
                                <input type="radio" class="theme-radio" name="status" value="4" id="statusInvisible">
                            </label>
                        </div>
                        <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                            <button type="button" class="btn-primary" id="saveStatusBtn" style="width: auto; padding: 10px 16px;">Zapisz status</button>
                        </div>
                    </div>
                </div>
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
                    <div id="profileActions" style="display: flex; gap: 10px; margin-top: 10px; width: 100%; justify-content: center;">
                        <button id="profileMessageBtn" class="btn-primary" style="flex: 1; max-width: 150px;">Wiadomość</button>
                        <button id="profileFriendBtn" class="btn-primary" style="flex: 1; max-width: 150px;">Dodaj do znajomych</button>
                    </div>
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
    <!-- Confirmation Modal -->
    <div class="modal" id="confirmationModal">
        <div class="modal-content small">
            <h3 style="margin-bottom: 15px; text-align: center;">Potwierdzenie</h3>
            <p id="confirmationMessage" style="text-align: center; margin-bottom: 25px; color: var(--text-muted);">Czy na pewno?</p>
            <div class="modal-actions" style="justify-content: center; gap: 15px;">
                <button class="btn-secondary" id="cancelConfirmBtn" style="min-width: 100px;">Anuluj</button>
                <button class="btn-primary" id="confirmActionBtn" style="min-width: 100px; background: var(--error-color); border-color: var(--error-color);">Usuń</button>
            </div>
        </div>
    </div>

    <!-- Secret Menu -->
    <div id="secretMenu" class="modal" style="z-index: 10000;">
        <div class="modal-content" style="width: 95%; height: 95%; max-width: none; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h3>Sekretne Menu</h3>
                <button class="modal-close" id="closeSecretMenu">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="logo.png" alt="Secret Parrot" style="width: 100px; height: 100px; animation: spin 2s linear infinite;">
                    <h2>Witaj w tajnym gnieździe!</h2>
                </div>

                <div class="settings-section" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>Eksperymentalne funkcje</h4>
                    <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
                        <label class="toggle-switch" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                            <span style="font-size: 1.1em;">Tryb tęczowy (Rainbow Mode)</span>
                            <div style="position: relative; width: 50px; height: 26px;">
                                <input type="checkbox" id="rainbowMode" style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider"></span>
                            </div>
                        </label>
                         <label class="toggle-switch" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                            <span style="font-size: 1.1em;">Obracanie awatarów (Spin Mode)</span>
                             <div style="position: relative; width: 50px; height: 26px;">
                                <input type="checkbox" id="spinMode" style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider"></span>
                            </div>
                        </label>
                        <label class="toggle-switch" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                            <span style="font-size: 1.1em;">HELL MODE</span>
                            <div style="position: relative; width: 50px; height: 26px;">
                                <input type="checkbox" id="hellMode" style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider"></span>
                            </div>
                        </label>
                    </div>
                </div>
                
                 <div class="settings-section" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                    <h4>JGS Team</h4>
                    <div id="debugInfo" style="background: #111; padding: 15px; border-radius: 8px; color: #0f0; font-family: monospace; margin-top: 10px; font-size: 0.9rem; line-height: 1.6; border: 1px solid #333;">
                        <div><strong>System:</strong> Parrotnest v8.2</div>
                        <div><strong>Copyright:</strong> &copy; 2026 Parrotnest</div>
                        <div><strong>Made by:</strong> JGS team</div>
                    </div>
                    <div class="team-grid" style="display: flex; gap: 16px; justify-content: center; align-items: stretch; margin-top: 15px;">
                        <div class="team-card" style="flex: 0 1 180px; background: #111; border: 1px solid #333; border-radius: 8px; overflow: hidden; text-align: center;">
                            <img src="Igor.jpg" alt="Igor Kondraciuk" style="width: 100%; height: auto; display: block;">
                            <div style="padding: 10px; font-weight: 600;">Igor Kondraciuk</div>
                            <div style="padding: 0 10px 10px; font-size: 0.8rem; color: #0f0; font-family: 'Courier New', monospace;">[STATUS: TEAPOT] <br>Kod pisze w takim tempie, że klawiatura zaczyna tęsknić za spokojnym życiem w Excelu.  A gdy aplikacja nie chce połączyć się z bazą danych? (włącza z program z folderu debug).</div>
                        </div>
                        <div class="team-card team-card-center" style="flex: 0 1 210px; background: #111; border: 1px solid #333; border-radius: 8px; overflow: hidden; text-align: center; transform: scale(1.06);">
                            <img src="Adam.jpg" alt="Adam Hnatko" style="width: 100%; height: auto; display: block;">
                            <div style="padding: 10px; font-weight: 700;">Adam Hnatko</div>
                            <div style="padding: 0 10px 10px; font-size: 0.8rem; color: #0f0; font-family: 'Courier New', monospace;">[STATUS: UMNIEDZIAŁA]<br>Król StackOverflow i wierny wyznawca zasady: „u mnie działa”. Na świętach już się napracował, więc teraz czas, żeby reszta zespołu miała swoją chwilę chwały.</div>
                        </div>
                        <div class="team-card" style="flex: 0 1 180px; background: #111; border: 1px solid #333; border-radius: 8px; overflow: hidden; text-align: center;">
                            <img src="Jakub.jpg" alt="Jakub Fedorowicz" style="width: 100%; height: auto; display: block;">
                            <div style="padding: 10px; font-weight: 600;">Jakub Fedorowicz</div>
                            <div style="padding: 0 10px 10px; font-size: 0.8rem; color: #0f0; font-family: 'Courier New', monospace;">[STATUS: W_TRAKCIE]<br>Termin traktuje jak wskazówkę „jeszcze nie zdążyłem”. Narzeka, gdy zespół odblokowuje 25. godzinę i robi jego zadania, bo on miał to zrobić sam.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .rainbow-mode { animation: rainbow 5s infinite; }
        @keyframes rainbow { 
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
        }
        .spin-avatars .avatar, .spin-avatars .avatar-large, .spin-avatars .message-avatar { animation: spin 3s linear infinite; }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #333;
            transition: .4s;
            border-radius: 34px;
            border: 2px solid #555;
        }

        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 2px;
            bottom: 2px;
            background-color: #888;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .toggle-slider {
            background-color: var(--accent-green, #2ecc71);
            border-color: var(--accent-green, #2ecc71);
        }

        input:focus + .toggle-slider {
            box-shadow: 0 0 1px var(--accent-green, #2ecc71);
        }

        input:checked + .toggle-slider:before {
            transform: translateX(24px);
            background-color: white;
        }
        
        .team-grid .team-card-center { margin: 0 6px; }
    </style>

    <div id="image-modal" class="image-modal">
        <span class="close-image-modal">&times;</span>
        <img class="image-modal-content" id="img-preview">
        <div id="caption"></div>
    </div>
    <script src="auth.js?v=9"></script>
    <script type="module" src="app.js?v=39"></script>
</body>
</html>
