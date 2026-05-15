import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Agenda from './components/Agenda';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import AssessmentLibrary from './pages/AssessmentLibrary';
import Finance from './pages/Finance';
import Management from './pages/Management';
import SeedData from './components/SeedData';
import NewAppointmentModal from './components/modals/NewAppointmentModal';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './firebase/config';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { Clinic } from './types';

function AppContent() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);

  useEffect(() => {
    const fetchClinics = async () => {
      if (!profile) return;
      try {
        let q;
        if (profile.role === 'ADM_SISTEMA') {
          q = collection(db, 'clinics');
        } else if (profile.clinics && profile.clinics.length > 0) {
          q = query(collection(db, 'clinics'), where(documentId(), 'in', profile.clinics.slice(0, 30)));
        } else {
          setClinics([]);
          return;
        }
        
        const snap = await getDocs(q);
        const fetchedClinics = snap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
        setClinics(fetchedClinics);
      } catch (err) {
        console.error("Error fetching clinics:", err);
      }
    };
    if (user && profile) fetchClinics();
  }, [user, profile]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Carregando ClinicaSync...</p>
        </div>
      </div>
    );
  }

  if (!user || (user && !profile)) return <LoginPage />;
  
  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mb-6 text-amber-600 shadow-xl shadow-amber-100">
           <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Acesso Pendente</h1>
        <p className="text-slate-500 font-medium max-w-sm mb-8 leading-relaxed">
          Seu cadastro foi recebido com sucesso e está aguardando liberação por um Administrador ou Gestor.
        </p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95">
            Atualizar Status
          </button>
          <button onClick={logout} className="h-12 px-6 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'agenda':
        return <Agenda selectedClinic={selectedClinic} />;
      case 'patients':
        if (selectedPatientId) {
          return <PatientDetail patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} />;
        }
        return <PatientList onSelect={(id) => setSelectedPatientId(id)} />;
      case 'assessments':
        return <AssessmentLibrary />;
      case 'finance':
        return <Finance />;
      case 'management':
        return <Management activeSubTab="units" />;
      case 'team':
        return <Management activeSubTab="team" />;
      default:
        return (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-xl font-bold italic mb-2 uppercase tracking-tighter text-slate-300">EM CONSTRUÇÃO</p>
            <p className="font-medium text-sm">O módulo de {activeTab} estará disponível em breve no MVP.</p>
          </div>
        );
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      selectedClinic={selectedClinic} 
      setSelectedClinic={setSelectedClinic}
      clinics={clinics}
      onNewAppointment={() => setShowNewAppointmentModal(true)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <SeedData />
      <NewAppointmentModal 
        isOpen={showNewAppointmentModal} 
        onClose={() => setShowNewAppointmentModal(false)} 
      />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
