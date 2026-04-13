export function StatusBadge({ status }) {
  const config = {
    connected:    { 
      label: 'Connected', 
      class: 'bg-green-100 text-green-700 border border-green-300',
      dot: 'bg-green-500'
    },
    qr:           { 
      label: 'Scan QR', 
      class: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
      dot: 'bg-yellow-500 animate-pulse'
    },
    connecting:   { 
      label: 'Connecting', 
      class: 'bg-blue-100 text-blue-700 border border-blue-300',
      dot: 'bg-blue-500 animate-pulse'
    },
    disconnected: { 
      label: 'Disconnected', 
      class: 'bg-red-100 text-red-700 border border-red-300',
      dot: 'bg-red-500'
    }
  };
  const c = config[status] || config.disconnected;
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${c.class} shadow-sm`}>
      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}
