import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import type { ImportVolunteerInput } from '../services/volunteer.service.js';
import {
  createVolunteerSheet,
  createVolunteer,
  deleteVolunteerSheetForUser,
  deleteVolunteerForUser,
  getDefaultVolunteerSheet,
  importVolunteerRows,
  isValidTeacher,
  isValidVolunteerStatus,
  listVolunteerSheets,
  listVolunteersForUser,
  listVolunteersBySheet,
  updateVolunteerSheet,
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

function parseOptionalId(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function getUserId(req: Request) {
  if (!req.user) {
    throw new Error('UNAUTHORIZED');
  }

  return req.user.id;
}

async function resolveSheetId(userId: number, value: unknown) {
  const sheetId = parseOptionalId(value);

  if (sheetId) {
    return sheetId;
  }

  const defaultSheet = await getDefaultVolunteerSheet(userId);
  return defaultSheet.id;
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
  const userId = getUserId(req);
  const { status } = req.query;
  const sheetId = parseOptionalId(req.query.sheetId);

  if (status !== undefined && !isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: '志愿者状态无效。' });
  }

  const volunteers = sheetId
    ? await listVolunteersBySheet(userId, sheetId, status)
    : await listVolunteersForUser(userId, status);
  return res.json(volunteers);
}

export async function getVolunteerSheets(req: Request, res: Response) {
  const userId = getUserId(req);
  const sheets = await listVolunteerSheets(userId);

  if (sheets.length > 0) {
    return res.json(sheets);
  }

  const defaultSheet = await getDefaultVolunteerSheet(userId);
  return res.json([defaultSheet]);
}

export async function postVolunteerSheet(req: Request, res: Response) {
  const userId = getUserId(req);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: '表格名称不能为空。' });
  }

  const sheet = await createVolunteerSheet(userId, { name });
  return res.status(201).json(sheet);
}

export async function putVolunteerSheet(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

  if (!id) {
    return res.status(400).json({ message: '表格编号无效。' });
  }

  if (!name) {
    return res.status(400).json({ message: '表格名称不能为空。' });
  }

  const sheet = await updateVolunteerSheet(userId, id, { name });

  if (!sheet) {
    return res.status(404).json({ message: '未找到该表格。' });
  }

  return res.json(sheet);
}

export async function removeVolunteerSheet(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '表格编号无效。' });
  }

  try {
    await deleteVolunteerSheetForUser(userId, id);
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === '至少需要保留一个表格。') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(404).json({ message: '未找到该表格。' });
  }
}

export async function postVolunteer(req: Request, res: Response) {
  const userId = getUserId(req);
  const { name, phone } = req.body;
  const age = parseAge(req.body.age);
  const status = req.body.status ?? 'NOT_CALLED';
  const sheetId = await resolveSheetId(userId, req.body.sheetId);

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: '姓名不能为空。' });
  }

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ message: '电话不能为空。' });
  }

  if (age === undefined) {
    return res.status(400).json({ message: '年龄必须是正整数。' });
  }

  if (!isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: '志愿者状态无效。' });
  }

  if (req.body.teacher !== undefined && req.body.teacher !== null && !isValidTeacher(req.body.teacher)) {
    return res.status(400).json({ message: '负责老师无效。' });
  }

  const volunteer = await createVolunteer(userId, {
    sheetId,
    name: name.trim(),
    phone: phone.trim(),
    age,
    account: req.body.account ? String(req.body.account).trim() : null,
    password: req.body.password ? String(req.body.password).trim() : null,
    status,
    teacher: req.body.teacher ?? null,
    remark: req.body.remark ? String(req.body.remark).trim() : null
  });

  return res.status(201).json(volunteer);
}

export async function putVolunteer(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '志愿者编号无效。' });
  }

  const age = parseAge(req.body.age);

  if ('age' in req.body && age === undefined) {
    return res.status(400).json({ message: '年龄必须是正整数。' });
  }

  if ('status' in req.body && !isValidVolunteerStatus(req.body.status)) {
    return res.status(400).json({ message: '志愿者状态无效。' });
  }

  if (req.body.teacher !== undefined && req.body.teacher !== null && !isValidTeacher(req.body.teacher)) {
    return res.status(400).json({ message: '负责老师无效。' });
  }

  const volunteer = await updateVolunteer(userId, id, {
    ...('name' in req.body ? { name: String(req.body.name).trim() } : {}),
    ...('phone' in req.body ? { phone: String(req.body.phone).trim() } : {}),
    ...('account' in req.body ? { account: req.body.account ? String(req.body.account).trim() : null } : {}),
    ...('password' in req.body ? { password: req.body.password ? String(req.body.password).trim() : null } : {}),
    ...('remark' in req.body ? { remark: req.body.remark ? String(req.body.remark).trim() : null } : {}),
    ...('age' in req.body ? { age } : {}),
    ...('status' in req.body ? { status: req.body.status } : {}),
    ...('teacher' in req.body ? { teacher: req.body.teacher } : {})
  });

  if (!volunteer) {
    return res.status(404).json({ message: '未找到该志愿者。' });
  }

  return res.json(volunteer);
}

export async function removeVolunteer(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '志愿者编号无效。' });
  }

  try {
    await deleteVolunteerForUser(userId, id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: '未找到该志愿者。' });
  }
}

export async function importVolunteers(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!req.file || req.file.size === 0) {
    return res.status(400).json({ message: '文件为空。' });
  }

  const { rows, errors } = parseExcelRows(req.file.buffer);

  if (errors.length > 0) {
    return res.status(400).json({
      message: '表格导入失败，请修正后重试。',
      errors
    });
  }

  const sheetId = await resolveSheetId(userId, req.body.sheetId);
  const result = await importVolunteerRows(userId, sheetId, rows);
  return res.json({
    message: '表格导入完成。',
    ...result
  });
}

export async function exportVolunteers(req: Request, res: Response) {
  const userId = getUserId(req);
  const { status } = req.query;
  const sheetId = parseOptionalId(req.query.sheetId);

  if (status !== undefined && !isValidVolunteerStatus(status)) {
    return res.status(400).json({ message: '志愿者状态无效。' });
  }

  const volunteers = sheetId
    ? await listVolunteersBySheet(userId, sheetId, status)
    : await listVolunteersForUser(userId, status);
  const rows = volunteers.map((volunteer) => ({
    姓名: volunteer.name,
    年龄: volunteer.age ?? '',
    电话: volunteer.phone,
    状态: statusLabels[volunteer.status],
    负责老师: volunteer.teacher ? teacherLabels[volunteer.teacher] : '',
    备注: volunteer.remark ?? ''
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['姓名', '年龄', '电话', '状态', '负责老师', '备注']
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
