import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Users, 
  BarChart2, 
  Briefcase, 
  LogOut, 
  Menu, 
  X,
  PlusCircle,
  ClipboardList,
  Building2,
  DollarSign,
  UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Clinic } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedClinic: string | null;
  setSelectedClinic: (id: string | null) => void;
  onNewAppointment: () => void;
  clinics: Clinic[];
}

export default function Layout({ 
  children, 
  activeTab, 
  setActiveTab, 
  selectedClinic, 
  setSelectedClinic,
  onNewAppointment,
  clinics
}: LayoutProps) {
  const { profile, logout, testRole, setTestRole } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR', 'PROFISSIONAL', 'RECEPCIONISTA'] },
    { id: 'agenda', label: 'Agenda', icon: Calendar, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR', 'PROFISSIONAL', 'RECEPCIONISTA'] },
    { id: 'patients', label: 'Pacientes', icon: Users, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR', 'PROFISSIONAL', 'RECEPCIONISTA'] },
    { id: 'assessments', label: 'Avaliações', icon: ClipboardList, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR', 'PROFISSIONAL'] },
    { id: 'finance', label: 'Financeiro', icon: DollarSign, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR'] },
    { id: 'management', label: 'Gestão/Unidades', icon: Building2, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR'] },
    { id: 'team', label: 'Equipe', icon: UserCog, roles: ['ADM_SISTEMA', 'SUPER_GESTOR', 'GESTOR'] },
  ];

  const filteredMenu = menuItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-bg-main overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -240 }}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            className="hidden lg:flex w-60 bg-sidebar-bg text-white flex-col z-20 shadow-xl print:hidden"
          >
            <div className="p-8 flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white font-black text-lg">
                EC
              </div>
              <h1 className="font-extrabold text-xl tracking-tight">Evoluti Clinic</h1>
            </div>

            <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-all duration-200 border-l-4 ${
                    activeTab === item.id 
                    ? 'bg-brand-secondary/10 border-brand-secondary text-brand-secondary font-semibold' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="p-6 mt-auto">
              <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-4">
                ACESSO {['ADM_SISTEMA', 'SUPER_GESTOR'].includes(profile?.role || '') ? 'ADM SISTEMA' : profile?.role.replace('_', ' ')}
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-sm font-bold uppercase border border-white/10">
                  {profile?.name.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{profile?.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">ID: {profile?.uid.substring(0, 5)}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-white/5 hover:text-white rounded-lg transition-all text-sm font-medium border border-white/5 hover:border-white/10 shadow-inner"
              >
                <LogOut className="w-4 h-4" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 lg:pb-0">
        <header className="h-[64px] lg:h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-2 lg:gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:block p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-6 h-6 bg-brand-primary rounded flex items-center justify-center text-white font-black text-xs">
                EC
              </div>
              <span className="font-extrabold text-sm tracking-tight text-slate-800 italic">Evoluti Clinic</span>
            </div>

            {profile?.email === 'jefferson.osilva27@gmail.com' && (
              <select
                value={testRole || ''}
                onChange={(e) => setTestRole((e.target.value as any) || null)}
                className="text-[10px] lg:text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 outline-none cursor-pointer hidden md:block w-32 md:w-auto"
                title="Simulador de Perfil"
              >
                <option value="">Simular (Desativado)</option>
                <option value="GESTOR">Ver como Gestor</option>
                <option value="PROFISSIONAL">Ver como Profissional</option>
                <option value="RECEPCIONISTA">Ver como Recepção</option>
              </select>
            )}

            {clinics.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 lg:px-3 py-1 rounded-lg border border-slate-100">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={selectedClinic || ''} 
                  onChange={(e) => setSelectedClinic(e.target.value || null)}
                  className="text-[10px] lg:text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 outline-none cursor-pointer"
                >
                  <option value="">Todas as Unidades</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {profile?.role !== 'PROFISSIONAL' && (
              <button 
                onClick={onNewAppointment}
                className="flex items-center gap-2 px-3 lg:px-5 py-1.5 lg:py-2.5 bg-brand-primary text-white rounded-lg text-[10px] lg:text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20"
              >
                <PlusCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span className="hidden lg:inline">Novo Agendamento</span>
                <span className="inline lg:hidden">Novo</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-slate-200 px-2 flex items-center overflow-x-auto z-30 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] custom-scrollbar print:hidden">
        {filteredMenu.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 min-w-[64px] flex-1 py-2 rounded-xl transition-all ${
              activeTab === item.id 
              ? 'text-brand-secondary' 
              : 'text-slate-400'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[3px] scale-110' : 'stroke-[2px]'}`} />
            <span className={`text-[9px] font-black uppercase tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
              {item.label.split(' ')[0]}
            </span>
          </button>
        ))}
        <button 
          onClick={logout}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-1 min-w-[64px] flex-1 py-2 text-slate-400"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">Sair</span>
        </button>
      </nav>
    </div>
  );
}
