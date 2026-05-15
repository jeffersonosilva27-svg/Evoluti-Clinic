import React, { useState, useEffect } from 'react';
import { Search, Info, PlusCircle, CheckCircle2, Sparkles, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../firebase/config';
import { collection, addDoc, onSnapshot, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import BaseModal from '../components/modals/BaseModal';

interface AssessmentTemplate {
  id: string;
  title: string;
  category: string;
  description?: string;
  instructions?: string;
  scoring?: string;
  reference?: string;
  fields: { name: string; label: string; type: 'number' | 'text' | 'select', options?: string[] }[];
}

const templates: AssessmentTemplate[] = [
  {
    id: 'berg',
    title: 'Escala de Equilíbrio de Berg',
    category: 'Fisioterapia',
    description: 'Avalia o equilíbrio estático e dinâmico, e o risco de quedas em idosos ou pacientes com déficit neurológico.',
    instructions: 'Peça ao paciente para realizar as 14 tarefas descritas. Certifique-se de realizar em um ambiente seguro, próximo a uma parede e com uma cadeira próxima. O paciente deve ser instruído sobre cada etapa antes da execução. A nota de cada item varia de 0 (incapaz) a 4 (independente/adequado).',
    scoring: 'A pontuação total é obtida pela soma das 14 tarefas (máximo 56 pontos). Classificações gerais: 0-20 (dependente de cadeira de rodas), 21-40 (caminha com auxílio), 41-56 (independente). Uma pontuação < 45 indica alto risco de queda.',
    fields: [
      { name: 'item1', label: '1. Sentado para em pé', type: 'select', options: ['0 - Precisa de ajuda moderada/máxima', '1 - Precisa de mínima ajuda para ficar em pé', '2 - Se apoia nas mãos para levantar', '3 - Fica em pé usando as mãos após tentativas', '4 - Fica em pé sem usar as mãos'] },
      { name: 'item2', label: '2. Em pé sem apoio (2 min)', type: 'select', options: ['0 - Incapaz de ficar em pé 30s sem apoio', '1 - Fica em pé 30s sem apoio', '2 - Fica em pé > 30s com supervisão', '3 - Fica 2 minutos com supervisão', '4 - Fica 2 minutos com segurança e sozinho'] },
      { name: 'item3', label: '3. Sentado sem apoio pés no chão (2 min)', type: 'select', options: ['0 - Incapaz de sentar > 10s', '1 - Senta > 10s', '2 - Senta 30s', '3 - Senta 2 min c/ supervisão', '4 - Senta 2 min seguro'] },
      { name: 'item4', label: '4. Em pé para sentado', type: 'select', options: ['0 - Precisa de ajuda para sentar', '1 - Senta sozinho mas de forma descontrolada', '2 - Controla a descida mas apoia nas coxas', '3 - Senta independente, mas usa as mãos', '4 - Senta com segurança e não usa as mãos'] },
      { name: 'obs', label: 'Observações Gerais (ex: presença de tonturas, dores, medo)', type: 'text' }
    ]
  },
  {
    id: 'beck_dep',
    title: 'Inventário de Depressão de Beck (BDI)',
    category: 'Psicologia',
    description: 'Mede a intensidade da depressão em indivíduos a partir de 13 anos, abrangendo sintomas e atitudes.',
    instructions: 'Este é um questionário de autoavaliação. Forneça o formulário ao paciente para ler cada grupo de afirmações e escolher UMA que melhor descreva como ele tem se sentido NA ÚLTIMA SEMANA, incluindo o dia de hoje.',
    scoring: 'Some o valor (0 a 3) da alternativa escolhida em cada uma das 21 questões. Total varia de 0 a 63 pontos. Classificação clínica sugerida: Mínima (0-13), Leve (14-19), Moderada (20-28) ou Grave (29-63).',
    fields: [
      { name: 'score', label: 'Pontuação Total Obtida (0-63)', type: 'number' },
      { name: 'level', label: 'Nível de Depressão (Interpretação)', type: 'select', options: ['0-13: Sem depressão ou Mínima', '14-19: Depressão Leve', '20-28: Depressão Moderada', '29-63: Depressão Grave'] },
      { name: 'idea_suicida', label: 'Item 9 avaliado como > 0? (Ideação Suicida)', type: 'select', options: ['Sim - Risco Elevado', 'Não'] },
      { name: 'clinical_note', label: 'Nota Clínica e Encaminhamentos', type: 'text' }
    ]
  },
  {
    id: 'moca',
    title: 'MoCA - Montreal Cognitive Assessment',
    category: 'Neuropsicologia / Medicina',
    description: 'Rastreio cognitivo breve para disfunções cognitivas leves, abrangendo domínios como atenção, função executiva e memória.',
    instructions: 'Siga a folha de aplicação do MoCA. Dê as instruções palavra por palavra. Registre os acertos na folha e no final digite os totais em cada domínio abaixo.',
    scoring: 'Faça a soma total (máx 30). Adicione 1 ponto ao total se o nível de escolaridade for <= 12 anos e se a pontuação obtida for < 30. Escores >= 26 são normais.',
    fields: [
      { name: 'visuospatial', label: 'Visuoespacial / Executiva (Máx 5 pontos)', type: 'select', options: ['0 - Errou todos', '1 - Acertou 1 etapa', '2 - Acertou 2 etapas', '3 - Acertou 3 etapas', '4 - Acertou 4 etapas', '5 - Perfeito (TMT, Cubo, Relógio)'] },
      { name: 'naming', label: 'Nomeação (Animais) (Máx 3 pontos)', type: 'select', options: ['0 - Nenhum', '1 - Acertou 1', '2 - Acertou 2', '3 - Acertou todos os 3 (Leão, Rino, Camelo)'] },
      { name: 'memory', label: 'Memória - Palavras Lembradas (Para acompanhamento)', type: 'text' },
      { name: 'attention', label: 'Atenção (Dígitos, Letras, Subtração) (Máx 6)', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6 pontos'] },
      { name: 'language', label: 'Linguagem (Repetição, Fluência) (Máx 3)', type: 'select', options: ['0', '1', '2', '3 pontos'] },
      { name: 'abstraction', label: 'Abstração (Semelhanças) (Máx 2)', type: 'select', options: ['0', '1', '2 pontos'] },
      { name: 'delayed_recall', label: 'Evocação Tardia (Máx 5)', type: 'select', options: ['0 - Não lembrou de nenhuma palavra', '1 - Lembrou 1 sem pista', '2 - Lembrou 2 sem pista', '3 - Lembrou 3 sem pista', '4 - Lembrou 4 sem pista', '5 - Lembrou 5 sem pista'] },
      { name: 'orientation', label: 'Orientação (Tempo e Espaço) (Máx 6)', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6 pontos (Data, Mês, Ano, Dia, Lugar, Cidade)'] },
      { name: 'total', label: 'Score Total Estimado (Lembrar do bônus de escolaridade)', type: 'number' }
    ]
  },
  {
    id: 'borg_cr10',
    title: 'Escala de Borg Modificada (CR10)',
    category: 'Cardiologia / Fisioterapia Respiratória',
    description: 'Avalia a percepção subjetiva de esforço (dispneia e fadiga) do paciente durante uma atividade física.',
    instructions: 'Pergunte ao paciente: "De 0 a 10, que nota você daria para a sua falta de ar ou cansaço nas pernas agora?". Utilize a tabela impressa para guiar o paciente.',
    scoring: 'A pontuação varia de 0 (Nenhum esforço) a 10 (Esforço máximo). Baseado na resposta, determina-se a intensidade do esforço, fundamental para prescrição e monitoramento do exercício.',
    reference: 'https://pubmed.ncbi.nlm.nih.gov/7154893/ (Link para o método de Borg)',
    fields: [
      { 
        name: 'perceived_exertion', 
        label: 'Percepção Subjetiva de Esforço (CR10)', 
        type: 'select', 
        options: [
          '0 - Repouso (Nenhum esforço)', 
          '0.5 - Muito, muito leve (Quase imperceptível)', 
          '1 - Muito leve', 
          '2 - Leve', 
          '3 - Moderado', 
          '4 - Um pouco intenso', 
          '5 - Intenso (Pesado)', 
          '6 - Mais que intenso', 
          '7 - Muito intenso', 
          '8 - Muito, muito intenso', 
          '9 - Quase máximo', 
          '10 - Máximo (Exaustão)'
        ] 
      },
      { name: 'symptoms', label: 'Sintomas relatados (Falta de ar, Dor, etc)', type: 'text' }
    ]
  },
  {
    id: 'borg_original',
    title: 'Escala de Esforço Percebido de Borg (Original 6-20)',
    category: 'Medicina do Esporte / Fisioterapia',
    description: 'A Escala de Percepção Subjetiva do Esforço (RPE) mede a intensidade da atividade física. Os valores estão associados à frequência cardíaca (valor x 10 ≈ FC).',
    instructions: 'Peça ao paciente para olhar a escala de 6 a 20 e apontar quão intenso ou pesado sente o exercício neste exato momento.',
    scoring: 'Varia de 6 a 20. 6 corresponde a "nenhum esforço" (como repouso absoluto). 20 corresponde ao esforço máximo. Geralmente, entre 12 e 14 é considerado exercício moderado.',
    reference: 'https://pubmed.ncbi.nlm.nih.gov/7154893/',
    fields: [
      { 
        name: 'rpe_score', 
        label: 'Escore de Percepção (6-20)', 
        type: 'select', 
        options: [
          '6 - Nenhum esforço', 
          '7 - Extremamente leve', 
          '8', 
          '9 - Muito leve', 
          '10', 
          '11 - Leve', 
          '12', 
          '13 - Um pouco intenso', 
          '14', 
          '15 - Intenso (Pesado)', 
          '16', 
          '17 - Muito intenso', 
          '18', 
          '19 - Extremamente intenso', 
          '20 - Esforço máximo'
        ] 
      },
      { name: 'heart_rate', label: 'Frequência Cardíaca no momento (bpm)', type: 'number' },
      { name: 'clinical_note', label: 'Nota Clínica / Atividade', type: 'text' }
    ]
  }
];

export default function AssessmentLibrary() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AssessmentTemplate | null>(null);
  
  const [dbTemplates, setDbTemplates] = useState<AssessmentTemplate[]>([]);
  const [deletedFixed, setDeletedFixed] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [scaleToDelete, setScaleToDelete] = useState<AssessmentTemplate | null>(null);

  useEffect(() => {
    const unsubTemplates = onSnapshot(collection(db, 'assessmentTemplates'), snap => {
      setDbTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentTemplate)));
    });
    
    const unsubDeleted = onSnapshot(collection(db, 'deletedAssessmentTemplates'), snap => {
      setDeletedFixed(snap.docs.map(d => d.id));
    });

    return () => {
      unsubTemplates();
      unsubDeleted();
    };
  }, []);

  const allTemplates = [...templates.filter(t => !deletedFixed.includes(t.id)), ...dbTemplates];
  const filtered = allTemplates.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  const requestDelete = (e: React.MouseEvent, t: AssessmentTemplate) => {
    e.stopPropagation();
    setScaleToDelete(t);
  };

  const confirmDelete = async () => {
    if (!scaleToDelete) return;
    try {
      if (templates.find(t => t.id === scaleToDelete.id)) {
        await setDoc(doc(db, 'deletedAssessmentTemplates', scaleToDelete.id), {
          deletedAt: new Date().toISOString(),
          deletedBy: profile?.id || 'unknown'
        });
      } else {
        await deleteDoc(doc(db, 'assessmentTemplates', scaleToDelete.id));
      }
      if (selected?.id === scaleToDelete.id) {
        setSelected(null);
      }
      setScaleToDelete(null);
    } catch (err) {
      console.error("Erro ao apagar", err);
      alert("Erro ao apagar a escala. Verifique suas permissões.");
    }
  };

  const handleGenerateScale = async () => {
    if (!search.trim()) return;
    if (profile?.role !== 'ADM_SISTEMA') {
      alert("Apenas administradores do sistema podem gerar novas escalas com IA.");
      return;
    }
    setGenerating(true);
    try {
      // In Vite with AI Studio plugin, process.env.GEMINI_API_KEY is replaced at build time
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('API do Gemini não configurada.');
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Atue como um especialista clínico pesquisador. Crie uma estrutura de formulário para a escala de avaliação clínica ou teste: "${search}".
        Você deve buscar na literatura (ex: PubMed) pela versão original e validada desta escala.
        1. A escala DEVE ser transcrita em sua INTEGRALIDADE, ou seja, todos os itens/perguntas da escala original devem estar presentes como campos no formulário. Respeite as metodologias oficiais e os títulos originais das perguntas.
        2. O campo "type" pode ser APENAS "number", "text" ou "select". Se for "select", forneça um array "options" com as opções em strings.
        3. MUITO IMPORTANTE: Para cada opção no "select", coloque A PONTUAÇÃO E A LEGENDA DA RESPOSTA. Ex: "0 - Ausente / Não sente dor", "1 - Dor leve", etc. NUNCA DEIXE SÓ O NÚMERO. Todas as opções devem ter descrições/legendas detalhadas baseadas na escala original.
        4. Forneça uma breve introdução do que a escala avalia no campo "description".
        5. Forneça instruções BEM DETALHADAS sobre como aplicar e como preencher a escala no campo "instructions".
        6. Explique a forma de scores e interpretação detalhadamente no campo "scoring".
        7. NOVO: No campo "reference", coloque a referência bibliográfica da escala original, idealmente incluindo o link (DOI) ou Pubmed ID.
        8. CRÍTICO: Não inclua quebras de linha não escapadas dentro de strings JSON. Certifique-se de que o JSON é perfeitamente válido.
        Responda ESTRITAMENTE o formato JSON solicitado, sem markdown ou codeblocks.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              instructions: { type: Type.STRING },
              scoring: { type: Type.STRING },
              reference: { type: Type.STRING },
              fields: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING, description: 'Must be "number", "text" or "select"' },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["name", "label", "type"]
                }
              }
            },
            required: ["id", "title", "category", "fields"]
          }
        }
      });

      let jsonStr = response.text?.trim() || '';
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      }
      
      // Fix unescaped newlines inside strings (common model error)
      jsonStr = jsonStr.replace(/\\n/g, "\\n")  
               .replace(/\\'/g, "\\'")
               .replace(/\\"/g, '\\"')
               .replace(/\\&/g, "\\&")
               .replace(/\\r/g, "\\r")
               .replace(/\\t/g, "\\t")
               .replace(/\\b/g, "\\b")
               .replace(/\\f/g, "\\f");
      // remove non-printable and other non-valid JSON chars
      jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g,""); 

      let scaleData: AssessmentTemplate;
      try {
        scaleData = JSON.parse(jsonStr) as AssessmentTemplate;
      } catch (parseError) {
        console.error("JSON Parse Error. Raw string:", jsonStr);
        throw new Error(`Erro ao interpretar o resultado da IA. Tente novamente. Detalhe: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      // Enforce types for safety
      if (scaleData && scaleData.fields) {
        const docRef = await addDoc(collection(db, 'assessmentTemplates'), {
          ...scaleData,
          createdAt: new Date().toISOString()
        });
        setSelected({ ...scaleData, id: docRef.id });
      }
    } catch (err) {
      console.error("Error generating scale", err);
      alert("Não foi possível gerar a escala solicitada. " + (err instanceof Error ? err.message : 'Erro desconhecido.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Biblioteca de Avaliações</h2>
        <p className="text-slate-500 text-sm">Busque escalas validadas e estruturadas em PT-BR.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar escala (ex: Berg, Beck...)"
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => setSelected(t)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selected?.id === t.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'bg-white border-slate-100 text-slate-700 hover:border-blue-200'
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{t.category}</p>
                  <p className="text-sm font-bold">{t.title}</p>
                </button>
                {/* Trash button for admins to delete any scale */}
                {(profile?.role === 'ADM_SISTEMA' || profile?.role === 'GESTOR') && (
                  <button
                    onClick={(e) => requestDelete(e, t)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-rose-100 text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-200"
                    title="Apagar escala"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            
            {filtered.length === 0 && search.length > 2 && profile?.role === 'ADM_SISTEMA' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-center space-y-3 p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50"
              >
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Não encontrou na biblioteca?</p>
                  <p className="text-xs text-slate-500 mt-1">Podemos tentar gerar a estrutura dessa escala usando Inteligência Artificial em tempo real.</p>
                </div>
                <button
                  onClick={handleGenerateScale}
                  disabled={generating}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando Estrutura...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Gerar com IA</>
                  )}
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Info className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800">{selected.title}</h3>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="p-8 space-y-6">
                  {(selected.description || selected.instructions || selected.scoring) && (
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                      {selected.description && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">O que avalia</h4>
                          <p className="text-sm font-medium text-slate-700">{selected.description}</p>
                        </div>
                      )}
                      {selected.instructions && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Orientação de Aplicação</h4>
                          <p className="text-sm font-medium text-slate-700">{selected.instructions}</p>
                        </div>
                      )}
                      {selected.scoring && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Scores e Interpretação</h4>
                          <p className="text-sm font-medium text-slate-700">{selected.scoring}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selected.reference && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Referência Original / Literatura</h4>
                      <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap">
                        {selected.reference}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selected.fields.map(field => (
                      <div key={field.name} className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                        {field.type === 'select' ? (
                          <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                            <option value="">Selecione...</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : field.type === 'number' ? (
                          <input type="number" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        ) : (
                          <textarea className="w-full h-24 p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="text-xs text-slate-400 font-medium">
                      * Atenção: Caso gerado por IA, revise os campos conforme literatura.
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                      <PlusCircle className="w-4 h-4" />
                      Registrar Avaliação
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
                <Search className="w-12 h-12 text-slate-200 mb-4" />
                <p className="font-bold text-lg text-slate-300 uppercase tracking-tighter">Selecione uma Escala</p>
                <p className="text-sm font-medium max-w-xs">Escolha uma avaliação na lista ao lado para abrir o formulário estruturado.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <BaseModal 
        isOpen={!!scaleToDelete} 
        onClose={() => setScaleToDelete(null)}
        title="Excluir Escala"
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 mb-2">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-bold text-slate-800">
            Remover {scaleToDelete?.title}?
          </h4>
          <p className="text-sm font-medium text-slate-500">
            Esta ação não poderá ser desfeita. A escala será removida permanentemente do sistema (mas não as avaliações já realizadas nos pacientes).
          </p>
          
          <div className="flex gap-4 w-full mt-6">
            <button
              onClick={() => setScaleToDelete(null)}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 px-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
