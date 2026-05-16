import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Patient, Clinic } from '../../types';

interface NewFinancialRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewFinancialRecordModal({ isOpen, onClose }: NewFinancialRecordModalProps) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clinicId: '',
    patientId: '',
    type: 'income' as 'income' | 'outcome',
    amount: '',
    description: '',
    status: 'paid' as 'paid' | 'pending'
  });

  useEffect(() => {
    if (!isOpen || !profile) return;
    
    const fetchData = async () => {
      // Fetch Clinics
      const cq = query(collection(db, 'clinics'));
      const cSnap = await getDocs(cq);
      const allClinics = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
      const filteredClinics = allClinics.filter(c => profile.role === 'ADM_SISTEMA' || profile.role === 'SUPER_GESTOR' || profile.clinics.includes(c.id));
      setClinics(filteredClinics);

      // Fetch Patients
      if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR' && (!profile.clinics || profile.clinics.length === 0)) {
        setPatients([]);
      } else {
        let pq = query(collection(db, 'patients'));
        if (profile.role !== 'ADM_SISTEMA' && profile.role !== 'SUPER_GESTOR') {
          pq = query(pq, where('clinicId', 'in', profile.clinics));
        }
        const pSnap = await getDocs(pq);
        const patientsData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
        patientsData.sort((a, b) => a.name.localeCompare(b.name));
        setPatients(patientsData);
      }

      if (filteredClinics.length === 1) {
        setFormData(prev => ({ ...prev, clinicId: filteredClinics[0].id }));
      }
    };

    fetchData();
  }, [isOpen, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.clinicId || !formData.description) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'financial'), {
        ...formData,
        amount: Number(formData.amount),
        date: serverTimestamp()
      });
      onClose();
      setFormData({
        clinicId: clinics.length === 1 ? clinics[0].id : '',
        patientId: '',
        type: 'income',
        amount: '',
        description: '',
        status: 'paid'
      });
    } catch (err) {
      console.error("Error creating financial record:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Nova Transação Financeira">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Tipo *
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    formData.type === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'outcome' })}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    formData.type === 'outcome' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Saída
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Valor (R$) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Descrição / Categoria *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
              placeholder="Ex: Mensalidade, Aluguel, Equipamento..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Unidade *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.clinicId}
                onChange={(e) => setFormData({ ...formData, clinicId: e.target.value })}
              >
                <option value="">Selecione</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Status *
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'paid' | 'pending' })}
              >
                <option value="paid">Confirmado</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>

          {formData.type === 'income' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Paciente (Opcional)
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              >
                <option value="">Nenhum</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          disabled={loading}
          type="submit"
          className={`w-full py-4 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2 ${
            formData.type === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'
          }`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            `Registrar ${formData.type === 'income' ? 'Receita' : 'Despesa'}`
          )}
        </button>
      </form>
    </BaseModal>
  );
}
