import { AppointmentCompletionPayloadItem, CompletionTaskMap, TaskCompletionRecord } from '../types/taskCompletion';
import { Teacher } from '../types/volunteer';
import { api } from './api';

export async function fetchTaskCompletionRecords() {
  const response = await api.get<TaskCompletionRecord[]>('/task-completion/records');
  return response.data;
}

export async function exportTaskCompletionRecords() {
  const response = await api.get<Blob>('/task-completion/export', {
    responseType: 'blob'
  });
  return response.data;
}

export interface ImportTaskCompletionResult {
  message: string;
  created: number;
  updated: number;
  total: number;
}

export async function importTaskCompletion(file: File, roundName?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (roundName) {
    formData.append('roundName', roundName);
  }

  const response = await api.post<ImportTaskCompletionResult>('/task-completion/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function deleteTaskCompletionRecord(id: number) {
  await api.delete(`/task-completion/records/${id}`);
}

export async function clearTaskCompletionRecords() {
  const response = await api.delete<{ message: string; count: number }>('/task-completion/records');
  return response.data;
}

export async function updateTaskCompletionRecord(
  id: number,
  payload: {
    parentAccount?: string | null;
    parentPassword?: string | null;
    parentPhone?: string | null;
    personalAccount?: string | null;
    personalPassword?: string | null;
    assignedTeacher?: Teacher | null;
    paymentStatus?: string | null;
    cognitiveReportStatus?: string | null;
    remark?: string | null;
    tasks?: CompletionTaskMap;
  }
) {
  const response = await api.patch<TaskCompletionRecord>(`/task-completion/records/${id}`, payload);
  return response.data;
}

export async function promoteTaskCompletionRecord(id: number, currentRound: string) {
  const response = await api.post<TaskCompletionRecord>(`/task-completion/records/${id}/promote`, {
    currentRound
  });
  return response.data;
}

export async function syncTaskCompletionFromAppointments(items: AppointmentCompletionPayloadItem[]) {
  const response = await api.post<{ message: string; touched: number; records: TaskCompletionRecord[] }>(
    '/task-completion/sync-appointments',
    { items }
  );
  return response.data;
}
