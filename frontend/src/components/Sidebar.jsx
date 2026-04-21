import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Send, FileText, ScrollText, BarChart3, Layers } from 'lucide-react';

const menu = [
  { path: '/',           label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contacts',   label: 'Contacts',  icon: Users },
  { path: '/clustering', label: 'Clustering', icon: Layers },
  { path: '/blast',      label: 'Blast',     icon: Send },
  { path: '/sessions',   label: 'Sessions',  icon: BarChart3 },
  { path: '/templates',  label: 'Templates', icon: FileText },
  { path: '/logs',       label: 'Logs',      icon: ScrollText }
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 h-screen flex flex-col shrink-0 shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
            📱
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">WA Blaster</h1>
            <p className="text-xs text-slate-400">Bulk Messenger</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menu.map(m => {
          const Icon = m.icon;
          const active = pathname === m.path;
          return (
            <Link 
              key={m.path} 
              to={m.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm
                ${active 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/50' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
            >
              <Icon size={20} />
              <span>{m.label}</span>
              {active && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-300">v1.0.0</p>
          <p className="text-slate-400 text-xs mt-1">Connected & Ready</p>
        </div>
      </div>
    </aside>
  );
}
