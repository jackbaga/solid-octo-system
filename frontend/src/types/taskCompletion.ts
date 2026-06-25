import { Teacher } from './volunteer';

export interface CompletionTaskMap {
  [taskName: string]: {
    sessions: Record<string, boolean>;
    completed: boolean;
  };
}

export interface TaskCompletionRecord {
  id: number;
  subjectName: string;
  subjectCode: string;
  parentAccount: string | null;
  parentPassword: string | null;
  parentPhone: string | null;
  personalAccount: string | null;
  personalPassword: string | null;
  assignedTeacher: Teacher | null;
  paymentStatus: string | null;
  cognitiveReportStatus: string | null;
  remark: string | null;
  tasks: CompletionTaskMap;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentCompletionPayloadItem {
  subjectName: string;
  subjectCode?: string | null;
  taskName: string;
  session?: string | null;
  completed: boolean;
}
