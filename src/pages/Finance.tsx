import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { FinancialRecord } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import NewFinancialRecordModal from "../components/modals/NewFinancialRecordModal";
import { Appointment, UserProfile } from "../types";
import { getDocs } from "firebase/firestore";

export default function Finance() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [professionals, setProfessionals] = useState<
    Record<string, { name: string; production: number }>
  >({});
  const [unpaidHours, setUnpaidHours] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let q = query(
      collection(db, "financial"),
      where("date", ">=", startOfMonth(currentMonth)),
      where("date", "<=", endOfMonth(currentMonth)),
    );

    if (profile.role !== "ADM_SISTEMA") {
      if (profile.clinics && profile.clinics.length > 0) {
        q = query(q, where("clinicId", "in", profile.clinics));
      } else {
        setRecords([]);
        return;
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRecords(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as FinancialRecord,
          ),
        );
      },
      (err) => {
        console.error("Error fetching financial records:", err);
      },
    );

    // Fetch professional production (based on appointments or records)
    // Simplified: fetch all appointments for the month
    const fetchProduction = async () => {
      if (profile.role === "PROFISSIONAL") return;

      let apptQ = query(
        collection(db, "appointments"),
        where("date", ">=", startOfMonth(currentMonth)),
        where("date", "<=", endOfMonth(currentMonth)),
      );
      if (profile.role !== "ADM_SISTEMA") {
        if (!profile.clinics || profile.clinics.length === 0) {
          setProfessionals({});
          return;
        }
        apptQ = query(apptQ, where("clinicId", "in", profile.clinics));
      }

      const snap = await getDocs(apptQ);
      const production: Record<string, { name: string; count: number }> = {};
      let unpaidCount = 0;

      snap.docs.forEach((doc) => {
        const appt = doc.data() as Appointment;
        if (appt.status === "completed" && appt.professionalId) {
          if (!production[appt.professionalId]) {
            production[appt.professionalId] = {
              name: appt.professionalName || "Desconhecido",
              count: 0,
            };
          }
          production[appt.professionalId].count += 1;
        } else if (
          appt.status === "cancelled" &&
          (appt as any).cancellationReason === "Antecedência < 24h"
        ) {
          unpaidCount++;
        }
      });

      // Calculate hypothetical value (using an average of 150 per session for mock)
      const mapped: Record<string, { name: string; production: number }> = {};
      Object.keys(production).forEach((k) => {
        mapped[k] = {
          name: production[k].name,
          production: production[k].count * 150,
        };
      });
      setProfessionals(mapped);
      setUnpaidHours(unpaidCount);
    };

    fetchProduction();

    return () => unsubscribe();
  }, [currentMonth, profile]);

  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalOutcome = records
    .filter((r) => r.type === "outcome")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalEstimatedProduction = (
    Object.values(professionals) as { name: string; production: number }[]
  ).reduce((acc, curr) => acc + curr.production, 0);
  const estimatedResult = totalIncome - totalOutcome + totalEstimatedProduction;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Financeiro
          </h2>
          <p className="text-slate-500 text-sm">
            Controle de faturamento e despesas da unidade.
          </p>
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
              {"<"}
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button
              onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentMonth(newDate);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              {">"}
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

      {/* Summary Cards Bento Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 auto-rows-[minmax(140px,auto)]">
        <div className="bg-indigo-50 border border-indigo-100/50 p-6 rounded-[2rem] shadow-sm lg:col-span-3 flex flex-col justify-between transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {format(currentMonth, "MMM", { locale: ptBR })}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">
              Total Entradas
            </p>
            <p className="text-3xl font-black text-indigo-900 mt-1 tracking-tighter">
              R${" "}
              {totalIncome.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100/50 p-6 rounded-[2rem] shadow-sm lg:col-span-3 flex flex-col justify-between transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              Despesas
            </span>
          </div>
          <div className="mt-4">
            <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest">
              Total Saídas
            </p>
            <p className="text-3xl font-black text-rose-900 mt-1 tracking-tighter">
              R${" "}
              {totalOutcome.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100/50 p-6 rounded-[2rem] shadow-sm lg:col-span-3 flex flex-col justify-between transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">
              Saldo Líquido
            </p>
            <p className="text-3xl font-black text-emerald-900 mt-1 tracking-tighter">
              R${" "}
              {(totalIncome - totalOutcome).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="bg-brand-primary p-6 rounded-[2rem] shadow-xl shadow-brand-primary/20 lg:col-span-3 flex flex-col justify-between text-white transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/20 text-white rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">
              Result. Estimado
            </p>
            <p className="text-3xl font-black mt-1 tracking-tighter">
              R${" "}
              {estimatedResult.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Lançamentos List block replacing table */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm overflow-hidden lg:col-span-8 flex flex-col">
          <div className="border-b border-slate-100 pb-5 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <Calendar className="w-5 h-5" />
              </div>
              Lançamentos de{" "}
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex-1 overflow-auto space-y-3 pr-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                      record.type === "income"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {record.type === "income" ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">
                      {record.description}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                      {format(record.date.toDate(), "dd/MMM/yy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3 border-t sm:border-0 border-slate-200/60 pt-3 sm:pt-0">
                  <span
                    className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                      record.status === "paid"
                        ? "bg-emerald-100/50 text-emerald-600 border border-emerald-200/50"
                        : "bg-amber-100/50 text-amber-600 border border-amber-200/50"
                    }`}
                  >
                    {record.status === "paid" ? "PAGO" : "PENDENTE"}
                  </span>
                  <span
                    className={`text-base font-black tracking-tighter ${
                      record.type === "income"
                        ? "text-emerald-600"
                        : "text-slate-900"
                    }`}
                  >
                    {record.type === "income" ? "+" : "-"} R${" "}
                    {record.amount.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-black text-sm">
                  Nenhum lançamento
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                  Nenhum registro para este mês ainda.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Produção e Unpaid hours */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-6">
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between overflow-hidden relative">
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-100/50 rounded-bl-full -mr-10 -mt-10" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="p-3 bg-white text-amber-600 rounded-2xl shadow-sm">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 relative z-10">
              <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest">
                Horas não remuneradas
              </p>
              <p className="text-4xl font-black text-amber-900 mt-1 tracking-tighter">
                {unpaidHours}{" "}
                <span className="text-lg font-bold opacity-50">h</span>
              </p>
            </div>
          </div>

          {/* Produção por Profissional */}
          {profile?.role !== "PROFISSIONAL" &&
            Object.keys(professionals).length > 0 && (
              <div className="bg-slate-800 rounded-[2rem] border border-slate-700 shadow-xl flex-1 flex flex-col overflow-hidden text-white">
                <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-black text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    Produção Estimada
                  </h3>
                </div>
                <div className="p-6 flex-1 overflow-auto space-y-3">
                  {(
                    Object.values(professionals) as {
                      name: string;
                      production: number;
                    }[]
                  ).map((prof, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-700/50 hover:bg-slate-700 transition-colors rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center text-slate-300 font-black shadow-inner">
                          {prof.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">
                            {prof.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                            {format(currentMonth, "MMM", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-lg font-black text-emerald-400">
                          R${" "}
                          {prof.production.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
