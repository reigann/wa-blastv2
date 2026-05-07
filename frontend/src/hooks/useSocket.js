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

    socketRef.current = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('wa:status', (status) => {
      setWaStatus(status);
      if (status === 'connected') setQrCode(null);
      if (status !== 'connected') setWaPhone(null);
    });

    socketRef.current.on('wa:qr', (qr) => {
      setQrCode(qr);
      setWaStatus('qr');
    });

    socketRef.current.on('wa:ready', (data) => {
      // data can include phone
      if (data && data.phone) setWaPhone(data.phone);
      setWaStatus('connected');
      setQrCode(null);
    });

    socketRef.current.on('blast:started', (data) => {
      setBlastStatus('started');
      setBlastProgress({ current: 0, total: data.total, sent: 0, failed: 0 });
    });

    socketRef.current.on('blast:progress', (data) => {
      setBlastProgress(data);
    });

    socketRef.current.on('blast:completed', (data) => {
      setBlastStatus('completed');
      setBlastProgress(prev => ({ ...prev, ...data }));
    });

    socketRef.current.on('blast:cancelled', () => {
      setBlastStatus('cancelled');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return { waStatus, qrCode, waPhone, blastProgress, blastStatus, setBlastStatus };
}
