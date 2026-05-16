import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  ChevronRight,
  ClipboardCheck,
  Activity,
  UserCheck
} from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient, Appointment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ViewConductModal from '../components/modals/ViewConductModal';

export interface AlertItem {
  patient: Patient;
  type: 'reassessment' | 'evolution';
}

export default function Dashboard() {
  const { profile, setActiveTab, setSelectedPatientId } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    appointmentsToday: 0,
    reassessmentsNeeded: 0,
    evolutionsNeeded: 0,
    monthlySessions: 0
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConductApp, setSelectedConductApp] = useState<Appointment | null>(null);

  const handleViewConduct = (app: Appointment) => {
    setSelectedConductApp(app);
  };

  const goToPatientEvolutions = (patientId: string) => {
    setSelectedPatientId?.(patientId);
    setActiveTab?.('patients');
  };

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      try {
        // 1. Total Patients
        let patientsQ = query(collection(db, 'patients'));
        if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR') {
          if (!profile.clinics || profile.clinics.length === 0) {
             setStats({ totalPatients: 0, appointmentsToday: 0, reassessmentsNeeded: 0, evolutionsNeeded: 0, monthlySessions: 0 });
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

        if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR') {
          qToday = query(qToday, where('clinicId', 'in', profile.clinics));
        }
        if (profile.role === 'PROFISSIONAL') {
          qToday = query(qToday, where('professionalId', '==', profile.uid));
        }

        const appointmentsSnap = await getDocs(qToday);
        const apps = appointmentsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Appointment);
        apps.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        
        const countApps = apps.filter(a => !a.type?.includes('Deslocamento'));

        const now = new Date();
        const futureApps = countApps.filter(a => a.date.toDate() >= now && a.status === 'scheduled');
        setUpcomingAppointments(futureApps.slice(0, 5));
        
        // --- Evolutions logic ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let qRecentApps = query(appointmentsRef, where('date', '>=', thirtyDaysAgo));
        if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR') {
          qRecentApps = query(qRecentApps, where('clinicId', 'in', profile.clinics));
        }
        if (profile.role === 'PROFISSIONAL') {
          qRecentApps = query(qRecentApps, where('professionalId', '==', profile.uid));
        }
        const recentAppsSnap = await getDocs(qRecentApps);
        const recentApps = recentAppsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Appointment);
        const completedRecentApps = recentApps.filter(a => !a.type?.includes('Deslocamento') && (a.status === 'completed' || a.status === 'attended'));
        
        let evolutionsCount = 0;
        let myPatientsCount = allPatients.length;
        
        let evQ = query(collection(db, 'evolutions'));
        let recentEvQ = query(collection(db, 'evolutions'), where('date', '>=', thirtyDaysAgo));
        
        if (profile.role === 'PROFISSIONAL') {
          evQ = query(evQ, where('professionalId', '==', profile.uid));
          recentEvQ = query(recentEvQ, where('professionalId', '==', profile.uid));
        }
        if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR' && profile.clinics && profile.clinics.length > 0) {
          evQ = query(evQ, where('clinicId', 'in', profile.clinics));
          recentEvQ = query(recentEvQ, where('clinicId', 'in', profile.clinics));
        }
        
        const evSnap = await getDocs(evQ);
        evolutionsCount = evSnap.size;
        
        const recentEvSnap = await getDocs(recentEvQ);
        const recentEvs = recentEvSnap.docs.map(d => d.data());

        const appsByPatient: Record<string, number> = {};
        completedRecentApps.forEach(a => {
          appsByPatient[a.patientId] = (appsByPatient[a.patientId] || 0) + 1;
        });

        const evsByPatient: Record<string, number> = {};
        recentEvs.forEach(e => {
          evsByPatient[e.patientId] = (evsByPatient[e.patientId] || 0) + 1;
        });

        const needsEvolution: Patient[] = [];
        allPatients.forEach(p => {
           const appCount = appsByPatient[p.id] || 0;
           const evCount = evsByPatient[p.id] || 0;
           if (appCount > evCount) {
             needsEvolution.push(p);
           }
        });

        setStats({
          totalPatients: profile.role === 'PROFISSIONAL' ? appointmentsSnap.size : allPatients.length,
          appointmentsToday: countApps.length,
          reassessmentsNeeded: needsReassessment.length,
          evolutionsNeeded: needsEvolution.length,
          monthlySessions: evolutionsCount
        });

        const combinedAlerts: AlertItem[] = [
          ...needsReassessment.map(p => ({ patient: p, type: 'reassessment' as const })),
          ...needsEvolution.map(p => ({ patient: p, type: 'evolution' as const }))
        ];

        setAlerts(combinedAlerts.slice(0, 10));
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const cards = profile?.role === 'PROFISSIONAL' ? [
    { label: 'Seus Pacientes Hoje', value: stats.totalPatients, icon: Users, color: 'brand' },
    { label: 'Agendamentos Hoje', value: stats.appointmentsToday, icon: Calendar, color: 'secondary' },
    { label: 'Reavaliações Pendentes', value: stats.reassessmentsNeeded, icon: AlertCircle, color: 'accent' },
    { label: 'Evoluções Pendentes', value: stats.evolutionsNeeded, icon: ClipboardCheck, color: 'brand' },
  ] : [
    { label: 'Pacientes Ativos', value: stats.totalPatients, icon: Users, color: 'brand' },
    { label: 'Agenda Hoje', value: stats.appointmentsToday, icon: Calendar, color: 'secondary' },
    { label: 'Evoluções Pendentes', value: stats.evolutionsNeeded, icon: ClipboardCheck, color: 'amber' },
    { label: 'Sessões / Mês', value: stats.monthlySessions, icon: TrendingUp, color: 'slate' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Olá, {profile?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {profile?.role === 'PROFISSIONAL' ? 'Seu dashboard clínico para hoje' : 'Estatísticas da sua clínica para hoje'}, {format(new Date(), "PP", { locale: ptBR })}
        </p>
      </header>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-[minmax(140px,auto)]">
        
        {/* Stats Blocks - First row in desktop */}
        {cards.map((card, i) => {
          const isPrimary = card.color === 'brand';
          const isSecondary = card.color === 'secondary';
          const isAccent = card.color === 'accent';
          
          const bgClass = isPrimary 
            ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20'
            : isSecondary ? 'bg-brand-secondary text-white shadow-xl shadow-brand-secondary/20'
            : isAccent ? 'bg-white border border-slate-200 text-slate-900'
            : 'bg-white border border-slate-200 text-slate-900';

          const iconClass = isPrimary 
            ? 'bg-white/20 text-white'
            : isSecondary ? 'bg-white/20 text-white'
            : isAccent ? 'bg-amber-100 text-amber-600'
            : 'bg-slate-100 text-slate-600';

          const textClass = (isPrimary || isSecondary) ? 'text-white/70' : 'text-slate-500';
          const valueClass = (isPrimary || isSecondary) ? 'text-white' : 'text-slate-900';

          return (
            <div key={i} className={`md:col-span-6 xl:col-span-3 rounded-[2rem] p-6 flex flex-col justify-between transition-transform hover:-translate-y-1 ${bgClass}`}>
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-2xl ${iconClass}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4">
                <p className={`text-[10px] font-black uppercase tracking-widest ${textClass}`}>{card.label}</p>
                <p className={`text-4xl font-black mt-1 flex items-baseline gap-1 tracking-tighter ${valueClass}`}>
                  {card.value}
                  {card.label.includes('Mês') && <span className={`text-sm font-bold opacity-60 ml-1`}>/mês</span>}
                </p>
              </div>
            </div>
          );
        })}

        {/* Action / Upcoming Appointments Block */}
        <div className="md:col-span-12 xl:col-span-8 bg-white rounded-[2rem] border border-slate-200 p-6 lg:p-8 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
                <Calendar className="w-5 h-5" />
              </div>
              Próximos Atendimentos Hoje
            </h3>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {upcomingAppointments.length > 0 ? upcomingAppointments.map((app, i) => (
              <div key={app.id} className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-4 rounded-3xl flex items-center gap-4 cursor-pointer group"
                onClick={() => handleViewConduct(app)}
              >
                <div className="bg-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-200/60 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Hoje</span>
                  <span className="text-sm font-black text-brand-primary leading-none">{format(app.date.toDate(), 'HH:mm')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-black text-slate-800 truncate group-hover:text-brand-primary transition-colors">{app.patientName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {app.type}
                    </span>
                    {profile?.role !== 'PROFISSIONAL' && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                        Dr(a) {app.professionalName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pr-4 hidden sm:block">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-primary group-hover:text-brand-primary transition-all">
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-primary" />
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Calendar className="w-10 h-10 mx-auto mb-4 text-slate-300" />
                <p className="text-base font-black text-slate-600">Agenda livre</p>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1 max-w-[200px]">Nenhum atendimento programado para as próximas horas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts Block */}
        <div className="md:col-span-12 xl:col-span-4 bg-slate-800 rounded-[2rem] p-6 lg:p-8 flex flex-col shadow-xl flex-1 text-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              Pendências
            </h3>
          </div>
          
          <div className="flex-1 flex flex-col gap-3">
            {alerts.length > 0 ? alerts.map((alert, idx) => (
              <div key={`${alert.patient.id}-${idx}`} 
                onClick={() => goToPatientEvolutions(alert.patient.id)}
                className="bg-slate-700/50 hover:bg-slate-700 transition-colors p-4 rounded-3xl flex items-center gap-4 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center text-sm font-black shrink-0 shadow-inner">
                  {alert.patient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-white text-sm truncate">{alert.patient.name}</h4>
                  <p className="text-[10px] uppercase font-bold text-amber-200/70 mt-0.5 tracking-widest truncate">
                    {alert.type === 'reassessment' ? 
                      (alert.patient.lastAssessmentAt ? `Reavaliação: Última ${format(alert.patient.lastAssessmentAt.toDate(), "dd/MM/yy")}` : 'Reavaliação: Nunca avaliado')
                    : 'Evolução Pendente'}
                  </p>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl group-hover:bg-amber-400 group-hover:text-amber-950 transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-950" />
                </div>
              </div>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-700 rounded-[2rem] bg-slate-800/50">
                <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center mb-4">
                  <UserCheck className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-base font-black text-slate-400">Sem pendências</p>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1 max-w-[150px]">Nenhuma reavaliação ou evolução pendente no momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ViewConductModal 
        isOpen={!!selectedConductApp} 
        onClose={() => setSelectedConductApp(null)} 
        appointment={selectedConductApp} 
      />
    </div>
  );
}
