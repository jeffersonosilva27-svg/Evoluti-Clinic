import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Clinic } from '../../types';

interface EditClinicModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: Clinic | null;
}

export default function EditClinicModal({ isOpen, onClose, clinic }: EditClinicModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clinic) {
      setFormData({
        name: clinic.name || '',
        address: clinic.address || '',
        phone: clinic.phone || '',
        active: clinic.active !== false
      });
    }
  }, [clinic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !clinic) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'clinics', clinic.id), {
        ...formData
      });
      onClose();
    } catch (err) {
      console.error("Error updating clinic:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!clinic) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Editar Unidade">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Nome da Unidade *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              placeholder="Ex: Vida 4.0 - Morumbi"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Endereço
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              placeholder="Rua, Número, Bairro..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Telefone
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

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
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
