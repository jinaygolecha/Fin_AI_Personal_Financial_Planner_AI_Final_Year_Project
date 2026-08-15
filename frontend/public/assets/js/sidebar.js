/**
 * Jinay Finance AI — Shared Sidebar Component
 * Owner: Jinay Golecha (jinay_golecha)
 * Inject this into every app page.
 */

export function renderSidebar(activePage = '') {
  const nav = [
    { section: 'Main', items: [
      { href: 'dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
      { href: 'transactions', icon: 'ri-exchange-line', label: 'Transactions' },
      { href: 'budget', icon: 'ri-pie-chart-line', label: 'Budgets' },
      { href: 'goals', icon: 'ri-flag-line', label: 'Goals' },
    ]},
    { section: 'Invest', items: [
      { href: 'investments', icon: 'ri-stock-line', label: 'Portfolio & Metals' },
      { href: 'loans', icon: 'ri-bank-line', label: 'Loans & EMI' },
      { href: 'insurance', icon: 'ri-shield-check-line', label: 'Insurance & Subs' },
    ]},
    { section: 'Tools', items: [
      { href: 'calendar', icon: 'ri-calendar-line', label: 'Calendar' },
      { href: 'analytics', icon: 'ri-bar-chart-line', label: 'Analytics' },
      { href: 'ai-advisor', icon: 'ri-robot-line', label: 'AI Advisor' },
    ]},
  ];

  const navHTML = nav.map(sec => `
    <div class="nav-section">
      <div class="nav-label">${sec.section}</div>
      ${sec.items.map(item => `
        <a href="/${item.href}.html" class="nav-item${activePage === item.href ? ' active' : ''}">
          <i class="${item.icon}"></i>${item.label}
        </a>
      `).join('')}
    </div>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon"><i class="ri-line-chart-line"></i></div>
        <div>
          <div class="brand-text">Jinay Finance AI</div>
          <div class="brand-sub">by Jinay Golecha</div>
        </div>
      </div>
      ${navHTML}
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar" id="sidebarAvatar">J</div>
          <div>
            <div class="user-name" id="sidebarUserName">Loading...</div>
            <div class="user-role" id="sidebarUserRole">User</div>
          </div>
          <i class="ri-logout-box-line logout-btn" id="sidebarLogout" title="Logout"></i>
        </div>
      </div>
    </aside>
  `;
}

export function initSidebarUser() {
  const user = JSON.parse(localStorage.getItem('jf_user') || '{}');
  const name = (user.firstName || user.username || 'User');
  const fullName = name + (user.lastName ? ' ' + user.lastName : '');
  
  const el = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');
  
  if (el) el.textContent = fullName;
  if (roleEl) roleEl.textContent = user.isPremium ? '⭐ Premium' : 'Free User';
  if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
  
  const logoutBtn = document.getElementById('sidebarLogout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      const rt = localStorage.getItem('jf_refresh_token');
      const at = localStorage.getItem('jf_access_token');
      try {
        await fetch('http://127.0.0.1:5000/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {}
      localStorage.clear();
      window.location.href = '/login.html';
    };
  }
}
