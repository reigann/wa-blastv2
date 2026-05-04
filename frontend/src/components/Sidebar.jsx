import { NavLink, useLocation } from 'react-router-dom';

const sections = [
  {
    title: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: 'bi-speedometer2' },
      { to: '/contacts', label: 'Contacts', icon: 'bi-people' },
      { to: '/templates', label: 'Templates', icon: 'bi-chat-left-text' },
      { to: '/blast', label: 'Blast', icon: 'bi-send' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { to: '/sessions', label: 'Sessions', icon: 'bi-broadcast' },
      { to: '/logs', label: 'Logs', icon: 'bi-activity' },
    ],
  },
  {
    title: 'Tools',
    items: [{ to: '/clustering', label: 'Clustering', icon: 'bi-diagram-3' }],
  },
];

export default function Sidebar({ mobileOpen, closeMobile, collapsed, setCollapsed, canCollapse, currentUser, onLogoutApp }) {
  const location = useLocation();
  const initials = String(currentUser?.username || 'U')
    .slice(0, 2)
    .toUpperCase();
  

  return (
    <>
      {mobileOpen ? <div className="sidebar-backdrop d-md-none" onClick={closeMobile} /> : null}

      <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">
            <i className="bi bi-whatsapp" />
          </span>
          <div className="logo-label">
            <div className="fw-semibold text-white">WA Blaster UPJ</div>
            <div className="small text-white-50">Broadcast Center</div>
          </div>
        </div>

        <div className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={({ isActive }) => `sidebar-item ${isActive || location.pathname === item.to ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <i className={`bi ${item.icon}`} />
                  <span className="sidebar-label">{item.label}</span>
                  <span className="sidebar-item-tooltip">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {canCollapse ? (
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label="Toggle sidebar collapse"
            >
              <i className={`bi ${collapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`} />
              <span className="sidebar-collapse-label ms-2">{collapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
