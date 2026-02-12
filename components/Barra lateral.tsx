import React, { useEffect, useState } from 'react';
import { LayoutDashboard, PenTool, FileText, Settings, Menu, LogOut, User, DollarSign, X } from 'lucide-react';
import { ViewState } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/auth';
import { auth } from '../services/firebase';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ setView, isOpen, setIsOpen }) => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const user = auth.currentUser;

  useEffect(() => {
    const check = async () => {
      const isOnline = await StorageService.checkConnection();
      setConnectionStatus(isOnline ? 'online' : 'offline');
    };
    check();
  }, []);

  const handleLogout = () => {
    AuthService.logout();
  };

  const handleNavClick = (view: ViewState) => {
    setView(view);
    // No celular, fecha o menu automaticamente ao clicar em um item
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`
          fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white transition-all duration-300 shadow-xl
          ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-20'}
          flex flex-col border-r border-slate-800
        `}
      >
        <div className="flex h-16 items-center justify-between px-4 bg-slate-950">
          {isOpen && <h1 className="text-lg font-bold tracking-wider text-blue-500 uppercase">Metrologia AVC</h1>}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="p-2 rounded hover:bg-slate-800 transition-colors"
          >
            {isOpen ? <X size={20} className="md:hidden" /> : <Menu size={20} />}
            <Menu size={20} className="hidden md:block" />
          </button>
        </div>

        <div className={`px-4 py-4 flex items-center gap-3 bg-slate-800/50 border-b border-slate-800 ${!isOpen && 'md:justify-center md:px-2'}`}>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold min-w-[2rem]">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <User size={16} />}
          </div>
          {isOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.displayName || 'Usuário'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-2 px-3">
          <NavItem 
            icon={<LayoutDashboard size={22} />} 
            label="Painel Geral" 
            isOpen={isOpen} 
            onClick={() => handleNavClick({ type: 'DASHBOARD' })}
            active={false}
          />
          <div className={`pt-4 pb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider ${!isOpen && 'md:text-center'}`}>
            {isOpen ? 'Gerenciamento' : '...'}
          </div>
          <NavItem 
            icon={<PenTool size={22} />} 
            label="Equipamentos" 
            isOpen={isOpen} 
            onClick={() => handleNavClick({ type: 'DASHBOARD' })}
          />
          <NavItem 
            icon={<DollarSign size={22} />} 
            label="Orçamentos & Custos" 
            isOpen={isOpen} 
            onClick={() => handleNavClick({ type: 'BUDGETS' })}
          />
        </nav>

        <div className="mt-auto px-3 pb-2">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full p-3 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
            title="Sair do Sistema"
          >
             <LogOut size={22} />
             <span className={`ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 md:hidden'}`}>
               Sair
             </span>
             {/* Tooltip logic for collapsed desktop */}
             {!isOpen && <span className="hidden md:block sr-only">Sair</span>}
          </button>
        </div>

        <div className="p-4 bg-slate-950 text-xs text-slate-500 flex flex-col items-center gap-3">
          {isOpen ? (
            <>
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
                 <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'online' ? 'bg-green-500 animate-pulse' : 
                    connectionStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                 }`}></div>
                 <span className={`font-medium ${
                    connectionStatus === 'online' ? 'text-green-500' : 
                    connectionStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'
                 }`}>
                   {connectionStatus === 'online' ? 'Online' : 
                    connectionStatus === 'offline' ? 'Offline' : '...'}
                 </span>
               </div>
               <p>v1.1.0 &copy; 2024</p>
            </>
          ) : (
            <div title={connectionStatus === 'online' ? 'Online' : 'Offline'}>
               <div className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'online' ? 'bg-green-500' : 
                    connectionStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
               }`}></div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

const NavItem = ({ icon, label, isOpen, onClick, active = false }: any) => (
  <button
    onClick={onClick}
    className={`
      flex items-center w-full p-3 rounded-lg transition-all duration-200 group
      ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
      ${!isOpen ? 'md:justify-center' : ''}
    `}
  >
    <div className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
      {icon}
    </div>
    <span 
      className={`ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 md:hidden'}`}
    >
      {label}
    </span>
    {!isOpen && active && (
      <div className="absolute left-16 bg-blue-600 text-white px-2 py-1 rounded text-xs z-50">
        {label}
      </div>
    )}
  </button>
);
