import axios from 'axios';
import { Appointment, AppointmentPayload } from '../types/appointment';

const api = axios.create({
  baseURL: '/api'
});

export async function fetchAppointments(date?: string) {
  const response = await api.get<Appointment[]>('/appointments', {
    params: date ? { date } : undefined
  });

  return response.data;
}

export async function createAppointment(payload: AppointmentPayload) {
  const response = await api.post<Appointment>('/appointments', payload);
  return response.data;
}

export async function updateAppointment(id: number, payload: AppointmentPayload) {
  const response = await api.put<Appointment>(`/appointments/${id}`, payload);
  return response.data;
}

export async function deleteAppointment(id: number) {
  await api.delete(`/appointments/${id}`);
}

export async function fetchAppointmentDay(date: string) {
  const response = await api.get<{ id: number; date: string; assistants: string[] }>('/appointments/day', {
    params: { date }
  });

  return response.data;
}

export async function updateAppointmentDay(date: string, assistants: string[]) {
  const response = await api.put<{ id: number; date: string; assistants: string[] }>('/appointments/day', {
    date,
    assistants
  });

  return response.data;
}

export async function exportAppointmentCredentials(date: string) {
  const response = await api.get<Blob>('/appointments/export-credentials', {
    params: { date },
    responseType: 'blob'
  });

  return response.data;
}

export async function syncAppointmentDaySummary(date: string, incompleteAppointmentIds: number[]) {
  const response = await api.post<{ message: string; appointments: Appointment[] }>('/appointments/day-summary', {
    date,
    incompleteAppointmentIds
  });

  return response.data;
}
