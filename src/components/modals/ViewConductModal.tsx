import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Appointment, PatientExercise } from '../../types';
import { Dumbbell, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface ViewConductModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

export default function ViewConductModal({ isOpen, onClose, appointment }: ViewConductModalProps) {
  const [exercises, setExercises] = useState<PatientExercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !appointment) return;

    const fetchConduct = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, `patients/${appointment.patientId}/exercises`), orderBy('addedAt', 'desc'));
        const snap = await getDocs(q);
        setExercises(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PatientExercise)));
      } catch (err) {
        console.error("Erro ao buscar condutas", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConduct();
  }, [isOpen, appointment]);

  if (!appointment) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={`Condutas: ${appointment.patientName}`}>
      <div className="space-y-6">
        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 flex gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <span className="font-black text-sm">{appointment.patientName?.charAt(0)}</span>
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">{appointment.patientName}</h4>
            <p className="text-xs text-slate-500 font-medium">Agendamento: {appointment.type}</p>
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1 flex items-center gap-2">
            <Dumbbell className="w-3 h-3" />
            Condutas Prescritas
          </h3>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : exercises.length > 0 ? (
            <div className="space-y-3">
              {exercises.map((ex, i) => (
                <div key={ex.id || i} className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 group hover:border-brand-primary/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      {ex.name}
                      {ex.description && ex.description.includes('IA') && (
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                      )}
                    </h4>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-md shadow-sm">
                      {ex.frequency}
                    </span>
                  </div>
                  {ex.description && (
                    <p className="text-xs text-slate-500 font-medium mb-3 italic">
                      "{ex.description}"
                    </p>
                  )}
                  <div className="bg-white rounded-lg p-3 text-xs text-slate-600 border border-slate-100 shadow-sm font-medium leading-relaxed">
                    <span className="font-bold text-slate-800 block mb-1">Instruções Práticas:</span>
                    {ex.instructions}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Dumbbell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">Nenhuma conduta cadastrada</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                Adicione no prontuário do paciente
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
