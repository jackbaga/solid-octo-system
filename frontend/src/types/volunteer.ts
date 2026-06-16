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
  name: string;
  age: number | null;
  phone: string;
  status: VolunteerStatus;
  teacher: Teacher | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVolunteerPayload {
  name: string;
  age?: number | null;
  phone: string;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
}

export interface UpdateVolunteerPayload {
  name?: string;
  age?: number | null;
  phone?: string;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
}
