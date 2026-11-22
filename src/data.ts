import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import type {
  Snapshot, Patient, Service, Visit, Payment, Followup,
  NewPatient, NewService, NewVisit, NewPayment, NewFollowup
} from './types';

const DB_URL = 'sqlite:rasavin.db';
const blank = (): Snapshot => ({
  patients: [], services: [], visits: [], payments: [], followups: [], clinicName: 'مطب من'
});
let demo = blank();
let connection: Promise<Database> | undefined;
const db = () => (connection ??= Database.load(DB_URL));
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export const desktopMode = isTauri();

export async function snapshot(): Promise<Snapshot> {
  if (!desktopMode) return structuredClone(demo);
  const conn = await db();
  const [patients, services, visits, payments, followups, setting] = await Promise.all([
    conn.select<Patient[]>('SELECT id, full_name AS name, phone, note, created_at AS createdAt FROM patients ORDER BY created_at DESC'),
    conn.select<Service[]>('SELECT id, title, price, description FROM services ORDER BY title'),
    conn.select<Visit[]>('SELECT id, patient_id AS patientId, service_id AS serviceId, amount, created_at AS date, note FROM visits ORDER BY created_at DESC'),
    conn.select<Payment[]>('SELECT id, patient_id AS patientId, amount, method, created_at AS date, note FROM payments ORDER BY created_at DESC'),
    conn.select<Followup[]>('SELECT id, patient_id AS patientId, title, due_date AS dueDate, status FROM followups ORDER BY due_date ASC'),
    conn.select<{ value: string }[]>("SELECT value FROM settings WHERE key = 'clinic_name'")
  ]);
  return { patients, services, visits, payments, followups, clinicName: setting[0]?.value ?? 'مطب من' };
}

export async function addPatient(input: NewPatient): Promise<void> {
  const item: Patient = { ...input, id: uid(), createdAt: now() };
  if (!desktopMode) { demo.patients.unshift(item); return; }
  await (await db()).execute('INSERT INTO patients (id, full_name, phone, note, created_at) VALUES ($1, $2, $3, $4, $5)',
    [item.id, item.name, item.phone, item.note, item.createdAt]);
}
export async function addService(input: NewService): Promise<void> {
  const item: Service = { ...input, id: uid() };
  if (!desktopMode) { demo.services.push(item); return; }
  await (await db()).execute('INSERT INTO services (id, title, price, description) VALUES ($1, $2, $3, $4)',
    [item.id, item.title, item.price, item.description]);
}
export async function addVisit(input: NewVisit): Promise<void> {
  const item: Visit = { ...input, id: uid(), date: now() };
  if (!desktopMode) { demo.visits.unshift(item); return; }
  await (await db()).execute('INSERT INTO visits (id, patient_id, service_id, amount, created_at, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [item.id, item.patientId, item.serviceId, item.amount, item.date, item.note]);
}
export async function addPayment(input: NewPayment): Promise<void> {
  const item: Payment = { ...input, id: uid(), date: now() };
  if (!desktopMode) { demo.payments.unshift(item); return; }
  await (await db()).execute('INSERT INTO payments (id, patient_id, amount, method, created_at, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [item.id, item.patientId, item.amount, item.method, item.date, item.note]);
}
export async function addFollowup(input: NewFollowup): Promise<void> {
  const item: Followup = { ...input, id: uid(), status: 'pending' };
  if (!desktopMode) { demo.followups.push(item); return; }
  await (await db()).execute('INSERT INTO followups (id, patient_id, title, due_date, status) VALUES ($1, $2, $3, $4, $5)',
    [item.id, item.patientId, item.title, item.dueDate, item.status]);
}
export async function completeFollowup(id: string): Promise<void> {
  if (!desktopMode) {
    demo.followups = demo.followups.map(item => item.id === id ? { ...item, status: 'done' } : item);
    return;
  }
  await (await db()).execute("UPDATE followups SET status = 'done' WHERE id = $1", [id]);
}
export async function setClinicName(value: string): Promise<void> {
  if (!desktopMode) { demo.clinicName = value; return; }
  await (await db()).execute(
    "INSERT INTO settings (key, value) VALUES ('clinic_name', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [value]
  );
}
