import { useNavigate } from 'react-router-dom';
import { Container, Navbar, Button } from 'react-bootstrap';
import { List, LogOut } from 'lucide-react';

export default function NavbarComponent({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Try to disconnect WhatsApp session and invalidate app token
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
      await fetch('/api/auth/logout-app-token', { method: 'POST' }).catch(() => {});
    } catch (err) {
      // ignore errors
    }
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <Navbar bg="light" sticky="top" className="shadow-sm border-bottom border-3">
      <Container fluid>
        <Navbar.Brand href="/" className="fw-bold fs-5">
          <i className="bi bi-chat-dots-fill text-success me-2"></i>
          WhatsApp Blaster UPJ
        </Navbar.Brand>

        <div className="ms-auto d-flex align-items-center gap-3">
          {/* Toggle Sidebar Button (Mobile) */}
          <Button
            variant="outline-primary"
            size="sm"
            className="d-lg-none"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <List size={20} />
          </Button>

          {/* Logout Button */}
          <Button
            variant="outline-danger"
            size="sm"
            onClick={handleLogout}
            className="d-flex align-items-center gap-2"
          >
            <LogOut size={16} />
            <span className="d-none d-md-inline">Logout</span>
          </Button>
        </div>
      </Container>
    </Navbar>
  );
}
