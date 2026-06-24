import axios from 'axios';
import {
  CreateVolunteerPayload,
  UpdateVolunteerPayload,
  Volunteer,
  VolunteerSheet,
  VolunteerStatus
} from '../types/volunteer';

const api = axios.create({
  baseURL: '/api'
});

export async function fetchVolunteers(status?: VolunteerStatus | 'ALL', sheetId?: number) {
  const response = await api.get<Volunteer[]>('/volunteers', {
    params: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(sheetId ? { sheetId } : {})
    }
  });

  return response.data;
}

export async function fetchVolunteerSheets() {
  const response = await api.get<VolunteerSheet[]>('/volunteers/sheets');
  return response.data;
}

export async function createVolunteerSheet(name: string) {
  const response = await api.post<VolunteerSheet>('/volunteers/sheets', { name });
  return response.data;
}

export async function updateVolunteerSheet(id: number, name: string) {
  const response = await api.put<VolunteerSheet>(`/volunteers/sheets/${id}`, { name });
  return response.data;
}

export async function deleteVolunteerSheet(id: number) {
  await api.delete(`/volunteers/sheets/${id}`);
}

export async function createVolunteer(payload: CreateVolunteerPayload) {
  const response = await api.post<Volunteer>('/volunteers', payload);
  return response.data;
}

export async function updateVolunteer(id: number, payload: UpdateVolunteerPayload) {
  const response = await api.put<Volunteer>(`/volunteers/${id}`, payload);
  return response.data;
}

export async function deleteVolunteer(id: number) {
  await api.delete(`/volunteers/${id}`);
}

export interface ImportVolunteersResult {
  message: string;
  created: number;
  updated: number;
  total: number;
}

export async function importVolunteers(file: File, sheetId?: number) {
  const formData = new FormData();
  formData.append('file', file);
  if (sheetId) {
    formData.append('sheetId', String(sheetId));
  }

  const response = await api.post<ImportVolunteersResult>('/volunteers/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function exportVolunteers(status?: VolunteerStatus | 'ALL', sheetId?: number) {
  const response = await api.get<Blob>('/volunteers/export', {
    params: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(sheetId ? { sheetId } : {})
    },
    responseType: 'blob'
  });
  return response.data;
}
