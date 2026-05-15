import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { collection, setDoc, doc, getDocs, query } from 'firebase/firestore';
import { Clinic, UserProfile } from '../../types';

interface NewProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewProfessionalModal({ isOpen, onClose }: NewProfessionalModalProps) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'PROFISSIONAL' as UserProfile['role'],
    profession: '',
    customProfession: '',
    professionalRegistry: '',
    selectedClinics: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClinics = async () => {
      const snap = await getDocs(query(collection(db, 'clinics')));
      setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
    };
    if (isOpen) fetchClinics();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || formData.selectedClinics.length === 0) return;

    setLoading(true);
    try {
      const professionalId = formData.email.replace(/[^a-zA-Z0-9]/g, '_');
      
      const userProfession = formData.profession === 'OUTRO' ? formData.customProfession : formData.profession;

      await setDoc(doc(db, 'users', professionalId), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        profession: userProfession,
        professionalRegistry: formData.professionalRegistry,
        clinics: formData.selectedClinics,
        active: true,
        createdAt: new Date()
      });
      
      onClose();
      setFormData({ name: '', email: '', role: 'PROFISSIONAL', profession: '', customProfession: '', professionalRegistry: '', selectedClinics: [] });
    } catch (err) {
      console.error("Error creating professional:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleClinic = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedClinics: prev.selectedClinics.includes(id)
        ? prev.selectedClinics.filter(c => c !== id)
        : [...prev.selectedClinics, id]
    }));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Novo Profissional">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Nome Completo *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              placeholder="Nome do profissional"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              E-mail *
            </label>
            <input
              required
              type="email"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              placeholder="profissional@clinicasync.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1 font-black">
              Função / Cargo
            </label>
            <select
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <option value="PROFISSIONAL">Profissional de Saúde</option>
              <option value="GESTOR">Gestor de Unidade</option>
              <option value="ADM_SISTEMA">Adm de Sistema (Todas as Unidades)</option>
              <option value="RECEPCIONISTA">Recepcionista</option>
            </select>
          </div>

          {(formData.role === 'PROFISSIONAL' || formData.role === 'GESTOR') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Profissão *
                </label>
                <select
                  required={formData.role === 'PROFISSIONAL'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  <option value="Fisioterapeuta">Fisioterapeuta</option>
                  <option value="Terapeuta Ocupacional">Terapeuta Ocupacional</option>
                  <option value="Médico">Médico</option>
                  <option value="Psicólogo">Psicólogo</option>
                  <option value="Fonoaudiólogo">Fonoaudiólogo</option>
                  <option value="OUTRO">Outra...</option>
                </select>
              </div>

              {formData.profession === 'OUTRO' && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                    Qual? *
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all"
                    value={formData.customProfession}
                    onChange={(e) => setFormData({ ...formData, customProfession: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Registro Profissional (CRM/CREFITO/etc)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all"
                  placeholder="00000"
                  value={formData.professionalRegistry}
                  onChange={(e) => setFormData({ ...formData, professionalRegistry: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1 font-black">
              Vínculo com Unidades *
            </label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {clinics.map(clinic => (
                <button
                  key={clinic.id}
                  type="button"
                  onClick={() => toggleClinic(clinic.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    formData.selectedClinics.includes(clinic.id) 
                    ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' 
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-black uppercase">{clinic.name}</span>
                  {formData.selectedClinics.includes(clinic.id) && (
                    <div className="w-2 h-2 bg-brand-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Salvar Profissional'
          )}
        </button>
      </form>
    </BaseModal>
  );
}
