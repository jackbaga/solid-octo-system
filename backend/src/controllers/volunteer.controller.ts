import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import type { ImportVolunteerInput } from '../services/volunteer.service.js';
import {
  createVolunteer,
  deleteVolunteer,
  importVolunteerRows,
  isValidTeacher,
  isValidVolunteerStatus,
  listVolunteers,
  updateVolunteer
} from '../services/volunteer.service.js';

const statusLabels = {
  NOT_CALLED: '未打电话',
  NO_ANSWER: '未接电话',
  REJECTED: '拒绝参加',
  AVAILABLE: '可以参加',
  WECHAT_ADDED: '加了微信',
  APPOINTED: '已经预约'
};

const teacherLabels = {
  WANG_LE: '王乐老师',
  WEI_SHIYIN: '魏诗荫老师'
};

function parseAge(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const age = Number(value);
  return Number.isInteger(age) && age > 0 ? age : undefined;
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function parseImportAge(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const age = Number(value);
  return Number.isInteger(age) && age > 0 ? age : undefined;
}

function parseExcelRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { rows: [], errors: ['文件为空。'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });
  const errors: string[] = [];
  const rows: ImportVolunteerInput[] = records.map((record: Record<string, unknown>, index: number) => {
    const rowNumber = index + 2;
    const name = String(record['姓名'] ?? '').trim();
    const phone = String(record['电话'] ?? '').trim();
    const age = parseImportAge(record['年龄']);

    if (!name) {
      errors.push(`第 ${rowNumber} 行缺少姓名。`);
    }

    if (!phone) {
      errors.push(`第 ${rowNumber} 行缺少电话。`);
    }

    if (age === undefined) {
      errors.push(`第 ${rowNumber} 行年龄不是数字。`);
    }

    return { name, phone, age };
  });

  if (records.length === 0) {
    errors.push('文件为空。');
  }

  return { rows, errors };
}

export async function getVolunteers(req: Request, res: Response) {
  const { status } = req.query;

  if (status !== undefined && !isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: 'Invalid volunteer status.' });
  }

  const volunteers = await listVolunteers(status);
  return res.json(volunteers);
}

export async function postVolunteer(req: Request, res: Response) {
  const { name, phone } = req.body;
  const age = parseAge(req.body.age);
  const status = req.body.status ?? 'NOT_CALLED';

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'Name is required.' });
  }

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ message: 'Phone is required.' });
  }

  if (age === undefined) {
    return res.status(400).json({ message: 'Age must be a positive integer.' });
  }

  if (!isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: 'Invalid volunteer status.' });
  }

  if (req.body.teacher !== undefined && req.body.teacher !== null && !isValidTeacher(req.body.teacher)) {
    return res.status(400).json({ message: 'Invalid teacher.' });
  }

  const volunteer = await createVolunteer({
    name: name.trim(),
    phone: phone.trim(),
    age,
    status,
    teacher: req.body.teacher ?? null
  });

  return res.status(201).json(volunteer);
}

export async function putVolunteer(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: 'Invalid volunteer id.' });
  }

  const age = parseAge(req.body.age);

  if ('age' in req.body && age === undefined) {
    return res.status(400).json({ message: 'Age must be a positive integer.' });
  }

  if ('status' in req.body && !isValidVolunteerStatus(req.body.status)) {
    return res.status(400).json({ message: 'Invalid volunteer status.' });
  }

  if (req.body.teacher !== undefined && req.body.teacher !== null && !isValidTeacher(req.body.teacher)) {
    return res.status(400).json({ message: 'Invalid teacher.' });
  }

  const volunteer = await updateVolunteer(id, {
    ...('name' in req.body ? { name: String(req.body.name).trim() } : {}),
    ...('phone' in req.body ? { phone: String(req.body.phone).trim() } : {}),
    ...('age' in req.body ? { age } : {}),
    ...('status' in req.body ? { status: req.body.status } : {}),
    ...('teacher' in req.body ? { teacher: req.body.teacher } : {})
  });

  if (!volunteer) {
    return res.status(404).json({ message: 'Volunteer not found.' });
  }

  return res.json(volunteer);
}

export async function removeVolunteer(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: 'Invalid volunteer id.' });
  }

  try {
    await deleteVolunteer(id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: 'Volunteer not found.' });
  }
}

export async function importVolunteers(req: Request, res: Response) {
  if (!req.file || req.file.size === 0) {
    return res.status(400).json({ message: '文件为空。' });
  }

  const { rows, errors } = parseExcelRows(req.file.buffer);

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Excel 导入失败，请修正后重试。',
      errors
    });
  }

  const result = await importVolunteerRows(rows);
  return res.json({
    message: 'Excel 导入完成。',
    ...result
  });
}

export async function exportVolunteers(req: Request, res: Response) {
  const { status } = req.query;

  if (status !== undefined && !isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: 'Invalid volunteer status.' });
  }

  const volunteers = await listVolunteers(status);
  const rows = volunteers.map((volunteer) => ({
    姓名: volunteer.name,
    年龄: volunteer.age ?? '',
    电话: volunteer.phone,
    状态: statusLabels[volunteer.status],
    负责老师: volunteer.teacher ? teacherLabels[volunteer.teacher] : ''
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['姓名', '年龄', '电话', '状态', '负责老师']
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '志愿者名单');

  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer'
  });

  const filename = encodeURIComponent('志愿者名单.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  return res.send(buffer);
}
