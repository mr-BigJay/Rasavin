export interface Patient {
  id: string;
  name: string;
  phone: string;
  note: string;
  createdAt: string;
}
export interface Service {
  id: string;
  title: string;
  price: number;
  description: string;
}
export interface Visit {
  id: string;
  patientId: string;
  serviceId: string;
  amount: number;
  date: string;
  note: string;
}
export interface Payment {
  id: string;
  patientId: string;
  amount: number;
  method: string;
  date: string;
  note: string;
}
export interface Followup {
  id: string;
  patientId: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'done';
}
export interface Snapshot {
  patients: Patient[];
  services: Service[];
  visits: Visit[];
  payments: Payment[];
  followups: Followup[];
  clinicName: string;
}
export type NewPatient = Pick<Patient, 'name' | 'phone' | 'note'>;
export type NewService = Pick<Service, 'title' | 'price' | 'description'>;
export type NewVisit = Pick<Visit, 'patientId' | 'serviceId' | 'amount' | 'note'>;
export type NewPayment = Pick<Payment, 'patientId' | 'amount' | 'method' | 'note'>;
export type NewFollowup = Pick<Followup, 'patientId' | 'title' | 'dueDate'>;
