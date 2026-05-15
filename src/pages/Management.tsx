import React, { useState, useEffect } from "react";
import {
  Building2,
  UserPlus,
  Users,
  MapPin,
  Phone,
  Mail,
  PlusCircle,
  UserCog,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { Clinic, UserProfile } from "../types";
import NewClinicModal from "../components/modals/NewClinicModal";
import NewProfessionalModal from "../components/modals/NewProfessionalModal";
import EditClinicModal from "../components/modals/EditClinicModal";
import EditProfessionalModal from "../components/modals/EditProfessionalModal";
import { useAuth } from "../contexts/AuthContext";
import {
  handleFirestoreError,
  OperationType,
} from "../lib/firestoreErrorHandler";

export default function Management({
  activeSubTab,
}: {
  activeSubTab?: "units" | "team";
}) {
  const { profile } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [professionals, setProfessionals] = useState<UserProfile[]>([]);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showProfModal, setShowProfModal] = useState(false);

  // Set initial based on prop, or if not provided default to clinics
  const [internalTab, setInternalTab] = useState<"clinics" | "professionals">(
    "clinics",
  );
  const activeTab =
    activeSubTab === "team"
      ? "professionals"
      : activeSubTab === "units"
        ? "clinics"
        : internalTab;

  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [selectedProfessional, setSelectedProfessional] =
    useState<UserProfile | null>(null);

  const [deletingClinic, setDeletingClinic] = useState<string | null>(null);
  const [deletingProfessional, setDeletingProfessional] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!profile) return;

    let clinicsQuery = query(collection(db, "clinics"));
    let usersQuery = query(collection(db, "users"));

    if (profile.role !== "ADM_SISTEMA") {
      if (profile.clinics && profile.clinics.length > 0) {
        const clinicIds = profile.clinics.slice(0, 10);
        clinicsQuery = query(
          collection(db, "clinics"),
          where(documentId(), "in", clinicIds),
        );
        usersQuery = query(
          collection(db, "users"),
          where("clinics", "array-contains-any", clinicIds),
        );
      } else {
        setClinics([]);
        setProfessionals([]);
        return;
      }
    }

    const unsubClinics = onSnapshot(
      clinicsQuery,
      (snap) => {
        setClinics(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Clinic),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "clinics");
      },
    );

    const unsubProfs = onSnapshot(
      usersQuery,
      (snap) => {
        setProfessionals(
          snap.docs.map(
            (doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "users");
      },
    );

    return () => {
      unsubClinics();
      unsubProfs();
    };
  }, [profile]);

  const confirmDeleteClinic = async (id: string) => {
    setDeletingClinic(id);
  };

  const executeDeleteClinic = async (id: string) => {
    try {
      await deleteDoc(doc(db, "clinics", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `clinics/${id}`);
    } finally {
      setDeletingClinic(null);
    }
  };

  const confirmDeleteProfessional = async (uid: string) => {
    setDeletingProfessional(uid);
  };

  const executeDeleteProfessional = async (uid: string) => {
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${uid}`);
    } finally {
      setDeletingProfessional(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UserCog className="w-8 h-8 text-indigo-500" />
            Gestão da Rede
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie unidades, profissionais e permissões de acesso.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "clinics" ? (
            <button
              onClick={() => setShowClinicModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              <PlusCircle className="w-4 h-4" />
              Nova Unidade
            </button>
          ) : (
            <button
              onClick={() => setShowProfModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              <UserPlus className="w-4 h-4" />
              Novo Profissional
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      {!activeSubTab && (
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setInternalTab("clinics")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === "clinics"
                ? "bg-white text-brand-primary shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Unidades
          </button>
          <button
            onClick={() => setInternalTab("professionals")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === "professionals"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="w-4 h-4" />
            Profissionais
          </button>
        </div>
      )}

      {activeTab === "clinics" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center border border-indigo-100">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedClinic(clinic)}
                      className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => confirmDeleteClinic(clinic.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {deletingClinic === clinic.id && (
                        <div className="absolute right-0 top-10 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-10 w-48 flex flex-col gap-2">
                          <p className="text-[10px] font-bold text-slate-600 text-center leading-tight">
                            Apagar esta unidade?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingClinic(null);
                              }}
                              className="flex-1 py-1.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest"
                            >
                              Não
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                executeDeleteClinic(clinic.id);
                              }}
                              className="flex-1 py-1.5 bg-rose-500 text-white rounded text-[9px] font-black uppercase tracking-widest"
                            >
                              Sim
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-4">
                  {clinic.name}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-slate-400">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">
                      {clinic.address || "Endereço não cadastrado"}
                    </p>
                  </div>
                  {clinic.phone && (
                    <div className="flex items-center gap-3 text-slate-400">
                      <Phone className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-bold">{clinic.phone}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span
                  className={`px-3 py-1 text-[9px] font-black rounded-full border uppercase tracking-widest ${clinic.active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
                >
                  {clinic.active ? "Ativa" : "Inativa"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {professionals.filter((p) => p.status === "pending").length > 0 && (
            <div>
              <h2 className="text-sm font-black text-amber-600 uppercase tracking-widest mb-4">
                Acessos Pendentes (
                {professionals.filter((p) => p.status === "pending").length})
              </h2>
              <div className="bg-amber-50/30 rounded-[2rem] border border-amber-100 shadow-sm overflow-hidden flex flex-col p-6 gap-3">
                {professionals
                  .filter((p) => p.status === "pending")
                  .map((prof) => (
                    <div
                      key={prof.uid}
                      className="bg-white hover:bg-amber-50/50 transition-colors p-5 rounded-3xl border border-amber-100 flex flex-col md:flex-row md:items-center gap-6 justify-between group"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 font-black text-lg uppercase shadow-sm">
                          {prof.name.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-800">
                            {prof.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 font-bold">
                            <Mail className="w-3.5 h-3.5" />
                            {prof.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-1.5 md:flex-row md:items-center md:gap-4 md:flex-1">
                        <div className="md:w-px md:h-10 bg-amber-100 mx-2 hidden md:block" />
                        <div className="flex flex-col">
                          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200 w-fit">
                            ACESSO PENDENTE
                          </span>
                          <div className="mt-2 flex items-center gap-2">
                            {prof.profession && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                {prof.profession}
                              </span>
                            )}
                            {prof.professionalRegistry && (
                              <span className="text-[9px] font-bold text-slate-400">
                                Reg: {prof.professionalRegistry}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right mt-2 md:mt-0">
                        <button
                          onClick={() => setSelectedProfessional(prof)}
                          className="px-5 py-3 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          Avaliar Solicitação
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">
              Equipe Ativa
            </h2>
            <div className="bg-slate-50/50 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col p-6 gap-3">
              {professionals
                .filter((p) => p.status !== "pending")
                .map((prof) => (
                  <div
                    key={prof.uid}
                    className="bg-white hover:bg-slate-50 transition-colors p-5 rounded-3xl border border-slate-200 flex flex-col md:flex-row md:items-center gap-6 justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg uppercase shadow-inner group-hover:bg-brand-primary group-hover:text-white transition-all">
                        {prof.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-800">
                          {prof.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-bold">
                          <Mail className="w-3.5 h-3.5" />
                          {prof.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 flex-1">
                      <div className="hidden md:block w-px h-10 bg-slate-100 mx-2" />
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                            prof.role === "ADM_SISTEMA"
                              ? "bg-purple-50 text-purple-600 border-purple-100"
                              : prof.role === "GESTOR"
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : prof.role === "RECEPCIONISTA"
                                  ? "bg-orange-50 text-orange-600 border-orange-100"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          {prof.role === "ADM_SISTEMA"
                            ? "ADM DE SISTEMA"
                            : prof.role.replace("_", " ")}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          {prof.profession && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                              {prof.profession}
                            </span>
                          )}
                          {prof.professionalRegistry && (
                            <span className="text-[9px] font-bold text-slate-400">
                              Reg: {prof.professionalRegistry}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden lg:block w-px h-10 bg-slate-100 mx-2" />

                      <div className="flex flex-col items-start">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          Unidades
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {prof.clinics.length > 0 ? (
                            prof.clinics.map((cid) => (
                              <span
                                key={cid}
                                className="px-2 py-1 bg-indigo-50 text-indigo-500 text-[10px] font-black rounded-lg border border-indigo-100"
                              >
                                {clinics.find((c) => c.id === cid)?.name ||
                                  cid.substring(0, 4)}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] italic text-slate-300">
                              Nenhuma
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-2 md:mt-0 ml-auto">
                      <button
                        onClick={() => setSelectedProfessional(prof)}
                        className="p-3 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => confirmDeleteProfessional(prof.uid)}
                          className="p-3 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {deletingProfessional === prof.uid && (
                          <div className="absolute right-0 top-12 bg-white border border-slate-200 shadow-xl rounded-2xl p-4 z-10 w-56 flex flex-col gap-3">
                            <p className="text-[11px] font-black text-slate-700 text-center uppercase tracking-widest leading-tight">
                              Apagar Profissional?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingProfessional(null);
                                }}
                                className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest"
                              >
                                Não
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  executeDeleteProfessional(prof.uid);
                                }}
                                className="flex-1 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                              >
                                Sim
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <NewClinicModal
        isOpen={showClinicModal}
        onClose={() => setShowClinicModal(false)}
      />
      <NewProfessionalModal
        isOpen={showProfModal}
        onClose={() => setShowProfModal(false)}
      />
      <EditClinicModal
        isOpen={!!selectedClinic}
        onClose={() => setSelectedClinic(null)}
        clinic={selectedClinic}
      />
      <EditProfessionalModal
        isOpen={!!selectedProfessional}
        onClose={() => setSelectedProfessional(null)}
        professional={selectedProfessional}
      />
    </div>
  );
}
