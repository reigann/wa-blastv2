import { useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { setAuthToken, setAuthUser } from '../lib/auth';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username || !password) {
      toast.error('Username dan password wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login({ username, password });
      const token = response.data?.token;
      const user = response.data?.user;

      if (!token) {
        toast.error('Token login tidak ditemukan');
        return;
      }

      setAuthToken(token);
      setAuthUser(user || { username });
      toast.success(`Login berhasil sebagai ${user?.username || username}`);
      onLoginSuccess?.(user || { username });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'var(--surface-2)' }}>
      <Card className="surface-card" style={{ width: '100%', maxWidth: 420 }}>
        <Card.Body className="p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="logo-icon mx-auto mb-2" style={{ width: 42, height: 42, fontSize: 22 }}>
              <i className="bi bi-whatsapp" />
            </div>
            <h2 className="mb-1">WA Blaster Login</h2>
            <p className="text-secondary mb-0">Masuk dengan username dan password yang diset di .env</p>
          </div>

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Form.Group>

            <Button type="submit" className="w-100" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
