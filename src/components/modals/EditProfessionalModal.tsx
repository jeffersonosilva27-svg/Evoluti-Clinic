import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { doc, updateDoc, collection, getDocs, query } from 'firebase/firestore';
import { Clinic, UserProfile } from '../../types';

interface EditProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  professional: UserProfile | null;
}

export default function EditProfessionalModal({ isOpen, onClose, professional }: EditProfessionalModalProps) {
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

  useEffect(() => {
    if (professional) {
      const isCustomProfession = professional.profession && !['Fisioterapeuta', 'Terapeuta Ocupacional', 'Médico', 'Psicólogo', 'Fonoaudiólogo'].includes(professional.profession);
      
      setFormData({
        name: professional.name || '',
        email: professional.email || '',
        role: (professional.role === 'PENDING' ? 'PROFISSIONAL' : professional.role) || 'PROFISSIONAL',
        profession: isCustomProfession ? 'OUTRO' : (professional.profession || ''),
        customProfession: isCustomProfession ? professional.profession : '',
        professionalRegistry: professional.professionalRegistry || '',
        selectedClinics: professional.clinics || []
      });
    }
  }, [professional]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || formData.selectedClinics.length === 0 || !professional) return;

    setLoading(true);
    try {
      const userProfession = formData.profession === 'OUTRO' ? formData.customProfession : formData.profession;

      await updateDoc(doc(db, 'users', professional.uid), {
        name: formData.name,
        role: formData.role,
        profession: userProfession,
        professionalRegistry: formData.professionalRegistry,
        clinics: formData.selectedClinics,
        status: 'approved'
      });
      
      onClose();
    } catch (err) {
      console.error("Error updating professional:", err);
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

  if (!professional) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Editar Profissional">
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
              E-mail (Não alterável)
            </label>
            <input
              disabled
              type="email"
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 outline-none cursor-not-allowed"
              value={formData.email}
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
                  Registro Profissional
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all"
                  placeholder="CRM/CREFITO..."
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
            'Salvar Alterações'
          )}
        </button>
      </form>
    </BaseModal>
  );
}
