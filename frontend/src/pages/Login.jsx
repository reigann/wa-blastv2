import { useEffect, useState } from 'react';
import { Button, Card, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import axios from 'axios';
import { setAuthToken, setAuthUser } from '../lib/auth';
import { getGoogleRedirectSignInResult, signInWithGoogleFirebase } from '../lib/firebaseAuth';
import { BACKEND_URL } from '../lib/config';

export default function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function bootstrapRedirectLogin() {
      setLoading(true);
      try {
        const redirectResult = await getGoogleRedirectSignInResult();
        if (!redirectResult?.idToken) return;
        const response = await axios.post(`${BACKEND_URL}/api/auth/firebase`, { idToken: redirectResult.idToken });
        const { token, user } = response.data;
        setAuthToken(token);
        setAuthUser(user);
        if (!mounted) return;
        toast.success(`Login berhasil sebagai ${user?.name || user?.email}`);
        onLoginSuccess?.(user);
      } catch (err) {
        const msg = err?.response?.data?.error || err.message || 'Login failed';
        if (mounted) {
          toast.error(`Login gagal: ${msg}`);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    bootstrapRedirectLogin();
    return () => {
      mounted = false;
    };
  }, [onLoginSuccess]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { idToken, pendingRedirect } = await signInWithGoogleFirebase();
      if (pendingRedirect) return;
      const response = await axios.post(`${BACKEND_URL}/api/auth/firebase`, { idToken });
      const { token, user } = response.data;

      setAuthToken(token);
      setAuthUser(user);
      toast.success(`Login berhasil sebagai ${user?.name || user?.email}`);
      onLoginSuccess?.(user);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Login failed';
      toast.error(`Login gagal: ${msg}`);
      console.error('Firebase login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'var(--surface-2)' }}>
      <Card className="surface-card" style={{ width: '100%', maxWidth: 420 }}>
        <Card.Body className="p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="logo-icon mx-auto mb-2" style={{ width: 42, height: 42, fontSize: 22 }}>
              <img src="/logo_blaster.png" alt="WA Blaster" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            </div>
            <h2 className="mb-1">WA Blaster</h2>
            <p className="text-secondary mb-0">Login Google via Firebase</p>
          </div>

          <Button className="w-100" variant="outline-primary" onClick={handleGoogleLogin} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" className="me-2" animation="border" />
                Signing in...
              </>
            ) : (
              <>
                <i className="bi bi-google me-2" />
                Sign in with Google
              </>
            )}
          </Button>

          <div className="mt-4 p-3 bg-light rounded">
            <p className="small text-muted mb-0">
              <strong>Hanya email yang terdaftar</strong> di allowlist Firebase yang dapat login.
            </p>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
