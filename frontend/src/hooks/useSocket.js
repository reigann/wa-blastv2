import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken } from '../lib/auth';
import { BACKEND_URL } from '../lib/config';

export function useSocket() {
  const socketRef = useRef(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [waPhone, setWaPhone] = useState(null);
  const [blastProgress, setBlastProgress] = useState(null);
  const [blastStatus, setBlastStatus] = useState(null); // started | completed | cancelled

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;

    let cancelled = false;
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
    socketRef.current = socket;

    // Delay connect slightly to avoid React StrictMode dev mount/unmount race noise.
    const connectTimer = setTimeout(() => {
      if (!cancelled) socket.connect();
    }, 0);

    socket.on('wa:status', (status) => {
      setWaStatus(status);
      if (status === 'connected') setQrCode(null);
      if (status !== 'connected') setWaPhone(null);
    });

    socket.on('wa:qr', (qr) => {
      setQrCode(qr);
      setWaStatus('qr');
    });

    socket.on('wa:ready', (data) => {
      // data can include phone
      if (data && data.phone) setWaPhone(data.phone);
      setWaStatus('connected');
      setQrCode(null);
    });

    socket.on('blast:started', (data) => {
      setBlastStatus('started');
      setBlastProgress({ current: 0, total: data.total, sent: 0, failed: 0 });
    });

    socket.on('blast:progress', (data) => {
      setBlastProgress(data);
    });

    socket.on('blast:completed', (data) => {
      setBlastStatus('completed');
      setBlastProgress(prev => ({ ...prev, ...data }));
    });

    socket.on('blast:cancelled', () => {
      setBlastStatus('cancelled');
    });

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      socket.removeAllListeners();
      if (socket.connected) socket.disconnect();
    };
  }, []);

  return { waStatus, qrCode, waPhone, blastProgress, blastStatus, setBlastStatus };
}
