import React, { useState, useEffect } from "react";
import {
  format,
  addDays,
  startOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar as CalendarIcon,
  Filter,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { Appointment, UserProfile } from "../types";
import NewAppointmentModal from "./modals/NewAppointmentModal";
import AppointmentActionModal from "./modals/AppointmentActionModal";

export default function Agenda({
  selectedClinic,
}: {
  selectedClinic: string | null;
}) {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  // Fetch Professionals for the clinic(s)
  useEffect(() => {
    if (!profile) return;

    let q = query(
      collection(db, "users"),
      where("role", "in", ["PROFISSIONAL", "GESTOR"]),
    );

    // Filter by clinic in query if not super gestor
    if (profile.role !== "ADM_SISTEMA" && profile.role !== "SUPER_GESTOR") {
      if (!profile.clinics || profile.clinics.length === 0) {
        setProfessionals([]);
        setLoading(false);
        return;
      }
      q = query(q, where("clinics", "array-contains-any", profile.clinics));
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const found = snap.docs.map(
          (doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile,
        );

        // Secondary client-side filter just in case
        const filtered = found.filter((p) => {
          if (profile.role === "ADM_SISTEMA") return true;
          return p.clinics.some((c) => profile.clinics.includes(c));
        });

        // Priority Sorting: Current user always first
        const sorted = filtered.sort((a, b) => {
          if (a.uid === profile.uid) return -1;
          if (b.uid === profile.uid) return 1;
          return a.name.localeCompare(b.name);
        });

        setProfessionals(sorted);
      },
      (err) => {
        console.error("Error fetching professionals:", err);
      },
    );

    return () => unsubscribe();
  }, [profile]);

  // Fetch Appointments
  useEffect(() => {
    if (!profile) return;

    let q = query(
      collection(db, "appointments"),
      where("date", ">=", startOfMonth(currentDate)),
      where("date", "<=", endOfMonth(currentDate)),
    );

    // Filter by clinic
    if (selectedClinic) {
      q = query(q, where("clinicId", "==", selectedClinic));
    } else if (profile.role !== "ADM_SISTEMA" && profile.role !== "SUPER_GESTOR") {
      // If no clinic selected, filter by all accessible clinics
      if (profile.clinics.length > 0) {
        q = query(q, where("clinicId", "in", profile.clinics));
      } else {
        // No clinics = no access to appointments
        setAppointments([]);
        setLoading(false);
        return;
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Appointment,
        );
        setAppointments(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching appointments:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [currentDate, profile, selectedClinic]);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Visão Geral da Semana
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-brand-primary"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"
            >
              Hoje
            </button>
            <button
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-brand-primary"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Filtrar Equipe
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Header: Days of the Week */}
            <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-slate-50/50 border-b border-slate-100">
              <div className="p-5 border-r border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center">
                Profissional
              </div>
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`p-5 flex flex-col items-center justify-center border-r border-slate-100 last:border-r-0 ${
                    isSameDay(day, new Date()) ? "bg-brand-primary/5" : ""
                  }`}
                >
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    {format(day, "EEEE", { locale: ptBR })}
                  </span>
                  <span
                    className={`text-lg font-black ${isSameDay(day, new Date()) ? "text-brand-primary" : "text-slate-800"}`}
                  >
                    {format(day, "dd/MM")}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows: Professionals */}
            <div className="divide-y divide-slate-100">
              {professionals.map((pro) => (
                <div
                  key={pro.uid}
                  className="grid grid-cols-[200px_repeat(7,1fr)] min-h-[160px] group"
                >
                  {/* Pro Info Column */}
                  <div
                    className={`p-6 border-r border-slate-100 flex flex-col items-center justify-center text-center gap-4 transition-colors ${
                      pro.uid === profile?.uid
                        ? "bg-brand-primary/5"
                        : "bg-white group-hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xl shadow-inner overflow-hidden group-hover:bg-brand-primary group-hover:text-white transition-all">
                      {pro.uid === profile?.uid ? (
                        <div className="w-full h-full bg-brand-primary text-white flex items-center justify-center text-xs uppercase tracking-widest">
                          VOCÊ
                        </div>
                      ) : (
                        pro.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 leading-tight">
                        {pro.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {pro.role.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  {/* Days Cells */}
                  {weekDays.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`p-3 border-r border-slate-100 last:border-r-0 relative hover:bg-slate-50/50 transition-colors flex flex-col gap-2 overflow-y-auto max-h-[250px] custom-scrollbar ${
                        isSameDay(day, new Date()) ? "bg-blue-50/5" : ""
                      }`}
                    >
                      {appointments
                        .filter((app) => {
                          const appDate = app.date.toDate();
                          return (
                            isSameDay(appDate, day) &&
                            app.professionalId === pro.uid
                          );
                        })
                        .sort(
                          (a, b) =>
                            a.date.toDate().getTime() -
                            b.date.toDate().getTime(),
                        )
                        .map((app) => (
                          <div
                            key={app.id}
                            onClick={() => {
                              setSelectedAppointment(app);
                              setShowActionModal(true);
                            }}
                            className={`flex flex-col p-2.5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md ${
                              app.room === "Transito"
                                ? "bg-amber-50 text-amber-700 border-amber-200 opacity-80 border-dashed"
                                : app.status === "completed"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-100 opacity-60"
                                  : app.status === "cancelled"
                                    ? "bg-slate-100 text-slate-400 border-slate-200 line-through"
                                    : app.professionalId === profile?.uid
                                      ? "bg-white text-blue-800 border-blue-100 ring-2 ring-blue-50"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            <div className="text-[10px] font-black leading-tight truncate">
                              {app.room === "Transito"
                                ? app.type
                                : app.patientName}
                            </div>
                            {app.room && app.room !== "Transito" && (
                              <div className="text-[8px] font-bold text-slate-500 mt-0.5 truncate uppercase">
                                {app.room === "Domiciliar" ? (
                                  <span className="text-amber-600">
                                    🏠 Domiciliar (±1h)
                                  </span>
                                ) : (
                                  <>📍 {app.room.split(" ")[0]}</>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1 text-[9px] font-bold opacity-60">
                                <Clock className="w-2.5 h-2.5" />
                                <span>
                                  {format(app.date.toDate(), "HH:mm")}
                                </span>
                              </div>
                              {app.room !== "Transito" && (
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    app.status === "attended"
                                      ? "bg-emerald-500"
                                      : "bg-brand-primary"
                                  }`}
                                />
                              )}
                            </div>
                          </div>
                        ))}

                      {/* Empty state hint on hover */}
                      {profile?.role !== 'PROFISSIONAL' && (
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="hidden group-hover:flex w-full py-2 border-2 border-dashed border-slate-200 rounded-xl items-center justify-center text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-all mt-auto"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <NewAppointmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
        />
      )}
    </div>
  );
}
