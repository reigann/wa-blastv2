import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [blastProgress, setBlastProgress] = useState(null);
  const [blastStatus, setBlastStatus] = useState(null); // started | completed | cancelled

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('wa:status', (status) => {
      setWaStatus(status);
      if (status === 'connected') setQrCode(null);
    });

    socketRef.current.on('wa:qr', (qr) => {
      setQrCode(qr);
      setWaStatus('qr');
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
      socketRef.current.disconnect();
    };
  }, []);

  return { waStatus, qrCode, blastProgress, blastStatus, setBlastStatus };
}
