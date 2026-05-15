import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { doc, updateDoc, getDocs, collection, query } from 'firebase/firestore';
import { Patient, Clinic, ServiceType } from '../../types';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

const SERVICE_DEFAULTS: Record<ServiceType, number> = {
  'FISIOTERAPIA': 350,
  'TERAPIA_OCUPACIONAL': 350,
  'FONOAUDIOLOGIA': 350,
  'MEDICINA': 350,
  'PSICOLOGIA': 350
};

export default function EditPatientModal({ isOpen, onClose, patient }: EditPatientModalProps) {
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
    if (patient) {
      setFormData({
        name: patient.name,
        email: patient.email || '',
        phone: patient.phone || '',
        clinicId: patient.clinicId,
        birthDate: patient.birthDate || '',
        serviceTypes: patient.serviceTypes || (patient.serviceType ? [patient.serviceType] : []),
        serviceValue: patient.serviceValue?.toString() || ''
      });
    }
  }, [patient]);

  useEffect(() => {
    const fetchClinics = async () => {
      const snap = await getDocs(query(collection(db, 'clinics')));
      setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
    };
    if (isOpen) fetchClinics();
  }, [isOpen]);

  const toggleServiceType = (type: ServiceType) => {
    setFormData(prev => {
      const isSelected = prev.serviceTypes.includes(type);
      const newTypes = isSelected 
        ? prev.serviceTypes.filter(t => t !== type)
        : [...prev.serviceTypes, type];
      
      const suggestedValue = newTypes.length > 0 
        ? Math.max(...newTypes.map(t => SERVICE_DEFAULTS[t]))
        : '';
        
      return {
        ...prev,
        serviceTypes: newTypes,
        serviceValue: prev.serviceValue && !isSelected ? prev.serviceValue : suggestedValue.toString()
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'patients', patient.id), {
        ...formData,
        serviceType: formData.serviceTypes[0] || '', // fallback
        serviceValue: Number(formData.serviceValue)
      });
      onClose();
    } catch (err) {
      console.error("Error updating patient:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Editar Cadastro de Paciente">
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
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-800/50'
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
              Valor do Atendimento (R$)
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
                Unidade / Clínica *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.clinicId}
                onChange={(e) => setFormData({ ...formData, clinicId: e.target.value })}
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
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
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Atualizar Dados'
          )}
        </button>
      </form>
    </BaseModal>
  );
}
