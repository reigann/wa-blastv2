import { useEffect, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
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
    <div className="min-vh-100 d-flex" style={{ background: '#f0f2f5' }}>
      {/* Left Panel - Branding */}
      <div className="d-none d-lg-flex flex-column justify-content-center align-items-center w-50 p-5 text-white" style={{ background: 'linear-gradient(135deg, #075e54 0%, #128c7e 40%, #25d366 100%)' }}>
        <div className="mb-4">
          <img src="/whatsapp-logo.svg" alt="WhatsApp" width={96} height={96} />
        </div>
        <h1 className="fw-bold mb-2" style={{ fontSize: 36 }}>WA Blaster UPJ</h1>
        <p className="text-center mb-4" style={{ fontSize: 16, opacity: 0.85, maxWidth: 380 }}>
          WhatsApp Broadcast Center — Kirim pesan massal, analisis clustering, dan optimasi kampanye dalam satu platform.
        </p>
        <div className="d-flex gap-4 mt-3">
          <div className="text-center">
            <div className="fw-bold" style={{ fontSize: 28 }}>300+</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Kontak</div>
          </div>
          <div className="text-center">
            <div className="fw-bold" style={{ fontSize: 28 }}>3</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Cluster</div>
          </div>
          <div className="text-center">
            <div className="fw-bold" style={{ fontSize: 28 }}>8</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Template</div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="d-flex flex-column justify-content-center align-items-center w-100 w-lg-50 p-4" style={{ background: '#f0f2f5' }}>
        <div className="bg-white rounded-4 shadow-sm p-5" style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <div className="text-center d-lg-none mb-4">
            <img src="/whatsapp-logo.svg" alt="WhatsApp" width={64} height={64} />
          </div>

          <div className="text-center mb-4">
            <img src="/whatsapp-logo.svg" alt="WhatsApp" width={48} height={48} className="d-none d-lg-inline mb-3" />
            <h3 className="fw-bold mb-1" style={{ color: '#075e54' }}>Masuk</h3>
            <p className="text-secondary mb-0" style={{ fontSize: 14 }}>Gunakan akun Google untuk mengakses dashboard</p>
          </div>

          <Button
            className="w-100 py-2 border-0 fw-semibold d-flex align-items-center justify-content-center gap-2"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ background: '#075e54', borderRadius: 10 }}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" variant="light" />
                <span style={{ color: '#fff' }}>Signing in...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity="0.6"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.4"/></svg>
                <span style={{ color: '#fff' }}>Sign in with Google</span>
              </>
            )}
          </Button>

          <div className="d-flex align-items-center gap-2 mt-4 p-3 rounded-3" style={{ background: '#f0faf4' }}>
            <i className="bi bi-shield-check text-success"></i>
            <p className="small text-secondary mb-0">
              <strong>Hanya email terdaftar</strong> di allowlist yang dapat mengakses dashboard ini.
            </p>
          </div>

          <div className="text-center mt-4">
            <p className="small text-secondary mb-0" style={{ fontSize: 12 }}>
              &copy; {new Date().getFullYear()} WA Blaster UPJ — Broadcast Center
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
