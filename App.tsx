import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { EquipmentDetails } from './components/EquipmentDetails';
import { CalibrationForm } from './components/CalibrationForm';
import { ReportView } from './components/ReportView';
import { BudgetManager } from './components/BudgetManager';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ViewState } from './types';
import { AuthService } from './services/auth';
import { Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';

export default function App() {
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  // Start closed on mobile (width check can be added or just default logic)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const unsubscribe = AuthService.subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Render content based on current view state
  const renderContent = () => {
    switch (view.type) {
      case 'DASHBOARD':
        return <Dashboard setView={setView} />;
      case 'EQUIPMENT_DETAILS':
        return <EquipmentDetails equipmentId={view.equipmentId} setView={setView} />;
      case 'NEW_CALIBRATION':
        return <CalibrationForm equipmentId={view.equipmentId} setView={setView} />;
      case 'EDIT_CALIBRATION':
        return <CalibrationForm equipmentId={view.equipmentId} calibrationId={view.calibrationId} setView={setView} />;
      case 'VIEW_REPORT':
        return <ReportView calibrationId={view.calibrationId} setView={setView} />;
      case 'BUDGETS':
        return <BudgetManager setView={setView} />;
      default:
        return <Dashboard setView={setView} />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="font-medium text-sm">Carregando sistema...</p>
      </div>
    );
  }

  if (!user) {
    return isRegistering 
      ? <Register onToggleLogin={() => setIsRegistering(false)} /> 
      : <Login onToggleRegister={() => setIsRegistering(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Hide when printing report */}
      <div className={`print:hidden ${view.type === 'VIEW_REPORT' ? 'hidden md:block' : ''}`}>
        <Sidebar 
          currentView={view} 
          setView={setView} 
          isOpen={sidebarOpen} 
          setIsOpen={setSidebarOpen} 
        />
      </div>

      {/* Main Content Area */}
      <main 
        className={`
          flex-1 transition-all duration-300 relative
          /* Mobile: always ml-0 because sidebar is overlay. Desktop: ml-64 or ml-20 based on state */
          ${sidebarOpen && view.type !== 'VIEW_REPORT' ? 'ml-0 md:ml-64' : 'ml-0 md:ml-20'}
          ${view.type === 'VIEW_REPORT' ? '!ml-0' : ''} /* Remove margin for full print view */
        `}
      >
        {renderContent()}
      </main>
    </div>
  );
}