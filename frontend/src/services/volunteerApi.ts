import axios from 'axios';
import {
  CreateVolunteerPayload,
  UpdateVolunteerPayload,
  Volunteer,
  VolunteerStatus
} from '../types/volunteer';

const api = axios.create({
  baseURL: '/api'
});

export async function fetchVolunteers(status?: VolunteerStatus | 'ALL') {
  const response = await api.get<Volunteer[]>('/volunteers', {
    params: status && status !== 'ALL' ? { status } : undefined
  });

  return response.data;
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

export async function importVolunteers(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ImportVolunteersResult>('/volunteers/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function exportVolunteers(status?: VolunteerStatus | 'ALL') {
  const response = await api.get<Blob>('/volunteers/export', {
    params: status && status !== 'ALL' ? { status } : undefined,
    responseType: 'blob'
  });
  return response.data;
}
