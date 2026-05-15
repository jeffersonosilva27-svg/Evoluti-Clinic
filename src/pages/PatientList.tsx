import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  ExternalLink, 
  UserPlus,
  Phone,
  Mail,
  Filter
} from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient } from '../types';
import { useAuth } from '../contexts/AuthContext';
import NewPatientModal from '../components/modals/NewPatientModal';
import EditPatientModal from '../components/modals/EditPatientModal';
import { Edit2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function PatientList({ onSelect }: { onSelect: (id: string) => void }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // Fetch Clinics for names mapping
    const fetchClinics = async () => {
      const snap = await getDocs(collection(db, 'clinics'));
      const mapping: Record<string, string> = {};
      snap.docs.forEach(doc => mapping[doc.id] = doc.data().name);
      setClinics(mapping);
    };
    fetchClinics();

    let q = query(collection(db, 'patients'));
    
    if (profile.role !== 'ADM_SISTEMA') {
      if (profile.clinics && profile.clinics.length > 0) {
        q = query(q, where('clinicId', 'in', profile.clinics));
      } else {
        setPatients([]);
        return;
      }
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(docs);
    }, (err) => {
      console.error("Error fetching patients:", err);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pacientes</h2>
          <p className="text-slate-400 text-sm font-medium mt-1">Gestão centralizada de prontuários clínicos.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20"
        >
          <UserPlus className="w-4 h-4" />
          Novo Paciente
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/30 border-b border-slate-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300 shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-5 py-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all text-xs font-black uppercase tracking-widest shadow-sm">
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <th className="px-8 py-5 border-r border-slate-100">Identificação do Paciente</th>
                <th className="px-8 py-5 border-r border-slate-100">Serviço / Valor</th>
                <th className="px-8 py-5 border-r border-slate-100">Unidade</th>
                <th className="px-8 py-5 border-r border-slate-100">Status Clínico</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => onSelect(patient.id)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-black group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-800 leading-tight group-hover:text-brand-primary transition-colors">{patient.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">REF: {patient.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-tighter">
                        {patient.serviceTypes && patient.serviceTypes.length > 0 ? patient.serviceTypes.join(', ') : (patient.serviceType || 'Não definido')}
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                        R$ {patient.serviceValue?.toFixed(2) || '0,00'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full border border-indigo-100 uppercase tracking-widest">
                      {clinics[patient.clinicId] || 'Carregando...'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-700">Em acompanhamento</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit ${
                        patient.sessionCountSinceAssessment > 10 || (!patient.lastAssessmentAt) || (patient.lastAssessmentAt && differenceInDays(new Date(), patient.lastAssessmentAt.toDate()) > 30)
                        ? 'text-amber-600 bg-amber-50' : 'text-brand-primary bg-blue-50'
                      }`}>
                        {(patient.sessionCountSinceAssessment > 10 || (!patient.lastAssessmentAt) || (patient.lastAssessmentAt && differenceInDays(new Date(), patient.lastAssessmentAt.toDate()) > 30)) ? 'Reavaliar' : 'Ativo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {profile?.role !== 'PROFISSIONAL' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatient(patient);
                            setShowEditModal(true);
                          }}
                          className="p-2.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all text-slate-400 hover:text-indigo-600 shadow-sm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => onSelect(patient.id)}
                        className="p-2.5 bg-slate-50 hover:bg-white border border-slate-100 rounded-xl transition-all text-slate-400 hover:text-brand-primary shadow-sm group-hover:border-brand-primary/20"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPatients.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-400 font-medium italic">Nenhum paciente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <NewPatientModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
      {selectedPatient && (
        <EditPatientModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
        />
      )}
    </div>
  );
}
