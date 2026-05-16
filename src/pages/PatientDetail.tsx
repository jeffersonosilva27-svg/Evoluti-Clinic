import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  FileText, 
  ClipboardCheck, 
  History,
  Phone,
  Mail,
  Calendar,
  Download,
  Plus,
  Dumbbell,
  Trash2,
  Edit2,
  Sparkles,
  Info,
  Activity
} from 'lucide-react';
import { doc, onSnapshot, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient, Evolution, UserProfile, Exercise, PatientExercise } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PatientDetail({ patientId, onBack, onNavigateToAssessments }: { patientId: string, onBack: () => void, onNavigateToAssessments?: () => void }) {
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const isReceptionist = profile?.role === 'RECEPCIONISTA';
  
  const defaultTab = isReceptionist ? 'reports' : 'history';
  const [activeTab, setActiveTab] = useState<'history' | 'assessments' | 'condutas' | 'reports'>(defaultTab);

  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [saving, setSaving] = useState(false);
  const [refiningAI, setRefiningAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [isMyPatient, setIsMyPatient] = useState(false);

  useEffect(() => {
    if (profile?.role === 'PROFISSIONAL' && patient) {
      const checkAppointments = async () => {
        try {
          const q = query(
            collection(db, 'appointments'),
            where('patientId', '==', patientId),
            where('clinicId', '==', patient.clinicId),
            where('professionalId', '==', profile.uid)
          );
          const snap = await getDocs(q);
          setIsMyPatient(!snap.empty);
        } catch (e) {
          console.error(e);
        }
      };
      checkAppointments();
    } else {
      setIsMyPatient(true);
    }
  }, [profile, patientId, patient]);

  // Exercicio / Conduta states

  const [patientExercises, setPatientExercises] = useState<any[]>([]); // To hold populated exercises
  const [exerciseDb, setExerciseDb] = useState<Exercise[]>([]);
  
  const [showAddConduta, setShowAddConduta] = useState(false);
  const [newConduta, setNewConduta] = useState({
    exerciseId: '',
    customName: '',
    customDesc: '',
    instructions: '',
    frequency: ''
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const unsubPatient = onSnapshot(doc(db, 'patients', patientId), (snap) => {
      if (snap.exists()) setPatient({ id: snap.id, ...snap.data() } as Patient);
    }, (err) => console.error(err));

    const getExercisesDb = async () => {
      const snap = await getDocs(query(collection(db, 'exercises')));
      setExerciseDb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercise)));
    };
    getExercisesDb();

    const qPatientExercises = query(collection(db, `patients/${patientId}/exercises`), orderBy('addedAt', 'desc'));
    const unsubPatientExercises = onSnapshot(qPatientExercises, (snap) => {
      setPatientExercises(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err));

    return () => {
      unsubPatient();
      unsubPatientExercises();
    };
  }, [patientId]);

  useEffect(() => {
    if (!patient?.clinicId) return;
    const qEvolutions = query(
      collection(db, 'evolutions'),
      where('patientId', '==', patientId),
      where('clinicId', '==', patient.clinicId),
      orderBy('date', 'desc')
    );
    const unsubEvolutions = onSnapshot(qEvolutions, (snap) => {
      setEvolutions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evolution)));
    }, (err) => console.error(err));

    return () => unsubEvolutions();
  }, [patientId, patient?.clinicId]);

  const handleSaveConduta = async () => {
    setSaving(true);
    try {
      let finalExerciseId = newConduta.exerciseId;
      
      // se nao selecionou do BD, cria um novo no BD de exercicios
      if (!finalExerciseId && newConduta.customName) {
        const docRef = await addDoc(collection(db, 'exercises'), {
          name: newConduta.customName,
          description: newConduta.customDesc,
          serviceType: patient?.serviceTypes?.[0] || patient?.serviceType || 'FISIOTERAPIA',
          createdAt: serverTimestamp()
        });
        finalExerciseId = docRef.id;
        
        // update local db state so it shows up later
        setExerciseDb(prev => [...prev, {
          id: finalExerciseId,
          name: newConduta.customName,
          description: newConduta.customDesc,
          serviceType: patient?.serviceType as any,
          createdAt: new Date()
        }]);
      }

      if (!finalExerciseId) return;

      await addDoc(collection(db, `patients/${patientId}/exercises`), {
        exerciseId: finalExerciseId,
        instructions: newConduta.instructions,
        frequency: newConduta.frequency,
        addedAt: serverTimestamp()
      });

      setNewConduta({ exerciseId: '', customName: '', customDesc: '', instructions: '', frequency: '' });
      setShowAddConduta(false);
    } catch(err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefineWithAI = async () => {
    if (!soap.subjective && !soap.objective && !soap.assessment && !soap.plan) return;
    setRefiningAI(true);
    setAiError('');
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const prompt = `Você é um assistente clínico. Organize e refine o seguinte texto da evolução usando a metodologia SOAP (Subjetivo, Objetivo, Avaliação, Plano).
Apenas melhore a gramática, ortografia, a coesão profissional, clareza e estrutura (em português). 
REGRA CRÍTICA E INQUEBRÁVEL: NUNCA inferir ou adicionar condutas, relatos, sensações, parâmetros, tratamentos ou características que não tenham sido estritamente declaradas na evolução. Apenas refine o que foi providenciado. Retorne APENAS um JSON estrito com as chaves: "subjective", "objective", "assessment", "plan" com os textos.

Texto Original:
Subjetivo: ${soap.subjective}
Objetivo: ${soap.objective}
Avaliação: ${soap.assessment}
Plano e Conduta: ${soap.plan}`;

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
             setSoap({
                subjective: refinedText.subjective || soap.subjective,
                objective: refinedText.objective || soap.objective,
                assessment: refinedText.assessment || soap.assessment,
                plan: refinedText.plan || soap.plan
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

  const handleSaveEvolution = async () => {
    if (!profile || !patient) return;
    setSaving(true);
    try {
      const signature = `${profile.profession === 'MEDICINA' ? 'Dr(a).' : ''} ${profile.name} - Reg: ${profile.professionalRegistry || 'N/A'}`;
      await addDoc(collection(db, 'evolutions'), {
        patientId,
        clinicId: patient.clinicId,
        professionalId: profile.uid,
        date: new Date(),
        content: soap,
        signature
      });
      setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
      setActiveTab('history');
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const exportPDF = () => {
    window.print();
  };

  if (!patient) return null;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-all font-black text-[10px] uppercase tracking-widest bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex gap-3">
          <button 
            onClick={exportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary hover:border-brand-primary transition-all shadow-sm disabled:opacity-50"
          >
            {exporting ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Hero Header - Logic of Importance: Patient identity is #1 */}
      <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 flex-1">
          <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 bg-brand-primary text-white rounded-[32px] flex items-center justify-center text-5xl font-black shadow-2xl shadow-brand-primary/20 transform -rotate-3 transition-transform hover:rotate-0">
            {patient.name.charAt(0)}
          </div>
          <div className="mt-2 space-y-4">
            <div>
              <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-2 border border-brand-primary/20 bg-brand-primary/5 px-3 py-1 rounded-full w-fit mx-auto sm:mx-0">
                {patient.serviceType || 'Paciente'}
              </p>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-none">{patient.name}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
              {patient.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400"/> {patient.phone}</span>}
              {patient.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400"/> {patient.email}</span>}
              {patient.birthDate && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400"/> {patient.birthDate}</span>}
            </div>
          </div>
        </div>

        {/* Vital Stats - Logic of Importance: Status is #2 */}
        <div className="bg-slate-900 rounded-[32px] p-8 w-full lg:w-[360px] shrink-0 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Status Clínico
              </h3>
              <p className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                R$ {patient.serviceValue?.toFixed(2) || '0,00'}
              </p>
            </div>

            <div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Evoluções / Avaliação</p>
                  <p className="text-4xl font-black">{patient.sessionCountSinceAssessment} <span className="text-lg text-slate-600">/ 10</span></p>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-1000 ease-out" 
                  style={{ width: `${Math.min((patient.sessionCountSinceAssessment / 10) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">Última Reavaliação</span>
              <span className="font-black">
                {patient.lastAssessmentAt ? format(patient.lastAssessmentAt.toDate(), "dd MMM, yyyy", { locale: ptBR }) : 'Pendente'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center justify-start border-b-2 border-slate-100 print:hidden overflow-x-auto hide-scrollbar">
        {[
          { id: 'history', label: 'Evoluções', icon: History, hideForReceptionist: true },
          { id: 'condutas', label: 'Condutas Prescritas', icon: Dumbbell, hideForReceptionist: true },
          { id: 'assessments', label: 'Avaliações', icon: ClipboardCheck, hideForReceptionist: true },
          { id: 'reports', label: 'Relatórios & Docs', icon: FileText, hideForReceptionist: false },
        ]
        .filter(tab => !(isReceptionist && tab.hideForReceptionist))
        .map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2.5 px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 -mb-[2px] ${
              activeTab === tab.id 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-primary' : 'text-slate-400'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'reports' && (
          <div className="bg-white rounded-[32px] p-10 md:p-16 border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Declaração de Comparecimento</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Documento Oficial de Registro</p>
            </div>
            
            <div className="space-y-6 text-slate-700 leading-relaxed font-medium text-lg bg-slate-50 p-8 md:p-12 rounded-[24px]">
              <p>
                Declaramos para os devidos fins que o(a) paciente <strong className="text-slate-900 border-b-2 border-slate-200 pb-0.5">{patient.name}</strong>, 
                inscrito(a) no serviço de <strong className="text-slate-900 border-b-2 border-slate-200 pb-0.5">{patient.serviceTypes?.join(', ') || patient.serviceType}</strong>, 
                está em acompanhamento nesta clínica.
              </p>
              <p>
                As sessões contabilizadas desde a última avaliação somam o total de <strong className="text-brand-primary text-xl px-1">{patient.sessionCountSinceAssessment}</strong> sessões.
              </p>
            </div>

            <div className="pt-20">
              <div className="text-center space-y-3 max-w-[280px] mx-auto">
                <div className="border-t-2 border-slate-800 w-full" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-800">Assinatura do Profissional</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Data de Expedição: {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && !isReceptionist && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl flex gap-4 items-start shadow-sm">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-sm uppercase tracking-widest mb-1.5">Registro de Evoluções</p>
                <p className="text-xs font-medium opacity-80 leading-relaxed">O registro de novas evoluções deve ser feito exclusivamente através da Agenda, durante o momento do atendimento do paciente. Aqui consta apenas o histórico consolidado.</p>
              </div>
            </div>

            {evolutions.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-200 rounded-[32px] shadow-sm">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-400 tracking-tight">Nenhuma evolução registrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {evolutions.map(ev => (
                  <div key={ev.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
                    {(ev as any).deletedAt && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <span className="bg-rose-100 text-rose-600 font-black uppercase tracking-widest text-xs px-4 py-2 rounded-xl rotate-12 border border-rose-200 shadow-xl">Deletado</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                      <div className="flex flex-col gap-1">
                        <p className="text-xl font-black text-slate-800 tracking-tight">{format(ev.date.toDate(), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {format(ev.date.toDate(), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        {(ev as any).signature && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {(ev as any).signature}
                          </span>
                        )}
                        {(ev as any).editedAt && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                            Editado
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-2">
                          {profile?.uid === ev.professionalId && !(ev as any).deletedAt && (
                            <>
                              <button className="p-2.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 transition-all shadow-sm" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button className="p-2.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 transition-all shadow-sm" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 text-slate-700">
                      {ev.content.subjective && (
                        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6">
                          <strong className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">S - Subjetivo</strong>
                          <p className="text-sm font-medium leading-relaxed">{ev.content.subjective}</p>
                        </div>
                      )}
                      {ev.content.objective && (
                        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6 mt-4 pt-4 border-t border-slate-50">
                          <strong className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">O - Objetivo</strong>
                          <p className="text-sm font-medium leading-relaxed">{ev.content.objective}</p>
                        </div>
                      )}
                      {ev.content.assessment && (
                        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6 mt-4 pt-4 border-t border-slate-50">
                          <strong className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">A - Avaliação</strong>
                          <p className="text-sm font-medium leading-relaxed">{ev.content.assessment}</p>
                        </div>
                      )}
                      {ev.content.plan && (
                        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6 mt-4 pt-4 border-t border-slate-50">
                          <strong className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">P - Plano</strong>
                          <p className="text-sm font-medium leading-relaxed bg-brand-primary/5 p-4 rounded-2xl border border-brand-primary/10">{ev.content.plan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'condutas' && !isReceptionist && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 sm:p-6 rounded-[32px] border border-slate-200 shadow-sm gap-4">
              <div>
                <h3 className="font-black text-slate-800 text-2xl tracking-tight">Condutas Prescritas</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Exercícios e orientações para o paciente realizar.</p>
              </div>
              <button 
                onClick={() => setShowAddConduta(!showAddConduta)}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shrink-0 ${
                  showAddConduta 
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                  : 'bg-brand-primary text-white hover:brightness-110'
                }`}
              >
                {showAddConduta ? 'Fechar Formulário' : <><Plus className="w-4 h-4" /> Nova Prescrição</>}
              </button>
            </div>

            {showAddConduta && (
              <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[32px] shadow-2xl relative overflow-hidden animate-in slide-in-from-top-4 duration-300">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                  <Dumbbell className="w-64 h-64" />
                </div>
                
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 border-b border-slate-800 pb-4">Formulário de Prescrição</h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">
                        Selecione o Exercício
                      </label>
                      <select 
                        className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:border-brand-primary transition-colors appearance-none"
                        value={newConduta.exerciseId}
                        onChange={(e) => setNewConduta({...newConduta, exerciseId: e.target.value})}
                      >
                        <option value="">-- Criar Exercício Personalizado --</option>
                        {exerciseDb.filter(ex => ex.serviceType === patient.serviceType).map(ex => (
                          <option key={ex.id} value={ex.id}>{ex.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {!newConduta.exerciseId && (
                      <div className="space-y-5 bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Novo Exercício Manual</p>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-[10px] font-black tracking-widest uppercase text-slate-300">Nome do Exercício *</label>
                            {newConduta.customName && !newConduta.customDesc && (
                              <button
                                onClick={async () => {
                                  try {
                                    setNewConduta({ ...newConduta, customDesc: 'Gerando com IA...' });
                                    const { GoogleGenAI } = await import('@google/genai');
                                    const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
                                    const response = await ai.models.generateContent({
                                      model: 'gemini-2.5-flash',
                                      contents: `Forneça uma descrição clínica base e breve (máx 2 linhas) para o exercício de reabilitação/conduta chamado "${newConduta.customName}". Direto ao ponto, sem introdução.`
                                    });
                                    setNewConduta({ ...newConduta, customDesc: response.text || '', isAiGenerated: true });
                                  } catch (err) {
                                    console.error(err);
                                    setNewConduta({ ...newConduta, customDesc: '' });
                                  }
                                }}
                                className="text-[10px] text-brand-primary font-black uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-1.5 bg-brand-primary/10 px-3 py-1.5 rounded-full"
                              >
                                <Sparkles className="w-3 h-3" /> Auto-Desc
                              </button>
                            )}
                          </div>
                          <input 
                            type="text"
                            placeholder="Ex: Agachamento Livre"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-brand-primary transition-colors outline-none"
                            value={newConduta.customName}
                            onChange={(e) => setNewConduta({...newConduta, customName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black tracking-widest uppercase text-slate-300 mb-2 flex items-center gap-2">
                            Descrição
                            {(newConduta as any).isAiGenerated && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-400/20">
                                <Sparkles className="w-3 h-3" /> Gerado por IA
                              </span>
                            )}
                          </label>
                          <textarea 
                            rows={3}
                            placeholder="Opcional: Descreva como o exercício é realizado."
                            className={`w-full px-4 py-3 bg-slate-900 border rounded-xl text-sm font-bold text-white outline-none focus:border-brand-primary transition-colors ${
                              (newConduta as any).isAiGenerated ? 'border-emerald-500/50' : 'border-slate-700'
                            }`}
                            value={newConduta.customDesc}
                            onChange={(e) => setNewConduta({...newConduta, customDesc: e.target.value, isAiGenerated: false})}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">Dose / Frequência *</label>
                      <input 
                        type="text"
                        placeholder="Ex: 3 séries de 10 reps, todo dia"
                        className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:border-brand-primary transition-colors"
                        value={newConduta.frequency}
                        onChange={(e) => setNewConduta({...newConduta, frequency: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">Instruções para o Paciente</label>
                      <textarea 
                        rows={4}
                        placeholder="Recomendações e avisos que o paciente verá no app dele..."
                        className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:border-brand-primary transition-colors resize-none"
                        value={newConduta.instructions}
                        onChange={(e) => setNewConduta({...newConduta, instructions: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-8 mt-8 border-t border-slate-800 relative z-10">
                  <button 
                    onClick={() => setShowAddConduta(false)}
                    className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveConduta}
                    disabled={saving || (!newConduta.exerciseId && !newConduta.customName) || !newConduta.frequency}
                    className="px-8 py-4 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-700 flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-primary/30"
                  >
                    {saving ? 'Salvando...' : 'Salvar Prescrição'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {patientExercises.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-[32px] border-2 border-slate-100 border-dashed max-w-2xl mx-auto w-full">
                  <Dumbbell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-black text-slate-400 tracking-tight">Nenhuma conduta prescrita</p>
                  <p className="text-sm font-bold text-slate-400 mt-2">Clique em "Nova Prescrição" para começar.</p>
                </div>
              ) : (
                patientExercises.map((pe, index) => {
                  const ex = exerciseDb.find(e => e.id === pe.exerciseId);
                  const addedDate = pe.addedAt?.toDate ? format(pe.addedAt.toDate(), "dd.MM.yyyy", { locale: ptBR }) : '';
                  return (
                    <div key={pe.id} className="group p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col md:flex-row gap-8 justify-between items-start transition-all hover:shadow-xl hover:-translate-y-1 hover:border-brand-primary/30">
                      <div className="flex gap-6 items-start flex-1">
                        <div className="w-16 h-16 shrink-0 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center font-black text-2xl text-slate-300 group-hover:text-brand-primary group-hover:bg-brand-primary/10 transition-colors">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                              <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{ex?.name || 'Exercício Desconhecido'}</h4>
                              {addedDate && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-slate-200 flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" />
                                  Execução: {addedDate}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-500 max-w-xl leading-relaxed mt-3">{ex?.description}</p>
                          </div>
                          
                          {pe.instructions && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/50 max-w-xl">
                              <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Info className="w-3 h-3" />
                                Orientação ao Paciente
                              </p>
                              <p className="text-sm font-bold text-amber-900 leading-relaxed">{pe.instructions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="shrink-0 w-full md:w-auto bg-slate-900 p-6 rounded-3xl shadow-lg mt-4 md:mt-0 ml-0 md:ml-4 text-center md:text-right flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end min-w-[200px]">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">DOSE EXATA</span>
                        <span className="text-xl font-black text-white px-2 max-w-[220px]">{pe.frequency}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'assessments' && !isReceptionist && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div>
                  <h3 className="font-black text-slate-800 text-2xl tracking-tight">Avaliações Clínicas</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">Escalas e testes aplicados ao paciente.</p>
               </div>
              <button 
                onClick={onNavigateToAssessments}
                className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Nova Avaliação
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Example hardcoded for layout context given the existing code */}
              <div className="p-8 border border-slate-200 bg-white rounded-[32px] shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ClipboardCheck className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <p className="text-xl font-black text-slate-800 tracking-tight leading-tight mb-4">Escala de Equilíbrio de Berg</p>
                  <div className="flex items-end justify-between border-t border-slate-100 pt-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Escore</p>
                      <p className="text-2xl font-black text-brand-primary">52 <span className="text-sm font-bold text-slate-400">/ 56</span></p>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      Há 31 dias
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
