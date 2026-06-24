import { Volunteer } from './volunteer';

export type AppointmentProjectType =
  | 'MRI'
  | 'EEG'
  | 'COGNITION'
  | 'INTERVIEW'
  | 'PARENT_INTERVIEW'
  | 'FORMAL_TEST'
  | 'OTHER';
export type AppointmentStatus = 'BOOKED' | 'COMPLETED';

export interface Appointment {
  id: number;
  volunteerId: number | null;
  volunteer: Volunteer | null;
  subjectName: string;
  date: string;
  time: string;
  projectType: AppointmentProjectType;
  session: string;
  round: string;
  remark: string | null;
  status: AppointmentStatus;
  taskCompletion: {
    id: number;
    appointmentId: number;
    date: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentPayload {
  volunteerId?: number | null;
  subjectName: string;
  date: string;
  time: string;
  projectType: AppointmentProjectType;
  session?: string;
  round?: string;
  remark?: string | null;
  status?: AppointmentStatus;
}
