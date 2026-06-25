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
  projectName: string | null;
  session: string | null;
  round: string | null;
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
  subjectName?: string;
  date: string;
  time: string;
  projectType?: AppointmentProjectType;
  projectName?: string | null;
  session?: string | null;
  round?: string | null;
  remark?: string | null;
  status?: AppointmentStatus;
}

export interface AppointmentTaskConfig {
  id: number;
  name: string;
  sessions: string[];
  rounds: number[];
  roundSessions: Record<string, string[]>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentTaskConfigPayload {
  name: string;
  sessions: string[];
  rounds: number[];
  roundSessions: Record<string, string[]>;
}
