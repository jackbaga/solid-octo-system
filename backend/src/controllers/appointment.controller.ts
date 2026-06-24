import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  createAppointment,
  deleteAppointment,
  getAppointmentDay,
  isValidAppointmentProjectType,
  isValidAppointmentStatus,
  listAppointmentTaskConfigs,
  listAppointments,
  replaceAppointmentTaskConfigs,
  syncDayTaskCompletion,
  updateAppointmentDay,
  updateAppointment
} from '../services/appointment.service.js';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function parseOptionalVolunteerId(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function validateAppointmentBody(body: Record<string, unknown>, partial = false) {
  const errors: string[] = [];

  if ('subjectName' in body && body.subjectName !== null && typeof body.subjectName !== 'string') {
    errors.push('被试姓名无效。');
  }

  if (!partial || 'projectName' in body || 'projectType' in body) {
    if ('projectName' in body) {
      if (!body.projectName || typeof body.projectName !== 'string') {
        errors.push('请选择任务种类。');
      }
    } else if (!isValidAppointmentProjectType(body.projectType)) {
      errors.push('预约项目无效。');
    }
  }

  if (!partial || 'date' in body) {
    if (!body.date || typeof body.date !== 'string') {
      errors.push('预约日期不能为空。');
    }
  }

  if (!partial || 'time' in body) {
    if (!body.time || typeof body.time !== 'string') {
      errors.push('预约时间不能为空。');
    }
  }

  if ('projectType' in body && body.projectType !== undefined && !isValidAppointmentProjectType(body.projectType)) {
    errors.push('预约项目无效。');
  }

  if ('status' in body && !isValidAppointmentStatus(body.status)) {
    errors.push('预约状态无效。');
  }

  if ('session' in body && body.session !== null && body.session !== '' && typeof body.session !== 'string') {
    errors.push('Session 无效。');
  }

  if ('round' in body && body.round !== null && body.round !== '' && typeof body.round !== 'string') {
    errors.push('轮数无效。');
  }

  if ('volunteerId' in body && parseOptionalVolunteerId(body.volunteerId) === undefined) {
    errors.push('关联志愿者无效。');
  }

  return errors;
}

function normalizeOptionalText(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function validateTaskConfigBody(body: Record<string, unknown>) {
  if (!Array.isArray(body.configs)) {
    return { errors: ['任务配置格式无效。'], configs: [] };
  }

  const errors: string[] = [];
  const names = new Set<string>();
  const configs = body.configs.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const sessions = Array.isArray(record.sessions)
      ? record.sessions.map((session) => String(session).trim()).filter(Boolean)
      : [];
    const rounds = Array.isArray(record.rounds)
      ? Array.from(new Set(record.rounds.map(Number).filter((round) => Number.isInteger(round) && round >= 1 && round <= 10))).sort((a, b) => a - b)
      : [];

    if (!name) {
      errors.push(`第 ${index + 1} 个任务缺少名称。`);
    }

    if (name && names.has(name)) {
      errors.push(`任务名称「${name}」重复。`);
    }

    names.add(name);
    return { name, sessions, rounds };
  });

  if (configs.length === 0) {
    errors.push('至少需要保留一个任务。');
  }

  return { errors, configs };
}

export async function getAppointments(req: Request, res: Response) {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const appointments = await listAppointments(date);
  return res.json(appointments);
}

export async function getAppointmentTaskConfigs(_req: Request, res: Response) {
  const configs = await listAppointmentTaskConfigs();
  return res.json(configs);
}

export async function putAppointmentTaskConfigs(req: Request, res: Response) {
  const { errors, configs } = validateTaskConfigBody(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ message: '任务配置有误。', errors });
  }

  const savedConfigs = await replaceAppointmentTaskConfigs(configs);
  return res.json(savedConfigs);
}

export async function getAppointmentDayInfo(req: Request, res: Response) {
  const date = typeof req.query.date === 'string' ? req.query.date : '';

  if (!date) {
    return res.status(400).json({ message: '日期不能为空。' });
  }

  const day = await getAppointmentDay(date);
  return res.json(day);
}

export async function putAppointmentDayInfo(req: Request, res: Response) {
  const date = typeof req.body.date === 'string' ? req.body.date : '';
  const assistants = Array.isArray(req.body.assistants)
    ? req.body.assistants.map((assistant: unknown) => String(assistant).trim()).filter(Boolean)
    : [];

  if (!date) {
    return res.status(400).json({ message: '日期不能为空。' });
  }

  const day = await updateAppointmentDay(date, assistants);
  return res.json(day);
}

export async function exportAppointmentCredentials(req: Request, res: Response) {
  const date = typeof req.query.date === 'string' ? req.query.date : '';

  if (!date) {
    return res.status(400).json({ message: '日期不能为空。' });
  }

  const appointments = await listAppointments(date);
  const rows = appointments
    .filter((appointment) => appointment.volunteer)
    .map((appointment) => ({
      被试姓名: appointment.subjectName,
      志愿者姓名: appointment.volunteer?.name ?? '',
      电话: appointment.volunteer?.phone ?? '',
      账号: appointment.volunteer?.account ?? '',
      密码: appointment.volunteer?.password ?? '',
      时间: appointment.time
    }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['被试姓名', '志愿者姓名', '电话', '账号', '密码', '时间']
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '当日账号密码');
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer'
  });
  const filename = encodeURIComponent(`${date}-预约账号密码.xlsx`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  return res.send(buffer);
}

export async function postAppointmentDaySummary(req: Request, res: Response) {
  const date = typeof req.body.date === 'string' ? req.body.date : '';
  const incompleteAppointmentIds = Array.isArray(req.body.incompleteAppointmentIds)
    ? req.body.incompleteAppointmentIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
    : [];

  if (!date) {
    return res.status(400).json({ message: '日期不能为空。' });
  }

  const appointments = await syncDayTaskCompletion(date, incompleteAppointmentIds);
  return res.json({ message: '当日任务完成度已更新。', appointments });
}

export async function postAppointment(req: Request, res: Response) {
  const errors = validateAppointmentBody(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ message: '预约信息有误。', errors });
  }

  const appointment = await createAppointment({
    volunteerId: parseOptionalVolunteerId(req.body.volunteerId),
    subjectName: normalizeOptionalText(req.body.subjectName) ?? '',
    date: String(req.body.date).trim(),
    time: String(req.body.time).trim(),
    projectType: req.body.projectType,
    projectName: normalizeOptionalText(req.body.projectName),
    session: normalizeOptionalText(req.body.session),
    round: normalizeOptionalText(req.body.round),
    remark: normalizeOptionalText(req.body.remark),
    status: req.body.status
  });

  return res.status(201).json(appointment);
}

export async function putAppointment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '预约编号无效。' });
  }

  const errors = validateAppointmentBody(req.body, true);

  if (errors.length > 0) {
    return res.status(400).json({ message: '预约信息有误。', errors });
  }

  const appointment = await updateAppointment(id, {
    ...('volunteerId' in req.body ? { volunteerId: parseOptionalVolunteerId(req.body.volunteerId) } : {}),
    ...('subjectName' in req.body ? { subjectName: String(req.body.subjectName).trim() } : {}),
    ...('date' in req.body ? { date: String(req.body.date).trim() } : {}),
    ...('time' in req.body ? { time: String(req.body.time).trim() } : {}),
    ...('projectType' in req.body ? { projectType: req.body.projectType } : {}),
    ...('projectName' in req.body ? { projectName: normalizeOptionalText(req.body.projectName) } : {}),
    ...('session' in req.body ? { session: normalizeOptionalText(req.body.session) } : {}),
    ...('round' in req.body ? { round: normalizeOptionalText(req.body.round) } : {}),
    ...('remark' in req.body ? { remark: normalizeOptionalText(req.body.remark) } : {}),
    ...('status' in req.body ? { status: req.body.status } : {})
  });

  if (!appointment) {
    return res.status(404).json({ message: '未找到该预约。' });
  }

  return res.json(appointment);
}

export async function removeAppointment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '预约编号无效。' });
  }

  try {
    await deleteAppointment(id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: '未找到该预约。' });
  }
}
