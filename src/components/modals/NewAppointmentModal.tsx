import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Patient, UserProfile, Clinic } from '../../types';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewAppointmentModal({ isOpen, onClose }: NewAppointmentModalProps) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<UserProfile[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleType, setScheduleType] = useState<'individual' | 'programa'>('individual');
  const [formData, setFormData] = useState({
    patientId: '',
    professionalId: '',
    clinicId: '',
    date: '',
    time: '08:00',
    type: 'Consulta',
    room: '',
    // fields for program
    totalSessions: 10,
    daysOfWeek: [] as number[],
    startDate: ''
  });

  useEffect(() => {
    if (!isOpen || !profile) return;

    const fetchData = async () => {
      // Fetch Clinics
      const cq = query(collection(db, 'clinics'));
      const cSnap = await getDocs(cq);
      const allClinics = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
      const filteredClinics = allClinics.filter(c => profile.role === 'ADM_SISTEMA' || profile.clinics.includes(c.id));
      setClinics(filteredClinics);

      // Fetch Patients
      if (profile.role !== 'ADM_SISTEMA' && (!profile.clinics || profile.clinics.length === 0)) {
        setPatients([]);
      } else {
        let pq = query(collection(db, 'patients'));
        if (profile.role !== 'ADM_SISTEMA') {
          pq = query(pq, where('clinicId', 'in', profile.clinics));
        }
        const pSnap = await getDocs(pq);
        setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
      }

      // Fetch Professionals
      let uq = query(collection(db, 'users'), where('role', 'in', ['PROFISSIONAL', 'GESTOR', 'ADM_SISTEMA']));
      const uSnap = await getDocs(uq);
      const allUsers = uSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      
      const filteredUsers = allUsers.filter(u => {
        if (profile.role === 'ADM_SISTEMA') return true;
        return u.clinics.some(c => profile.clinics.includes(c));
      });
      setProfessionals(filteredUsers);
      
      // Auto-select clinic if only one
      if (filteredClinics.length === 1) {
        setFormData(prev => ({ ...prev, clinicId: filteredClinics[0].id }));
      }
      // Auto-select current professional if they are a professional
      if (['PROFISSIONAL', 'GESTOR'].includes(profile.role)) {
        setFormData(prev => ({ ...prev, professionalId: profile.uid }));
      }
    };

    fetchData();
  }, [isOpen, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.professionalId || !formData.clinicId) return;

    setLoading(true);
    try {
      const patient = patients.find(p => p.id === formData.patientId);
      const professional = professionals.find(p => p.uid === formData.professionalId);
      const tzOffsetDate = new Date();
      // Calculate offset here or just work with simple dates
      
      if (scheduleType === 'individual') {
        if (!formData.date) return;
        const dateTime = new Date(`${formData.date}T${formData.time}`);
        
        // Se for Domiciliar, cria blocos de deslocamento 1h antes e 1h depois
        if (formData.room === 'Domiciliar') {
          const antes = new Date(dateTime.getTime() - 60 * 60 * 1000);
          const depois = new Date(dateTime.getTime() + 60 * 60 * 1000);
          
          await addDoc(collection(db, 'appointments'), {
            patientId: formData.patientId,
            professionalId: formData.professionalId,
            clinicId: formData.clinicId,
            date: Timestamp.fromDate(antes),
            status: 'scheduled',
            type: 'Deslocamento (Ida)',
            room: 'Transito',
            patientName: patient?.name || 'Paciente',
            professionalName: professional?.name || 'Profissional'
          });
          
          await addDoc(collection(db, 'appointments'), {
            patientId: formData.patientId,
            professionalId: formData.professionalId,
            clinicId: formData.clinicId,
            date: Timestamp.fromDate(depois),
            status: 'scheduled',
            type: 'Deslocamento (Volta)',
            room: 'Transito',
            patientName: patient?.name || 'Paciente',
            professionalName: professional?.name || 'Profissional'
          });
        }

        await addDoc(collection(db, 'appointments'), {
          patientId: formData.patientId,
          professionalId: formData.professionalId,
          clinicId: formData.clinicId,
          date: Timestamp.fromDate(dateTime),
          status: 'scheduled',
          type: formData.type,
          room: formData.room,
          patientName: patient?.name || 'Paciente',
          professionalName: professional?.name || 'Profissional'
        });
      } else {
        if (!formData.startDate || formData.daysOfWeek.length === 0) return;
        
        let currentDate = new Date(`${formData.startDate}T${formData.time}`);
        let sessionsCreated = 0;
        
        while (sessionsCreated < formData.totalSessions) {
          if (formData.daysOfWeek.includes(currentDate.getDay())) {
            
            if (formData.room === 'Domiciliar') {
              const antes = new Date(currentDate.getTime() - 60 * 60 * 1000);
              const depois = new Date(currentDate.getTime() + 60 * 60 * 1000);
              const blockProps = {
                patientId: formData.patientId,
                professionalId: formData.professionalId,
                clinicId: formData.clinicId,
                status: 'scheduled' as const,
                room: 'Transito',
                patientName: patient?.name || 'Paciente',
                professionalName: professional?.name || 'Profissional',
              };
              await addDoc(collection(db, 'appointments'), {
                ...blockProps,
                date: Timestamp.fromDate(antes),
                type: 'Deslocamento (Ida) - Programa'
              });
              await addDoc(collection(db, 'appointments'), {
                ...blockProps,
                date: Timestamp.fromDate(depois),
                type: 'Deslocamento (Volta) - Programa'
              });
            }

            await addDoc(collection(db, 'appointments'), {
              patientId: formData.patientId,
              professionalId: formData.professionalId,
              clinicId: formData.clinicId,
              date: Timestamp.fromDate(new Date(currentDate)),
              status: 'scheduled',
              type: formData.type + ' (Programa)',
              room: formData.room,
              patientName: patient?.name || 'Paciente',
              professionalName: professional?.name || 'Profissional',
              programSessionParams: {
                total: formData.totalSessions,
                sessionNumber: sessionsCreated + 1
              }
            });
            sessionsCreated++;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      onClose();
      // Reset form
      setFormData({
        patientId: '',
        professionalId: profile?.role === 'PROFISSIONAL' ? profile.uid : '',
        clinicId: profile?.clinics.length === 1 ? profile.clinics[0] : '',
        date: '',
        time: '08:00',
        type: 'Consulta',
        room: '',
        totalSessions: 10,
        daysOfWeek: [],
        startDate: ''
      });
      setScheduleType('individual');
    } catch (err) {
      console.error("Error creating appointment:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Novo Agendamento">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Paciente *
            </label>
            <select
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
            >
              <option value="">Selecione um paciente</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setScheduleType('individual')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                scheduleType === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sessão Única
            </button>
            <button
              type="button"
              onClick={() => setScheduleType('programa')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                scheduleType === 'programa' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Programa
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Profissional *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.professionalId}
                onChange={(e) => setFormData({ ...formData, professionalId: e.target.value })}
              >
                <option value="">Selecione</option>
                {professionals.map(p => (
                  <option key={p.uid} value={p.uid}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Unidade *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.clinicId}
                onChange={(e) => setFormData({ ...formData, clinicId: e.target.value })}
              >
                <option value="">Selecione</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {scheduleType === 'individual' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Data *
                </label>
                <input
                  required
                  type="date"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Horário *
                </label>
                <input
                  required
                  type="time"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border border-brand-primary/20 bg-brand-primary/5 rounded-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-brand-primary mb-1.5 ml-1">
                    Data de Início *
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-3 bg-white border border-brand-primary/20 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-brand-primary mb-1.5 ml-1">
                    Horário Padrão *
                  </label>
                  <input
                    required
                    type="time"
                    className="w-full px-4 py-3 bg-white border border-brand-primary/20 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-brand-primary mb-1.5 ml-1">
                  Total de Sessões *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 bg-white border border-brand-primary/20 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all"
                  value={formData.totalSessions}
                  onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-brand-primary mb-2 ml-1">
                  Dias da Semana *
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const days = prev.daysOfWeek.includes(idx)
                            ? prev.daysOfWeek.filter(d => d !== idx)
                            : [...prev.daysOfWeek, idx];
                          return { ...prev, daysOfWeek: days };
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.daysOfWeek.includes(idx)
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'bg-white text-slate-500 border border-brand-primary/20 hover:bg-brand-primary/10'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {formData.daysOfWeek.length === 0 && (
                  <p className="text-[10px] text-rose-500 mt-1 font-bold ml-1">Selecione pelo menos um dia</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Tipo de Atendimento
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Consulta">Consulta</option>
                <option value="Avaliação">Avaliação</option>
                <option value="Sessão">Sessão</option>
                <option value="Retorno">Retorno</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Sala/Local
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              >
                <option value="">Nenhum</option>
                <option value="701">701 (Preferencial Fisio)</option>
                <option value="703">703 (Preferencial Fisio)</option>
                <option value="704">704 (Preferencial TO/Fono)</option>
                <option value="705">705 (Preferencial TO/Fono)</option>
                <option value="702">702 (Preferencial TO/Fono)</option>
                <option value="Ginásio Clínico">Ginásio Clínico</option>
                <option value="Esteira">Esteira</option>
                <option value="Suspensor">Suspensor</option>
                <option value="Domiciliar">Domiciliar (Bloqueia ±1h)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Confirmar Agendamento'
          )}
        </button>
      </form>
    </BaseModal>
  );
}
