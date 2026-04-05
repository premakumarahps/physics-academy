/* ═══════════════════════════════════════════
   auth.js — Authentication Utilities
   ═══════════════════════════════════════════ */

const Auth = {
    SESSION_KEY: 'active_session',

    // Login as admin or student
    async login(username, password) {
        const result = await DB.verifyCreds(username, password);

        if (result.success) {
            const session = {
                role: result.role,
                username: result.username,
                studentId: result.studentId,
                name: result.name,
                studentType: result.studentType || 'guest',
                token: result.token
            };
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            return { success: true, role: result.role, studentId: result.studentId };
        }

        return { success: false, error: result.error || 'Invalid username or password' };
    },

    async logout() {
        try {
            const session = this.getSession();
            if (session && session.token) {
                // Notify server to clear the token
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.token}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(() => {});  // Ignore errors and logout anyway
            }
        } catch (e) {
            console.error('Logout request failed', e);
        }
        sessionStorage.removeItem(this.SESSION_KEY);
        window.location.href = 'index.html';
    },

    getSession() {
        try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); }
        catch { return null; }
    },

    isLoggedIn() {
        return !!this.getSession();
    },

    isAdmin() {
        const s = this.getSession();
        return s && s.role === 'admin';
    },

    isStudent() {
        const s = this.getSession();
        return s && s.role === 'student';
    },

    // Redirect if not authenticated
    requireAdmin() {
        if (!this.isAdmin()) { window.location.href = 'index.html'; return false; }
        return true;
    },

    requireStudent() {
        if (!this.isStudent()) { window.location.href = 'index.html'; return false; }
        return true;
    }
};
