import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Blast from './pages/Blast';
import Templates from './pages/Templates';
import Logs from './pages/Logs';
import Sessions from './pages/Sessions';
import Clustering from './pages/Clustering';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#1f2937',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500'
          }
        }}
      />
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/blast" element={<Blast />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/clustering" element={<Clustering />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
