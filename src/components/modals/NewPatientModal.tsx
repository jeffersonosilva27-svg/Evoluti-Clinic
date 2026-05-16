import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Clinic, ServiceType } from '../../types';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERVICE_DEFAULTS: Record<ServiceType, number> = {
  'FISIOTERAPIA': 350,
  'TERAPIA_OCUPACIONAL': 350,
  'FONOAUDIOLOGIA': 350,
  'MEDICINA': 350,
  'PSICOLOGIA': 350
};

export default function NewPatientModal({ isOpen, onClose }: NewPatientModalProps) {
  const { profile } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    clinicId: '',
    birthDate: '',
    serviceTypes: [] as ServiceType[],
    serviceValue: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClinics = async () => {
      if (!profile) return;
      const q = query(collection(db, 'clinics'));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
      const filtered = all.filter(c => profile.role === 'ADM_SISTEMA' || profile.role === 'SUPER_GESTOR' || profile.clinics.includes(c.id));
      setClinics(filtered);
      if (filtered.length === 1) {
        setFormData(prev => ({ ...prev, clinicId: filtered[0].id }));
      }
    };
    if (isOpen) fetchClinics();
  }, [isOpen, profile]);

  const toggleServiceType = (type: ServiceType) => {
    setFormData(prev => {
      const isSelected = prev.serviceTypes.includes(type);
      const newTypes = isSelected 
        ? prev.serviceTypes.filter(t => t !== type)
        : [...prev.serviceTypes, type];
      
      // Calculate a default value based on first selected, or sum, or keep it simple.
      // Let's just set serviceValue based on max default value among selected types as a suggestion.
      const suggestedValue = newTypes.length > 0 
        ? Math.max(...newTypes.map(t => SERVICE_DEFAULTS[t]))
        : '';
        
      return {
        ...prev,
        serviceTypes: newTypes,
        serviceValue: prev.serviceValue && !isSelected ? prev.serviceValue : suggestedValue.toString() // only override if we just added and it was empty, actually let's just leave manual or set to max.
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.clinicId || formData.serviceTypes.length === 0) return;

    setLoading(true);
    try {
      // Create new patient document
      await addDoc(collection(db, 'patients'), {
        ...formData,
        serviceType: formData.serviceTypes[0], // fallback for old queries
        serviceValue: Number(formData.serviceValue),
        sessionCountSinceAssessment: 0,
        createdAt: serverTimestamp(),
        lastAssessmentAt: null
      });
      onClose();
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        clinicId: clinics.length === 1 ? clinics[0].id : '', 
        birthDate: '',
        serviceTypes: [],
        serviceValue: ''
      });
    } catch (err) {
      console.error("Error creating patient:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Cadastrar Novo Paciente">
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
              placeholder="Digite o nome completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Serviços / Especialidades *
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'FISIOTERAPIA', label: 'Fisioterapia' },
                { id: 'TERAPIA_OCUPACIONAL', label: 'Terapia Ocupacional' },
                { id: 'FONOAUDIOLOGIA', label: 'Fonoaudiologia' },
                { id: 'MEDICINA', label: 'Medicina' },
                { id: 'PSICOLOGIA', label: 'Psicologia' }
              ].map(srv => {
                const isSelected = formData.serviceTypes.includes(srv.id as ServiceType);
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => toggleServiceType(srv.id as ServiceType)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      isSelected 
                        ? 'bg-brand-primary text-white border-brand-primary' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-brand-primary/50'
                    }`}
                  >
                    {srv.label}
                  </button>
                )
              })}
            </div>
            {formData.serviceTypes.length === 0 && (
              <p className="text-xs text-rose-500 mt-1">Selecione pelo menos uma especialidade.</p>
            )}
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Valor / Mensalidade (R$)
            </label>
            <input
              required
              type="number"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              value={formData.serviceValue}
              onChange={(e) => setFormData({ ...formData, serviceValue: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                E-mail
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                placeholder="exemplo@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Telefone / WhatsApp
              </label>
              <input
                type="tel"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Unidade / Clínica *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.clinicId}
                onChange={(e) => setFormData({ ...formData, clinicId: e.target.value })}
              >
                <option value="">Selecione uma clínica</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Salvar Paciente'
          )}
        </button>
      </form>
    </BaseModal>
  );
}
