import { Badge } from 'react-bootstrap';

const variants = {
  active: { bg: '#e8fff0', color: '#128c7e', text: 'Active' },
  idle: { bg: '#edf2f7', color: '#475569', text: 'Idle' },
  error: { bg: '#fff1f2', color: '#b91c1c', text: 'Error' },
  running: { bg: '#ecfdf3', color: '#0f766e', text: 'Running' },
  completed: { bg: '#ecfdf3', color: '#166534', text: 'Completed' },
  cancelled: { bg: '#f1f5f9', color: '#475569', text: 'Cancelled' },
  failed: { bg: '#fff1f2', color: '#b91c1c', text: 'Failed' },
  delivered: { bg: '#ecfdf3', color: '#166534', text: 'Delivered' },
  read: { bg: '#e0f2fe', color: '#0c4a6e', text: 'Read' },
  sent: { bg: '#ecfdf3', color: '#166534', text: 'Sent' },
  info: { bg: '#eff6ff', color: '#1d4ed8', text: 'Info' },
  warn: { bg: '#fff7ed', color: '#b45309', text: 'Warn' },
  success: { bg: '#ecfdf3', color: '#166534', text: 'Success' },
  inactive: { bg: '#fff1f2', color: '#b91c1c', text: 'Inactive' },
};

export default function StatusBadge({ status = 'info', text }) {
  const key = String(status || 'info').toLowerCase();
  const style = variants[key] || variants.info;

  return (
    <Badge style={{ background: style.bg, color: style.color }}>
      {text || style.text}
    </Badge>
  );
}
