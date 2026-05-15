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
  Sparkles
} from 'lucide-react';
import { doc, onSnapshot, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient, Evolution, UserProfile, Exercise, PatientExercise } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PatientDetail({ patientId, onBack }: { patientId: string, onBack: () => void }) {
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const isReceptionist = profile?.role === 'RECEPCIONISTA';
  
  const defaultTab = isReceptionist ? 'reports' : 'evolution';
  const [activeTab, setActiveTab] = useState<'evolution' | 'history' | 'assessments' | 'condutas' | 'reports'>(defaultTab);

  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isMyPatient, setIsMyPatient] = useState(false);

  useEffect(() => {
    if (profile?.role === 'PROFISSIONAL') {
      const checkAppointments = async () => {
        try {
          const q = query(
            collection(db, 'appointments'),
            where('patientId', '==', patientId),
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
  }, [profile, patientId]);

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

    const qEvolutions = query(
      collection(db, 'evolutions'),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const unsubEvolutions = onSnapshot(qEvolutions, (snap) => {
      setEvolutions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evolution)));
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
      unsubEvolutions();
      unsubPatientExercises();
    };
  }, [patientId]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-all font-black text-[10px] uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista
        </button>
        <div className="flex gap-3">
          <button 
            onClick={exportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            {exporting ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Patient Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
            <div className="w-24 h-24 bg-brand-primary rounded-[24px] mx-auto mb-6 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-primary/20 transform -rotate-3 group-hover:rotate-0 transition-transform">
              {patient.name.charAt(0)}
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{patient.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">REF: {patient.id.substring(0,8)}</p>
            
            <div className="mt-8 space-y-5 text-left bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <Phone className="w-3.5 h-3.5 text-brand-primary" />
                </div>
                <span className="text-[11px] font-black">{patient.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <Mail className="w-3.5 h-3.5 text-brand-primary" />
                </div>
                <span className="text-[11px] font-black truncate">{patient.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                </div>
                <span className="text-[11px] font-black uppercase">{patient.birthDate || 'Não informado'}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-200/50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Serviço Contratado</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-700">{patient.serviceType || '---'}</span>
                  <span className="text-[11px] font-black text-emerald-600">R$ {patient.serviceValue?.toFixed(2) || '0,00'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sidebar-bg p-8 rounded-[32px] text-white shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-3">
              <ClipboardCheck className="w-4 h-4 text-brand-primary" /> Status Clínico
            </h3>
            <div className="space-y-6">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Última Reavaliação</p>
                <p className="text-sm font-black">{patient.lastAssessmentAt ? format(patient.lastAssessmentAt.toDate(), "P", { locale: ptBR }) : 'Pendente'}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Índice Evolutivo</p>
                <div className="flex items-end justify-between">
                  <p className="text-sm font-black text-brand-primary">{patient.sessionCountSinceAssessment} / 10</p>
                  <p className="text-[10px] font-bold text-slate-400">Sessões</p>
                </div>
                <div className="w-full bg-white/10 h-1 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-brand-primary h-full transition-all duration-1000" 
                    style={{ width: `${Math.min((patient.sessionCountSinceAssessment / 10) * 100, 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Work Area */}
        <div className="lg:col-span-3 space-y-6" id="patient-report-area">
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-inner overflow-x-auto print:hidden">
            {[
              { id: 'evolution', label: 'Evolução', icon: FileText, hideForReceptionist: true },
              { id: 'history', label: 'Histórico', icon: History, hideForReceptionist: true },
              { id: 'condutas', label: 'Condutas', icon: Dumbbell, hideForReceptionist: true },
              { id: 'assessments', label: 'Avaliações', icon: ClipboardCheck, hideForReceptionist: true },
              { id: 'reports', label: 'Relatórios / Declaração', icon: Download, hideForReceptionist: false },
            ]
            .filter(tab => !(isReceptionist && tab.hideForReceptionist))
            .map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-white text-brand-primary shadow-lg shadow-brand-primary/5' 
                  : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
            {activeTab === 'reports' && (
              <div className="p-10 space-y-8">
                <div className="border-b border-slate-100 pb-6 text-center">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Declaração de Comparecimento / Relatório</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">{patient.name}</p>
                </div>
                <div className="space-y-6 text-slate-700 leading-relaxed font-medium">
                  <p>
                    Declaramos para os devidos fins que o(a) paciente <strong>{patient.name}</strong>, 
                    inscrito(a) no serviço de <strong>{patient.serviceTypes?.join(', ') || patient.serviceType}</strong>, 
                    está em acompanhamento nesta unidade.
                  </p>
                  <p>
                    Sessões contabilizadas desde a última avaliação: <strong>{patient.sessionCountSinceAssessment}</strong>
                  </p>
                  <br/><br/><br/>
                  <div className="text-center space-y-2 max-w-xs mx-auto">
                    <div className="border-t border-slate-300 w-full" />
                    <p className="text-xs font-bold uppercase text-slate-500">Assinatura / Carimbo</p>
                    <p className="text-[10px] text-slate-400">Data e Hora de Impressão: {new Date().toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'evolution' && !isReceptionist && (
              <div className="p-10 space-y-8">
                <div className="border-b border-slate-100 pb-6">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Registro de Evolução Diária</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Metodologia SOAP • Registro Individual por Sessão</p>
                </div>

                {!isMyPatient ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 p-6 rounded-2xl text-center">
                    <p className="font-bold text-sm">Acesso restrito</p>
                    <p className="text-xs mt-2">Você só pode registrar evoluções para pacientes que possuem agendamento(s) com você.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {[
                        { key: 'subjective', label: 'Subjetivo', hint: 'Relato do paciente sobre dor, fadiga ou melhora...' },
                        { key: 'objective', label: 'Objetivo', hint: 'Dados mensuráveis: ADM, força, testes especiais...' },
                        { key: 'assessment', label: 'Avaliação', hint: 'Análise clínica do progresso e resposta ao tratamento...' },
                        { key: 'plan', label: 'Plano e Conduta', hint: 'Próximos passos e exercícios prescritos...' },
                      ].map((field) => (
                        <div key={field.key} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{field.label}</label>
                            <span className="text-[8px] font-black text-brand-primary/40 uppercase">Obrigatório</span>
                          </div>
                          <textarea 
                            className="w-full h-40 p-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none text-sm font-bold text-slate-700 transition-all placeholder:text-slate-300 shadow-inner resize-none"
                            placeholder={field.hint}
                            value={(soap as any)[field.key]}
                            onChange={(e) => setSoap({...soap, [field.key]: e.target.value})}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-8 flex justify-end">
                      <button 
                        onClick={handleSaveEvolution}
                        disabled={saving || !soap.subjective}
                        className="flex items-center gap-3 px-10 py-5 bg-brand-primary text-white rounded-[20px] font-black text-[12px] uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-brand-primary/20 active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-5 h-5" />
                        Protocolar Evolução
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'history' && !isReceptionist && (
              <div className="p-8 space-y-6">
                {evolutions.map(ev => (
                  <div key={ev.id} className="relative pl-8 border-l-2 border-slate-100 pb-8 last:pb-0">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 bg-white border-2 border-blue-600 rounded-full" />
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-slate-800">{format(ev.date.toDate(), "Pp", { locale: ptBR })}</p>
                        {(ev as any).signature && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Assinado: {(ev as any).signature}
                          </span>
                        )}
                        {(ev as any).editedAt && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                            Editado
                          </span>
                        )}
                        {(ev as any).deletedAt && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            Deletado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {profile?.uid === ev.professionalId && !(ev as any).deletedAt && (
                          <>
                            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`bg-slate-50 p-4 rounded-2xl border ${
                      (ev as any).deletedAt ? 'border-rose-100 bg-rose-50/30 line-through opacity-70' : 'border-slate-100'
                    }`}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">S+O</p>
                          <p className="text-xs text-slate-700 line-clamp-3">{ev.content.subjective} / {ev.content.objective}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">A+P</p>
                          <p className="text-xs text-slate-700 line-clamp-3">{ev.content.assessment} / {ev.content.plan}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'assessments' && !isReceptionist && (
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Avaliações Aplicadas</h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all">
                    <Plus className="w-4 h-4" />
                    Aplicar Nova Avaliação
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-100 bg-slate-50 rounded-2xl">
                    <p className="text-sm font-bold text-slate-800">Escala de Equilíbrio de Berg</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black mt-1">Escore: 52/56</p>
                    <p className="text-[10px] text-slate-400 mt-2">Aplicado há 31 dias</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'condutas' && !isReceptionist && (
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">Planejamento de Conduta</h3>
                  <button 
                    onClick={() => setShowAddConduta(!showAddConduta)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Prescrever Conduta
                  </button>
                </div>

                {showAddConduta && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">
                            Exercício Terapêutico
                          </label>
                          <select 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                            value={newConduta.exerciseId}
                            onChange={(e) => setNewConduta({...newConduta, exerciseId: e.target.value})}
                          >
                            <option value="">-- Cadastrar Novo Exercício --</option>
                            {exerciseDb.filter(ex => ex.serviceType === patient.serviceType).map(ex => (
                              <option key={ex.id} value={ex.id}>{ex.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {!newConduta.exerciseId && (
                          <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-100">
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">Nome do Exercício *</label>
                                {newConduta.customName && !newConduta.customDesc && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        setNewConduta({ ...newConduta, customDesc: 'Gerando descrição com IA...' });
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
                                    className="text-[10px] text-brand-primary font-bold hover:underline flex items-center gap-1"
                                  >
                                    <Sparkles className="w-3 h-3" /> Gerar Descrição
                                  </button>
                                )}
                              </div>
                              <input 
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700"
                                value={newConduta.customName}
                                onChange={(e) => setNewConduta({...newConduta, customName: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1 flex items-center gap-2">
                                Descrição base
                                {(newConduta as any).isAiGenerated && (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> IA
                                  </span>
                                )}
                              </label>
                              <textarea 
                                rows={2}
                                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-slate-700 ${
                                  (newConduta as any).isAiGenerated ? 'border-brand-primary' : 'border-slate-200'
                                }`}
                                value={newConduta.customDesc}
                                onChange={(e) => setNewConduta({...newConduta, customDesc: e.target.value, isAiGenerated: false})}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">Parâmetros / Frequência *</label>
                          <input 
                            type="text"
                            placeholder="Ex: 3 séries de 10 reps, diário"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                            value={newConduta.frequency}
                            onChange={(e) => setNewConduta({...newConduta, frequency: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">Instruções para o Paciente</label>
                          <textarea 
                            rows={3}
                            placeholder="Observações que aparecerão para o paciente..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                            value={newConduta.instructions}
                            onChange={(e) => setNewConduta({...newConduta, instructions: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <button 
                        onClick={() => setShowAddConduta(false)}
                        className="px-6 py-3 border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveConduta}
                        disabled={saving || (!newConduta.exerciseId && !newConduta.customName) || !newConduta.frequency}
                        className="px-6 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                      >
                        {saving ? 'Salvando...' : 'Salvar Prescrição'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {patientExercises.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                      <Dumbbell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-500">Nenhuma conduta prescrita</p>
                    </div>
                  ) : (
                    patientExercises.map(pe => {
                      const ex = exerciseDb.find(e => e.id === pe.exerciseId);
                      return (
                        <div key={pe.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start">
                          <div>
                            <h4 className="text-base font-black text-slate-800">{ex?.name || 'Exercício Desconhecido'}</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-2xl">{ex?.description}</p>
                            {pe.instructions && (
                              <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Instruções Prescritas</p>
                                <p className="text-xs font-bold text-slate-700">{pe.instructions}</p>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-right">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Frequência/Dose</span>
                            <span className="text-sm font-bold text-brand-primary">{pe.frequency}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
