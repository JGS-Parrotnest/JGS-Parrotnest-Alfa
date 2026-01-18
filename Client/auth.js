(() => {
    let serverBase;
    let apiUrl;
    if (window.location.protocol === 'file:') {
        serverBase = 'http://localhost:6069';
    } else {
        serverBase = window.location.origin;
    }
    apiUrl = `${serverBase}/api`;
    window.__SERVER_BASE_DEFAULT__ = serverBase;
    window.__API_URL_DEFAULT__ = apiUrl;
})();

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0';
let storedBase = localStorage.getItem('serverBase');

if (!isLocal) {
    if (storedBase) {
        localStorage.removeItem('serverBase');
        storedBase = null;
    }
} else if (storedBase) {
    const port = '6069';
    const expectedLocalPort = `:${port}`;
    if (!storedBase.includes(expectedLocalPort)) {
        localStorage.removeItem('serverBase');
        storedBase = null;
    }
}
const SERVER_BASE = (storedBase || window.__SERVER_BASE_DEFAULT__).replace(/\/+$/,'');
const API_URL = window.__API_URL_DEFAULT__ || `${SERVER_BASE}/api`;

function showNotification(message, type = 'success') {
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
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

async function handleApiError(response, defaultMessage = 'Wystąpił błąd') {
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
}

window.handleLogin = async (e) => {
    // Zatrzymaj domyślne zachowanie formularza natychmiast
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log("Rozpoczynam logowanie..."); // Debug

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!emailInput || !passwordInput) {
        showNotification('Błąd: Nie znaleziono pól formularza.', 'error');
        return false;
    }

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log("Otrzymano odpowiedź z serwera", response.status); // Debug

        if (response.ok) {
            const data = await response.json();
            console.log('Dane logowania:', data); // Debug

            if (!data.token || !data.user) {
                showNotification('Błąd serwera: brak tokena lub danych użytkownika.', 'error');
                return false;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Weryfikacja zapisu
            if (!localStorage.getItem('token')) {
                showNotification('Błąd przeglądarki: localStorage nie działa.', 'error');
                return false;
            }

            showNotification('Zalogowano. Przekierowanie...', 'success');
            
            // Używamy replace aby nie można było cofnąć
            setTimeout(() => {
                console.log('Redirecting to /index.php');
                window.location.replace('/index.php');
            }, 500);
            
            return false; // Ważne dla onsubmit
        } else {
            await handleApiError(response, 'Logowanie nieudane');
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Błąd połączenia: ' + error.message, 'error');
        return false;
    }
};

window.handleRegister = async (e) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log("Rozpoczynam rejestrację...");

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
        showNotification('Hasła nie są identyczne!', 'error');
        return false;
    }
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
            if (response.ok) {
                showNotification('Rejestracja udana! Przekierowanie...', 'success');
                setTimeout(() => {
                    window.location.replace('/login.php');
                }, 2000);
        } else {
            await handleApiError(response, 'Rejestracja nieudana');
        }
        return false;
    } catch (error) {
        console.error('Error:', error);
        showNotification('Błąd rejestracji: ' + error.message, 'error');
        return false;
    }
};
