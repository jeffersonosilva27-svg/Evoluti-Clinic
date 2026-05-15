import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FinancialRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewFinancialRecordModal from '../components/modals/NewFinancialRecordModal';
import { Appointment, UserProfile } from '../types';
import { getDocs } from 'firebase/firestore';

export default function Finance() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, { name: string, production: number }>>({});
  const [unpaidHours, setUnpaidHours] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    let q = query(
      collection(db, 'financial'),
      where('date', '>=', startOfMonth(currentMonth)),
      where('date', '<=', endOfMonth(currentMonth))
    );

    if (profile.role !== 'ADM_SISTEMA') {
      if (profile.clinics && profile.clinics.length > 0) {
        q = query(q, where('clinicId', 'in', profile.clinics));
      } else {
        setRecords([]);
        return;
      }
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialRecord)));
    }, (err) => {
      console.error("Error fetching financial records:", err);
    });

    // Fetch professional production (based on appointments or records)
    // Simplified: fetch all appointments for the month
    const fetchProduction = async () => {
      if (profile.role === 'PROFISSIONAL') return;
      
      let apptQ = query(
        collection(db, 'appointments'),
        where('date', '>=', startOfMonth(currentMonth)),
        where('date', '<=', endOfMonth(currentMonth))
      );
      if (profile.role !== 'ADM_SISTEMA') {
        if (!profile.clinics || profile.clinics.length === 0) {
          setProfessionals({});
          return;
        }
        apptQ = query(apptQ, where('clinicId', 'in', profile.clinics));
      }
      
      const snap = await getDocs(apptQ);
      const production: Record<string, { name: string, count: number }> = {};
      let unpaidCount = 0;
      
      snap.docs.forEach(doc => {
        const appt = doc.data() as Appointment;
        if (appt.status === 'completed' && appt.professionalId) {
          if (!production[appt.professionalId]) {
            production[appt.professionalId] = { name: appt.professionalName || 'Desconhecido', count: 0 };
          }
          production[appt.professionalId].count += 1;
        } else if (appt.status === 'cancelled' && (appt as any).cancellationReason === 'Antecedência < 24h') {
          unpaidCount++;
        }
      });
      
      // Calculate hypothetical value (using an average of 150 per session for mock)
      const mapped: Record<string, { name: string, production: number }> = {};
      Object.keys(production).forEach(k => {
        mapped[k] = { name: production[k].name, production: production[k].count * 150 };
      });
      setProfessionals(mapped);
      setUnpaidHours(unpaidCount);
    };
    
    fetchProduction();

    return () => unsubscribe();
  }, [currentMonth, profile]);

  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalOutcome = records.filter(r => r.type === 'outcome').reduce((acc, curr) => acc + curr.amount, 0);

  const totalEstimatedProduction = (Object.values(professionals) as {name: string, production: number}[]).reduce((acc, curr) => acc + curr.production, 0);
  const estimatedResult = totalIncome - totalOutcome + totalEstimatedProduction;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Financeiro</h2>
          <p className="text-slate-500 text-sm">Controle de faturamento e despesas da unidade.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1 mr-4">
            <button 
              onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentMonth(newDate);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              {'<'}
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button 
              onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentMonth(newDate);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              {'>'}
            </button>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Plus className="w-4 h-4" />
            Novo Registro
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Download className="w-4 h-4" />
            Relatório de Cobrança
          </button>
        </div>
      </div>

      <NewFinancialRecordModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(currentMonth, 'MMMM', { locale: ptBR })}</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Entradas</p>
          <p className="text-xl font-black text-slate-900 mt-1">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Despesas</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Saídas</p>
          <p className="text-xl font-black text-slate-900 mt-1">R$ {totalOutcome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Saldo Líquido</p>
          <p className="text-xl font-black text-slate-900 mt-1">R$ {(totalIncome - totalOutcome).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100 col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500 text-white rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Resultado Estimado</p>
          <p className="text-xl font-black mt-1">R$ {estimatedResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm col-span-1 lg:col-span-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-8 -mt-8 -z-0" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Horários não remunerados</p>
            <p className="text-xl font-black text-slate-900 mt-1">{unpaidHours} <span className="text-xs font-bold text-slate-400">hora(s)</span></p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            Lançamentos de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><Filter className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4 text-center">Tipo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">
                    {format(record.date.toDate(), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">
                    {record.description}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {record.type === 'income' ? (
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowUpRight className="w-4 h-4" /></div>
                      ) : (
                        <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><ArrowDownRight className="w-4 h-4" /></div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                      record.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {record.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold text-sm ${
                    record.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {record.type === 'income' ? '+' : '-'} R$ {record.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium italic">Nenhum lançamento registrado para este período.</p>
            </div>
          )}
        </div>
      </div>

      {/* Produção por Profissional */}
      {profile?.role !== 'PROFISSIONAL' && Object.keys(professionals).length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Produção por Profissional ({format(currentMonth, 'MMMM yyyy', { locale: ptBR })})
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(Object.values(professionals) as {name: string, production: number}[]).map((prof, idx) => (
              <div key={idx} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    {prof.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{prof.name}</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Produção Estimada</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-lg font-black text-emerald-600">
                    R$ {prof.production.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
