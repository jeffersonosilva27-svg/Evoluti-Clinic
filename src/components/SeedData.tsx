import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Beaker, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function SeedData() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const seed = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Create Clinics
      let vidaClinicId = '';
      
      try {
        const vidaRef = await addDoc(collection(db, 'clinics'), {
          name: 'VIDA 4.0 - Unidade Principal',
          address: 'Av. das Nações, 500',
          active: true
        });
        vidaClinicId = vidaRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'clinics');
      }

      // Update user profile
      try {
        await setDoc(doc(db, 'users', profile.uid), {
          ...profile,
          clinics: [...(profile.clinics || []), vidaClinicId],
          role: 'ADM_SISTEMA'
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      }

      // 2. Create 10 Professionals
      const professionalNames = [
        "Dr. Carlos Mendes", "Dra. Ana Silva", "Dr. Roberto Nunes",
        "Dra. Fernanda Lira", "Dr. Marcos Pontes", "Dra. Juliana Costa",
        "Dr. Tiago Farias", "Dra. Luiza Castro", "Dr. Bruno Alves", "Dra. Camila Rocha"
      ];
      
      const professionalIds: string[] = [];
      const specialties = ['FISIOTERAPIA', 'PSICOLOGIA', 'MEDICINA', 'FONOAUDIOLOGIA', 'TERAPIA_OCUPACIONAL'] as const;

      for (let i = 0; i < 10; i++) {
        const uid = `prof_mock_${i}_${Date.now()}`;
        await setDoc(doc(db, 'users', uid), {
          uid,
          name: professionalNames[i],
          email: `prof${i}@example.com`,
          role: 'PROFISSIONAL',
          profession: specialties[i % specialties.length],
          clinics: [vidaClinicId],
          createdAt: new Date()
        });
        professionalIds.push(uid);
      }

      // 3. Create 1 Receptionist
      const recUid = `rec_mock_${Date.now()}`;
      await setDoc(doc(db, 'users', recUid), {
        uid: recUid,
        name: 'Maria Clara (Recepção)',
        email: 'recepcao@example.com',
        role: 'RECEPCIONISTA',
        clinics: [vidaClinicId],
        createdAt: new Date()
      });

      // 4. Create 10 Patients
      const patientNames = [
        "Lucas Pereira", "Beatriz Lima", "Gabriel Moura", "Sofia Albuquerque",
        "Matheus Vargas", "Laura Moraes", "Enzo Ribeiro", "Valentina Nogueira",
        "João Gabriel Santos", "Isabella Martins"
      ];
      const patientIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const ptRef = await addDoc(collection(db, 'patients'), {
          name: patientNames[i],
          clinicId: vidaClinicId,
          phone: `(11) 98888-000${i}`,
          email: `paciente${i}@example.com`,
          birthDate: '1990-01-01',
          sessionCountSinceAssessment: Math.floor(Math.random() * 10),
          serviceTypes: [specialties[i % 5]],
          serviceType: specialties[i % 5],
          serviceValue: 150 + (i * 10),
          lastAssessmentAt: new Date(Date.now() - (Math.random() * 60) * 24 * 60 * 60 * 1000)
        });
        patientIds.push(ptRef.id);
      }

      // 5. Populate Appointments (Past and Future)
      const now = new Date();
      for (let dayOffset = -5; dayOffset <= 5; dayOffset++) {
        if (dayOffset === 0) continue; // Skip today to do it separately if we want, or just include
        
        // Add 3 appointments per day uniformly
        for (let j = 0; j < 3; j++) {
          const apptDate = new Date(now);
          apptDate.setDate(now.getDate() + dayOffset);
          apptDate.setHours(9 + j * 2, 0, 0, 0); // 9:00, 11:00, 13:00
          
          const ptIdx = Math.floor(Math.random() * 10);
          const profIdx = Math.floor(Math.random() * 10);

          await addDoc(collection(db, 'appointments'), {
            date: apptDate,
            clinicId: vidaClinicId,
            professionalId: professionalIds[profIdx],
            patientId: patientIds[ptIdx],
            patientName: patientNames[ptIdx],
            professionalName: professionalNames[profIdx],
            status: dayOffset < 0 ? 'completed' : 'scheduled',
            type: 'Sessão Normal'
          });
        }
      }

      // Also add some for today
      for (let j = 0; j < 5; j++) {
        const apptDate = new Date(now);
        apptDate.setHours(8 + j * 2, 0, 0, 0);
        const ptIdx = j * 2;
        const profIdx = j;

        await addDoc(collection(db, 'appointments'), {
          date: apptDate,
          clinicId: vidaClinicId,
          professionalId: professionalIds[profIdx],
          patientId: patientIds[ptIdx],
          patientName: patientNames[ptIdx],
          professionalName: professionalNames[profIdx],
          status: j < 2 ? 'completed' : 'scheduled',
          type: 'Consulta'
        });
      }

      alert("10 Pacientes, 10 Profissionais, 1 Recepção e Agenda populada com sucesso! Recarregue a página.");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Erro ao criar dados.");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={seed}
      disabled={loading}
      className="fixed bottom-6 right-6 p-4 bg-slate-900 text-white rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all z-50 group"
    >
      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Beaker className="w-5 h-5" />}
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap text-sm font-bold pl-2">
        Simular Dados de Teste
      </span>
    </button>
  );
}
