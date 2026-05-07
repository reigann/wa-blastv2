import { useState } from 'react';
import { Badge, Breadcrumb, Dropdown, Form, InputGroup } from 'react-bootstrap';

function getLevelClass(level = 'info') {
  const key = String(level).toLowerCase();
  if (key === 'success') return 'success';
  if (key === 'warn' || key === 'warning') return 'warning';
  if (key === 'error' || key === 'danger') return 'danger';
  return 'primary';
}

const featureMeta = {
  auth: { label: 'Authentication', icon: 'bi-shield-check' },
  contacts: { label: 'Contacts', icon: 'bi-people' },
  templates: { label: 'Templates', icon: 'bi-file-earmark-text' },
  blast: { label: 'Blast Campaign', icon: 'bi-send' },
  clustering: { label: 'Clustering', icon: 'bi-diagram-3' },
  bandit: { label: 'Bandit Analytics', icon: 'bi-graph-up' },
  banditOptimization: { label: 'Bandit Optimization', icon: 'bi-gear' },
};

function StatusDot({ enabled }) {
  return (
    <span
      className="d-inline-block rounded-circle me-2"
      style={{
        width: 8,
        height: 8,
        background: enabled ? '#22c55e' : '#94a3b8',
        boxShadow: enabled ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
      }}
    />
  );
}

export default function Topbar({
  title,
  onMobileToggle,
  isMobile,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onClearNotifications,
  onToggleNotificationRead,
  onRemoveNotification,
  currentUser,
  onLogoutApp,
  waPhone,
  healthStatus,
}) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const initials = String(currentUser?.name || currentUser?.email || 'U').slice(0, 2).toUpperCase();

  const formatPhone = (p) => {
    if (!p) return '';
    try {
      const s = String(p).trim();
      return s.startsWith('+') ? s : `+${s}`;
    } catch (e) {
      return String(p);
    }
  };

  const storageName = String(healthStatus?.storage || 'unknown').toUpperCase();
  const features = healthStatus?.features || {};

  return (
    <header className="app-topbar">
      <div className="d-flex align-items-center gap-3 w-100">
        <div className="d-flex align-items-center gap-2 flex-grow-1">
          {isMobile ? (
            <button className="topbar-icon-btn" onClick={onMobileToggle} aria-label="Open navigation menu">
              <i className="bi bi-list" />
            </button>
          ) : null}

          <div>
            <Breadcrumb className="mb-0 small">
              <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
              <Breadcrumb.Item active>{title}</Breadcrumb.Item>
            </Breadcrumb>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Dropdown align="end">
            <Dropdown.Toggle
              as="button"
              className="btn btn-sm d-flex align-items-center gap-2 px-2 py-1 border bg-transparent"
              style={{ fontSize: '0.75rem' }}
            >
              <span
                className="d-inline-block rounded-circle"
                style={{
                  width: 8,
                  height: 8,
                  background: healthStatus?.ok ? '#22c55e' : '#ef4444',
                  boxShadow: healthStatus?.ok ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
                }}
              />
              <span className="d-none d-lg-inline fw-semibold">{storageName}</span>
              <i className="bi bi-chevron-down small" />
            </Dropdown.Toggle>
            <Dropdown.Menu className="p-0" style={{ minWidth: 240 }}>
              <div className="px-3 py-2 border-bottom bg-light">
                <div className="fw-semibold small">System Status</div>
                <div className="text-secondary small">Storage: {storageName}</div>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {Object.entries(features).map(([key, enabled]) => {
                  const meta = featureMeta[key] || { label: key, icon: 'bi-circle' };
                  return (
                    <div key={key} className="px-3 py-2 d-flex align-items-center justify-content-between border-bottom">
                      <div className="d-flex align-items-center small">
                        <StatusDot enabled={enabled} />
                        <i className={`${meta.icon} me-2 text-secondary`} />
                        <span>{meta.label}</span>
                      </div>
                      <Badge bg={enabled ? 'success' : 'secondary'} className="small" pill>
                        {enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <div className="px-3 py-2 bg-light text-center">
                <small className="text-secondary">
                  {healthStatus?.ok ? 'All systems operational' : 'Some services may be degraded'}
                </small>
              </div>
            </Dropdown.Menu>
          </Dropdown>

          <InputGroup className={`topbar-search ${searchExpanded ? 'expanded' : ''}`}>
            <InputGroup.Text className="bg-white border-end-0">
              <i className="bi bi-search" />
            </InputGroup.Text>
            <Form.Control
              type="search"
              placeholder="Search"
              className="border-start-0"
              onFocus={() => setSearchExpanded(true)}
              onBlur={() => setSearchExpanded(false)}
            />
          </InputGroup>

          <Dropdown align="end" autoClose="outside">
            <Dropdown.Toggle
              as="button"
              className="topbar-icon-btn position-relative border"
              aria-label="Notifications"
            >
              <i className="bi bi-bell" />
              {unreadCount > 0 ? (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </Dropdown.Toggle>
            <Dropdown.Menu className="p-0 overflow-hidden" style={{ width: 360, maxWidth: '95vw' }}>
              <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
                <div className="fw-semibold">Notifications</div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-link text-decoration-none p-0"
                    onClick={onMarkAllRead}
                    aria-label="Mark all notifications as read"
                  >
                    Mark all read
                  </button>
                  <button
                    className="btn btn-sm btn-link text-decoration-none p-0 text-danger"
                    onClick={onClearNotifications}
                    aria-label="Clear all notifications"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="px-3 py-4 text-center text-secondary small">No notifications yet</div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-3 py-2 border-bottom ${notification.read ? 'bg-white' : 'bg-light-subtle'}`}
                    >
                      <div className="d-flex align-items-start gap-2">
                        <span
                          className={`badge rounded-circle bg-${getLevelClass(notification.level)}`}
                          style={{ width: 10, height: 10, marginTop: 6, padding: 0 }}
                        />
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="fw-medium small">{notification.title}</span>
                            <span className="text-secondary small">
                              {new Date(notification.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="small text-secondary">{notification.message}</div>
                          <div className="d-flex gap-2 mt-1">
                            <button
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              onClick={() => onToggleNotificationRead(notification.id)}
                              aria-label="Toggle read status"
                            >
                              {notification.read ? 'Mark unread' : 'Mark read'}
                            </button>
                            <button
                              className="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                              onClick={() => onRemoveNotification(notification.id)}
                              aria-label="Dismiss notification"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown align="end">
            <Dropdown.Toggle variant="light" className="border d-flex align-items-center gap-2">
                <span className="avatar-circle" style={{ width: 28, height: 28, background: '#243b55', fontSize: 12 }}>{initials}</span>
                <div className="d-none d-md-flex flex-column align-items-start">
                  <span>{currentUser?.name || currentUser?.email || 'User'}</span>
                  <small className="text-secondary">{waPhone ? formatPhone(waPhone) : 'No WA connected'}</small>
                </div>
              </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item href="#">Profile</Dropdown.Item>
              <Dropdown.Item href="#">Preferences</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={onLogoutApp}>Logout</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
