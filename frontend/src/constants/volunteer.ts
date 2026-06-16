import { Teacher, VolunteerStatus } from '../types/volunteer';

export const statusLabels: Record<VolunteerStatus, string> = {
  NOT_CALLED: '未打电话',
  NO_ANSWER: '未接电话',
  REJECTED: '拒绝参加',
  AVAILABLE: '可以参加',
  WECHAT_ADDED: '加了微信',
  APPOINTED: '已经预约'
};

export const statusColors: Record<VolunteerStatus, string> = {
  NOT_CALLED: 'default',
  NO_ANSWER: 'warning',
  REJECTED: 'error',
  AVAILABLE: 'processing',
  WECHAT_ADDED: 'cyan',
  APPOINTED: 'success'
};

export const teacherLabels: Record<Teacher, string> = {
  WANG_LE: '王乐老师',
  WEI_SHIYIN: '魏诗荫老师'
};

export const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value: value as VolunteerStatus,
  label
}));

export const teacherOptions = Object.entries(teacherLabels).map(([value, label]) => ({
  value: value as Teacher,
  label
}));

export const statusesRequiringTeacher: VolunteerStatus[] = ['WECHAT_ADDED', 'APPOINTED'];
