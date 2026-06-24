export type VolunteerStatus =
  | 'NOT_CALLED'
  | 'NO_ANSWER'
  | 'REJECTED'
  | 'AVAILABLE'
  | 'WECHAT_ADDED'
  | 'APPOINTED';

export type Teacher = 'WANG_LE' | 'WEI_SHIYIN';

export interface Volunteer {
  id: number;
  sheetId: number;
  name: string;
  age: number | null;
  phone: string;
  account: string | null;
  password: string | null;
  status: VolunteerStatus;
  teacher: Teacher | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerSheet {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVolunteerPayload {
  sheetId?: number;
  name: string;
  age?: number | null;
  phone: string;
  account?: string | null;
  password?: string | null;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
  remark?: string | null;
}

export interface UpdateVolunteerPayload {
  name?: string;
  age?: number | null;
  phone?: string;
  account?: string | null;
  password?: string | null;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
  remark?: string | null;
}
