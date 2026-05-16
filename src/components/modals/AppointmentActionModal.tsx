import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { Appointment } from '../../types';
import { Calendar, User, Clock, MapPin, Trash2, CheckCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { getDocs, query, where } from 'firebase/firestore';

interface AppointmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
}

export default function AppointmentActionModal({ isOpen, onClose, appointment }: AppointmentActionModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refiningAI, setRefiningAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [hasEvolution, setHasEvolution] = useState(false);
  const [evolutionNote, setEvolutionNote] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });

  React.useEffect(() => {
    const checkEvolution = async () => {
      try {
        let q = query(
          collection(db, 'evolutions'), 
          where('appointmentId', '==', appointment.id)
        );
        if (appointment.clinicId) {
          q = query(q, where('clinicId', '==', appointment.clinicId));
        }
        if (profile?.role === 'PROFISSIONAL') {
          q = query(q, where('professionalId', '==', profile.uid));
        } else if (appointment.professionalId) {
          q = query(q, where('professionalId', '==', appointment.professionalId));
        }

        const snap = await getDocs(q);
        if (!snap.empty) {
          setHasEvolution(true);
        } else {
          setHasEvolution(false);
        }
      } catch (e) {
        console.error("Error checking evolution", e);
      }
    };
    if (appointment.id) {
      checkEvolution();
    }
  }, [appointment.id, appointment.clinicId, appointment.professionalId, profile]);

  React.useEffect(() => {
    if (showEvolutionForm && appointment.patientId && !evolutionNote.plan) {
      const fetchPlan = async () => {
        try {
          const q = query(collection(db, `patients/${appointment.patientId}/exercises`));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const exercisesLine = snap.docs.map(d => {
              const data = d.data();
              return `- ${data.exerciseName || 'Exercício'}: ${data.instructions} (${data.frequency})`;
            }).join('\n');
            setEvolutionNote(prev => ({
              ...prev,
              plan: `Planejamento Importado:\n${exercisesLine}`
            }));
          }
        } catch (e) {
          console.error("Error fetching patient exercises", e);
        }
      };
      fetchPlan();
    }
  }, [showEvolutionForm, appointment.patientId]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    date: format(appointment.date.toDate(), 'yyyy-MM-dd'),
    time: format(appointment.date.toDate(), 'HH:mm')
  });

  const handleReschedule = async () => {
    setLoading(true);
    try {
      const [year, month, day] = rescheduleData.date.split('-').map(Number);
      const [hour, minute] = rescheduleData.time.split(':').map(Number);
      const newDate = new Date(year, month - 1, day, hour, minute);

      await updateDoc(doc(db, 'appointments', appointment.id), {
        date: Timestamp.fromDate(newDate)
      });
      onClose();
    } catch (err) {
      console.error("Error rescheduling:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (antecedence: 'maior' | 'menor') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'cancelled',
        cancellationReason: antecedence === 'maior' ? 'Antecedência > 24h' : 'Antecedência < 24h'
      });
      
      // se menor de 24h, adicionar no financeiro como não remunerado, etc, dependendo do combinado
      // Neste MVP, só vamos salvar no log da appointment.
      
      onClose();
    } catch (err) {
      console.error("Error cancelling appointment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'completed'
      });
      onClose();
    } catch (err) {
      console.error("Error completing appointment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefineWithAI = async () => {
    if (!evolutionNote.subjective && !evolutionNote.objective && !evolutionNote.assessment && !evolutionNote.plan) return;
    setRefiningAI(true);
    setAiError('');
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const prompt = `Você é um assistente clínico. Organize e refine o seguinte texto da evolução usando a metodologia SOAP (Subjetivo, Objetivo, Avaliação, Plano).
Apenas melhore a gramática, ortografia, a coesão profissional, clareza e estrutura (em português). 
REGRA CRÍTICA E INQUEBRÁVEL: NUNCA inferir ou adicionar condutas, relatos, sensações, parâmetros, tratamentos ou características que não tenham sido estritamente declaradas na evolução. Apenas refine o que foi providenciado. Retorne APENAS um JSON estrito com as chaves: "subjective", "objective", "assessment", "plan" com os textos.

Texto Original:
Subjetivo: ${evolutionNote.subjective}
Objetivo: ${evolutionNote.objective}
Avaliação: ${evolutionNote.assessment}
Plano e Conduta: ${evolutionNote.plan}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      if (response.text) {
         try {
             // sanitize in case markdown blocks code output
             const cleanJsonString = response.text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
             const refinedText = JSON.parse(cleanJsonString);
             setEvolutionNote({
                subjective: refinedText.subjective || evolutionNote.subjective,
                objective: refinedText.objective || evolutionNote.objective,
                assessment: refinedText.assessment || evolutionNote.assessment,
                plan: refinedText.plan || evolutionNote.plan
             });
         } catch (e) {
             console.error("Failed to parse JSON", e);
             setAiError("Não foi possível processar a resposta da IA.");
         }
      }
    } catch (err) {
      console.error(err);
      setAiError("Ocorreu um erro ao refinar o texto.");
    } finally {
      setRefiningAI(false);
    }
  };

  const handleEvolve = async () => {
    if (!evolutionNote.assessment) return; // requiring at least assessment
    setLoading(true);
    try {
      // 1. Create evolution
      const signature = profile ? `${profile.profession === 'MEDICINA' ? 'Dr(a).' : ''} ${profile.name} - Reg: ${profile.professionalRegistry || 'N/A'}` : '';
      
      let evolutionDate: any = serverTimestamp();
      if (appointment.date) {
        const appointmentTime = appointment.date.toDate().getTime();
        evolutionDate = new Date(appointmentTime + 60 * 60 * 1000);
      }

      await addDoc(collection(db, 'evolutions'), {
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        clinicId: appointment.clinicId,
        content: {
          ...evolutionNote
        },
        signature,
        date: evolutionDate,
        appointmentId: appointment.id
      });

      // 2. Mark appointment as completed
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'completed'
      });

      // 3. Update patient's evolution count
      await updateDoc(doc(db, 'patients', appointment.patientId), {
        sessionCountSinceAssessment: increment(1)
      });

      onClose();
    } catch (err) {
      console.error("Error creating evolution:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={showEvolutionForm ? "Registrar Evolução (SOAP)" : isRescheduling ? "Alterar Agendamento" : "Detalhes do Agendamento"}
    >
      {showEvolutionForm ? (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
            <h4 className="text-[10px] font-black uppercase text-blue-600 mb-1">Paciente</h4>
            <p className="text-sm font-bold text-slate-800">{appointment.patientName}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Subjetivo (S)
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                placeholder="Relatos do paciente..."
                value={evolutionNote.subjective}
                onChange={(e) => setEvolutionNote({ ...evolutionNote, subjective: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Objetivo (O)
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                placeholder="Dados observados, exames..."
                value={evolutionNote.objective}
                onChange={(e) => setEvolutionNote({ ...evolutionNote, objective: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Avaliação (A) *
              </label>
              <textarea
                required
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                placeholder="Análise do profissional sobre o quadro..."
                value={evolutionNote.assessment}
                onChange={(e) => setEvolutionNote({ ...evolutionNote, assessment: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Plano (P)
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                placeholder="Conduta proposta..."
                value={evolutionNote.plan}
                onChange={(e) => setEvolutionNote({ ...evolutionNote, plan: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {aiError && <p className="text-xs text-rose-500 font-bold text-right">{aiError}</p>}
            <div className="flex gap-3">
               <button
                 onClick={() => setShowEvolutionForm(false)}
                 className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
               >
                 Voltar
               </button>
               <button
                 onClick={handleRefineWithAI}
                 disabled={loading || refiningAI || (!evolutionNote.subjective && !evolutionNote.objective && !evolutionNote.assessment && !evolutionNote.plan)}
                 className="flex-[1.5] py-4 bg-brand-primary/10 text-brand-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 {refiningAI ? <div className="w-4 h-4 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" /> : 'Refinar c/ IA'}
               </button>
               <button
                 onClick={handleEvolve}
                 disabled={loading || !evolutionNote.assessment}
                 className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Evolução'}
               </button>
            </div>
          </div>
        </div>
      ) : isRescheduling ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Nova Data
              </label>
              <input
                type="date"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                value={rescheduleData.date}
                onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Novo Horário
              </label>
              <input
                type="time"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
                value={rescheduleData.time}
                onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setIsRescheduling(false)}
              className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Voltar
            </button>
            <button
              onClick={handleReschedule}
              disabled={loading}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Alteração'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl animate-in fade-in slide-in-from-bottom-1 underline-offset-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800 tracking-tight leading-none">{appointment.patientName}</h4>
                <p className="text-[10px] font-black uppercase text-brand-primary mt-1">{appointment.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-slate-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Data</span>
                </div>
                <p className="text-xs font-black text-slate-600">
                  {format(appointment.date.toDate(), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="p-4 border border-slate-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Horário</span>
                </div>
                <p className="text-xs font-black text-slate-600">
                  {format(appointment.date.toDate(), 'HH:mm')}
                </p>
              </div>
            </div>

            <div className="p-4 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Profissional Responsável</span>
              </div>
              <p className="text-xs font-black text-slate-600">{appointment.professionalName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            {profile?.role !== 'PROFISSIONAL' || appointment.professionalId === profile?.uid ? (
              <>
                {profile?.role !== 'RECEPCIONISTA' && !hasEvolution && (
                  <button
                    disabled={loading}
                    onClick={() => setShowEvolutionForm(true)}
                    className="col-span-2 py-4 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Registrar Evolução / Finalizar
                  </button>
                )}
                {hasEvolution && profile?.role !== 'RECEPCIONISTA' && (
                  <div className="col-span-2 py-3 bg-emerald-50 text-emerald-700 text-center rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Evolução já registrada</span>
                  </div>
                )}
                <button
                  disabled={loading}
                  onClick={() => setIsRescheduling(true)}
                  className="py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 border border-indigo-100"
                >
                  Reagendar
                </button>
                <button
                  disabled={loading}
                  onClick={() => setShowCancelOptions(true)}
                  className="py-3 border border-rose-100 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  onClick={handleComplete}
                  className="py-3 border border-emerald-100 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirmar Presença
                </button>
              </>
            ) : (
              <div className="col-span-2 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 text-center">
                <p className="text-xs font-bold">Acesso Restrito</p>
                <p className="text-[10px] mt-1">Este agendamento pertence a outro profissional.</p>
              </div>
            )}
          </div>
          {showCancelOptions && (
            <div className="mt-4 p-4 border border-rose-200 bg-rose-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <p className="text-xs font-bold text-rose-700 mb-3 text-center">Informe o motivo do cancelamento:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCancel('maior')}
                  className="py-2 px-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all text-center"
                >
                  Antecedência &gt; 24h
                </button>
                <button
                  onClick={() => handleCancel('menor')}
                  className="py-2 px-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all text-center leading-tight flex flex-col items-center justify-center gap-1"
                >
                  <span>Antecedência {'<'} 24h</span>
                  <span className="text-[8px] opacity-70">(Não remunerado)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
}
