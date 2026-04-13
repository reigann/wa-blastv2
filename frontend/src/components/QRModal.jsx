export function QRModal({ qrCode, status }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
        <h2 className="text-xl font-bold mb-2">Connect WhatsApp</h2>

        {status === 'qr' && qrCode ? (
          <>
            <p className="text-gray-500 text-sm mb-4">
              Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
            </p>
            <img src={qrCode} alt="QR Code" className="w-56 h-56 mx-auto border rounded-xl" />
            <p className="text-xs text-gray-400 mt-3">QR refreshes automatically</p>
          </>
        ) : status === 'connecting' ? (
          <div className="py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
            <p className="text-gray-500">Connecting to WhatsApp...</p>
          </div>
        ) : (
          <div className="py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Initializing...</p>
          </div>
        )}
      </div>
    </div>
  );
}
