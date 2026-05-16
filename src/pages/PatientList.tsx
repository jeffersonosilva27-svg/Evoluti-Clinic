import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  ExternalLink,
  UserPlus,
  Phone,
  Mail,
  Filter,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { Patient } from "../types";
import { useAuth } from "../contexts/AuthContext";
import NewPatientModal from "../components/modals/NewPatientModal";
import EditPatientModal from "../components/modals/EditPatientModal";
import { Edit2 } from "lucide-react";
import { differenceInDays } from "date-fns";

export default function PatientList({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Fetch Clinics for names mapping
    const fetchClinics = async () => {
      const snap = await getDocs(collection(db, "clinics"));
      const mapping: Record<string, string> = {};
      snap.docs.forEach((doc) => (mapping[doc.id] = doc.data().name));
      setClinics(mapping);
    };
    fetchClinics();

    let q = query(collection(db, "patients"));

    if (profile.role !== "ADM_SISTEMA" && profile.role !== "SUPER_GESTOR") {
      if (profile.clinics && profile.clinics.length > 0) {
        q = query(q, where("clinicId", "in", profile.clinics));
      } else {
        setPatients([]);
        return;
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Patient,
        );
        docs.sort((a, b) => a.name.localeCompare(b.name));
        setPatients(docs);
      },
      (err) => {
        console.error("Error fetching patients:", err);
      },
    );

    return () => unsubscribe();
  }, [profile]);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Pacientes
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Gestão centralizada de prontuários clínicos.
          </p>
        </div>
        {profile?.role !== "PROFISSIONAL" && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20"
          >
            <UserPlus className="w-4 h-4" />
            Novo Paciente
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 mb-4 rounded-t-[2rem]">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              className="w-full pl-13 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-3 px-6 py-4 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all text-xs font-black uppercase tracking-widest shadow-sm">
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="group bg-white border border-slate-200 hover:border-brand-primary/40 hover:shadow-md transition-all rounded-3xl p-5 cursor-pointer flex flex-col md:flex-row gap-6 md:items-center justify-between"
              onClick={() => onSelect(patient.id)}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 text-lg font-black group-hover:scale-105 transition-transform shrink-0">
                  {patient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-slate-800 leading-tight group-hover:text-brand-primary transition-colors truncate">
                    {patient.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      REF: {patient.id.substring(0, 8)}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 truncate">
                      {clinics[patient.clinicId] || "Carregando..."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="hidden lg:block w-px h-10 bg-slate-100 mx-2"></div>
                <div className="flex flex-col items-start min-w-[140px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 mt-1 lg:mt-0">
                    Serviço
                  </span>
                  <p className="text-xs font-black text-slate-700 uppercase leading-tight truncate max-w-[150px]">
                    {patient.serviceTypes && patient.serviceTypes.length > 0
                      ? patient.serviceTypes.join(", ")
                      : patient.serviceType || "Não definido"}
                  </p>
                  <p className="text-xs font-black text-emerald-600 mt-1">
                    R$ {patient.serviceValue?.toFixed(2) || "0,00"}
                  </p>
                </div>

                <div className="hidden lg:block w-px h-10 bg-slate-100 mx-2"></div>

                <div className="flex flex-col items-start min-w-[120px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-2 lg:mt-0">
                    Status
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl w-fit ${
                      patient.sessionCountSinceAssessment > 10 ||
                      !patient.lastAssessmentAt ||
                      (patient.lastAssessmentAt &&
                        differenceInDays(
                          new Date(),
                          patient.lastAssessmentAt.toDate(),
                        ) > 30)
                        ? "text-amber-700 bg-amber-100"
                        : "text-brand-primary bg-emerald-50 border border-emerald-100"
                    }`}
                  >
                    {patient.sessionCountSinceAssessment > 10 ||
                    !patient.lastAssessmentAt ||
                    (patient.lastAssessmentAt &&
                      differenceInDays(
                        new Date(),
                        patient.lastAssessmentAt.toDate(),
                      ) > 30)
                      ? "Reavaliar"
                      : "Em dia"}
                  </span>
                </div>

                <div className="flex gap-2 ml-auto lg:ml-4">
                  {profile?.role !== "PROFISSIONAL" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPatient(patient);
                        setShowEditModal(true);
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onSelect(patient.id)}
                    className="p-3 bg-white border border-slate-200 rounded-xl transition-all text-slate-400 shadow-sm group-hover:bg-brand-primary group-hover:border-brand-primary group-hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredPatients.length === 0 && (
            <div className="p-16 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-black text-sm">
                Nenhum paciente encontrado.
              </p>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                Refine sua busca ou adicione um novo
              </p>
            </div>
          )}
        </div>
      </div>

      <NewPatientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
      {selectedPatient && (
        <EditPatientModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
        />
      )}
    </div>
  );
}
