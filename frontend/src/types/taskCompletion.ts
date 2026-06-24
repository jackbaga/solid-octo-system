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
