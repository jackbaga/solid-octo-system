import { AppointmentProjectType, AppointmentStatus } from '../types/appointment';

export const defaultAppointmentTimes = ['9:30', '10:00', '13:00', '14:00', '15:00'];

export const appointmentProjectTypeLabels: Record<AppointmentProjectType, string> = {
  MRI: '磁共振',
  EEG: '脑电',
  COGNITION: '认知',
  INTERVIEW: '访谈',
  PARENT_INTERVIEW: '家长访谈',
  FORMAL_TEST: '正式测试',
  OTHER: '其它'
};

export const taskProjectTypes: AppointmentProjectType[] = ['MRI', 'EEG', 'COGNITION', 'INTERVIEW'];

export const roundOptions = Array.from({ length: 10 }, (_, index) => {
  const value = `第${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index]}轮`;
  return { value, label: value };
});

export const sessionOptions = Array.from({ length: 4 }, (_, index) => {
  const value = `Session ${index + 1}`;
  return { value, label: value };
});

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  BOOKED: '已预约',
  COMPLETED: '已完成'
};

export const appointmentStatusColors: Record<AppointmentStatus, string> = {
  BOOKED: 'processing',
  COMPLETED: 'success'
};

export const appointmentProjectTypeOptions = Object.entries(appointmentProjectTypeLabels).map(([value, label]) => ({
  value: value as AppointmentProjectType,
  label
}));

export const appointmentStatusOptions = Object.entries(appointmentStatusLabels).map(([value, label]) => ({
  value: value as AppointmentStatus,
  label
}));
