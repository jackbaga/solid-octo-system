import { api } from './api';

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function login(username: string, password: string) {
  const response = await api.post<AuthResult>('/auth/login', { username, password });
  return response.data;
}

export async function register(username: string, password: string) {
  const response = await api.post<AuthResult>('/auth/register', { username, password });
  return response.data;
}

export async function fetchMe() {
  const response = await api.get<{ user: AuthUser }>('/auth/me');
  return response.data.user;
}
