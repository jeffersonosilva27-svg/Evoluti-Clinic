export type UserRole = 'ADM_SISTEMA' | 'GESTOR' | 'PROFISSIONAL' | 'RECEPCIONISTA' | 'PENDING';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status?: 'pending' | 'approved' | 'rejected';
  clinics: string[];
  profession?: string;
  phone?: string;
  professionalRegistry?: string;
  createdAt: any;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
}

export type ServiceType = 'FISIOTERAPIA' | 'TERAPIA_OCUPACIONAL' | 'FONOAUDIOLOGIA' | 'MEDICINA' | 'PSICOLOGIA';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  serviceType: ServiceType;
  createdAt: any;
}

export interface PatientExercise {
  exerciseId: string;
  instructions: string;
  frequency: string;
  addedAt: any;
}

export interface Patient {
  id: string;
  name: string;
  clinicId: string;
  birthDate: string;
  phone: string;
  email: string;
  lastAssessmentAt: any;
  sessionCountSinceAssessment: number;
  serviceTypes?: ServiceType[];
  serviceType?: ServiceType; // Keeping for backwards compat during transition
  serviceValue: number;
}

export interface Appointment {
  id: string;
  date: any; // Firestore Timestamp
  clinicId: string;
  professionalId: string;
  patientId: string;
  status: 'scheduled' | 'attended' | 'completed' | 'cancelled';
  type?: string;
  room?: string;
  duration?: number;
  patientName?: string;
  professionalName?: string;
}

export interface Evolution {
  id: string;
  patientId: string;
  clinicId: string;
  professionalId: string;
  date: any;
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

export interface FinancialRecord {
  id: string;
  patientId?: string;
  clinicId: string;
  date: any;
  amount: number;
  type: 'income' | 'outcome';
  description: string;
  status: 'paid' | 'pending';
}
