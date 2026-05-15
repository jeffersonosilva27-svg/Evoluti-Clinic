import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  ChevronRight,
  ClipboardCheck,
  Activity
} from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient, Appointment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    appointmentsToday: 0,
    reassessmentsNeeded: 0,
    monthlySessions: 0
  });
  const [alerts, setAlerts] = useState<Patient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      try {
        // 1. Total Patients
        let patientsQ = query(collection(db, 'patients'));
        if (profile.role !== 'ADM_SISTEMA') {
          if (!profile.clinics || profile.clinics.length === 0) {
             setStats({ totalPatients: 0, appointmentsToday: 0, reassessmentsNeeded: 0, monthlySessions: 0 });
             setLoading(false);
             return;
          }
          patientsQ = query(patientsQ, where('clinicId', 'in', profile.clinics));
        }
        const patientsSnap = await getDocs(patientsQ);
        const allPatients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        
        // 2. Reassessments Needed (> 30 days or > 10 sessions)
        const needsReassessment = allPatients.filter(p => {
          if (p.sessionCountSinceAssessment > 10) return true;
          if (!p.lastAssessmentAt) {
             // Always need an initial assessment unless it's a brand new patient with 0 sessions
             // Often clinics require first session to be assessment, so we can flag it immediately.
             return true;
          }
          const last = p.lastAssessmentAt.toDate();
          return differenceInDays(new Date(), last) > 30;
        });

        // 3. Appointments Today
        const appointmentsRef = collection(db, 'appointments');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let qToday = query(
          appointmentsRef,
          where('date', '>=', today),
          where('date', '<', tomorrow)
        );

        if (profile.role !== 'ADM_SISTEMA') {
          qToday = query(qToday, where('clinicId', 'in', profile.clinics));
        }
        if (profile.role === 'PROFISSIONAL') {
          qToday = query(qToday, where('professionalId', '==', profile.uid));
        }

        const appointmentsSnap = await getDocs(qToday);
        const apps = appointmentsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Appointment);
        apps.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        
        const now = new Date();
        const futureApps = apps.filter(a => a.date.toDate() >= now && a.status === 'scheduled');
        setUpcomingAppointments(futureApps.slice(0, 5));
        
        let evolutionsCount = 0;
        let myPatientsCount = allPatients.length;
        
        let evQ = query(collection(db, 'evolutions'));
        if (profile.role === 'PROFISSIONAL') {
          evQ = query(evQ, where('professionalId', '==', profile.uid));
        }
        if (profile.role !== 'ADM_SISTEMA' && profile.clinics && profile.clinics.length > 0) {
          evQ = query(evQ, where('clinicId', 'in', profile.clinics));
        }
        
        const evSnap = await getDocs(evQ);
        evolutionsCount = evSnap.size;

        setStats({
          totalPatients: profile.role === 'PROFISSIONAL' ? appointmentsSnap.size : allPatients.length,
          appointmentsToday: appointmentsSnap.size,
          reassessmentsNeeded: needsReassessment.length,
          monthlySessions: evolutionsCount
        });

        setAlerts(needsReassessment.slice(0, 5));
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const cards = profile?.role === 'PROFISSIONAL' ? [
    { label: 'Seus Pacientes Hoje', value: stats.totalPatients, icon: Users, color: 'blue' },
    { label: 'Seus Agendamentos', value: stats.appointmentsToday, icon: Calendar, color: 'indigo' },
    { label: 'Reavaliações Pendentes', value: stats.reassessmentsNeeded, icon: AlertCircle, color: 'amber' },
    { label: 'Suas Evoluções (Total)', value: stats.monthlySessions, icon: TrendingUp, color: 'emerald' },
  ] : [
    { label: 'Pacientes Ativos', value: stats.totalPatients, icon: Users, color: 'blue' },
    { label: 'Agenda Hoje', value: stats.appointmentsToday, icon: Calendar, color: 'indigo' },
    { label: 'Reavaliações Pendentes', value: stats.reassessmentsNeeded, icon: AlertCircle, color: 'amber' },
    { label: 'Sessões / Mês', value: stats.monthlySessions, icon: TrendingUp, color: 'emerald' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Olá, {profile?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {profile?.role === 'PROFISSIONAL' ? 'Seu dashboard clínico para hoje' : 'Estatísticas da sua clínica para hoje'}, {format(new Date(), "PP", { locale: ptBR })}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{card.label}</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2 flex items-baseline gap-1">
                  {card.value}
                  {card.label === 'Sessões / Mês' && <span className="text-sm font-bold text-slate-400">/mês</span>}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl transition-colors ${
                card.color === 'blue' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' :
                card.color === 'indigo' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' :
                card.color === 'amber' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' :
                'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
              }`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reassessment Alerts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              Alertas de Reavaliação
            </h3>
            <button className="text-[10px] font-black text-brand-primary uppercase tracking-widest hover:translate-x-1 transition-transform">Ver todos →</button>
          </div>
          
          <div className="grid gap-3">
            {alerts.length > 0 ? alerts.map((patient) => (
              <div key={patient.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between group cursor-pointer hover:border-brand-primary/30 transition-all hover:bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-black border-2 border-white shadow-sm">
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-brand-primary transition-colors">{patient.name}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 tracking-tighter">
                      Última avaliação: {patient.lastAssessmentAt ? format(patient.lastAssessmentAt.toDate(), "P", { locale: ptBR }) : 'Nunca registrada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-widest">
                    Vencido
                  </span>
                  <div className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary" />
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <ClipboardCheck className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-bold">Nenhum paciente pendente</p>
                <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">Tudo em dia com as evoluções</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="space-y-6 lg:col-span-1 border-l border-slate-100 pl-8">
          <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary">
              <Calendar className="w-4 h-4" />
            </div>
            Próximos Atendimentos
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
            {upcomingAppointments.length > 0 ? upcomingAppointments.map((app, i) => (
              <div key={app.id} className="p-5 flex gap-4 hover:bg-slate-50/30 transition-colors">
                <div className="relative flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand-primary ring-4 ring-brand-primary/20 mt-1.5" />
                  {i < upcomingAppointments.length - 1 && <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100" />}
                </div>
                <div className="flex-1 w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{app.patientName}</p>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {format(app.date.toDate(), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    <span className="font-bold text-slate-700">Conduta Pendente:</span> 
                    <span className="block mt-0.5 italic text-slate-500 text-[11px]">{app.type}</span>
                  </p>
                  {profile?.role !== 'PROFISSIONAL' && (
                    <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold tracking-widest">
                      Profissional: {app.professionalName}
                    </p>
                  )}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-bold">Agenda livre</p>
                <p className="text-[10px] uppercase tracking-widest mt-1">Nenhum atendimento em breve.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
