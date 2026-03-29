document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const logoutBtn = document.getElementById('logout-btn');

    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');

    // 🔐 LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const { token, name } = await api.login(email, password);

                localStorage.setItem('token', token);
                localStorage.setItem('userName', name);

                window.location.href = '/pages/index.html';

            } catch (error) {
                loginError.textContent = error.message;
            }
        });
    }

    // 📝 SIGNUP
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            try {
                const { token, name: userName } = await api.signup(name, email, password);

                localStorage.setItem('token', token);
                localStorage.setItem('userName', userName);

                window.location.href = '/pages/index.html';

            } catch (error) {
                signupError.textContent = error.message;
            }
        });
    }

    // 🚪 LOGOUT
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userName');

            window.location.href = '/pages/login.html';
        });
    }

});