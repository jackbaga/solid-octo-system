import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  AppointmentCompletionInput,
  clearTaskCompletionRecords,
  CompletionTaskMap,
  deleteTaskCompletionRecord,
  listTaskCompletionRecords,
  promoteTaskCompletionRecord,
  syncAppointmentCompletions,
  TaskCompletionRecordInput,
  updateTaskCompletionRecord,
  upsertTaskCompletionRecords
} from '../services/taskCompletion.service.js';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isCompletedCell(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', '是', '完成', '已完成', '√', '✓', 'done'].includes(text);
}

function normalizeDistributionStatus(value: unknown) {
  return isCompletedCell(value) ? '已发放' : '未发放';
}

function fillMergedHeaders(sheet: XLSX.WorkSheet, rows: unknown[][]) {
  const merges = sheet['!merges'] ?? [];

  for (const merge of merges) {
    const value = rows[merge.s.r]?.[merge.s.c];

    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      rows[row] ??= [];
      for (let col = merge.s.c; col <= merge.e.c; col += 1) {
        rows[row][col] = rows[row][col] || value;
      }
    }
  }
}

const ignoredTaskGroups = new Set(['', '序号', '其他信息', '被试基本信息', '备注']);

function normalizeRoundName(value: string) {
  const chineseRounds = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  if (value.includes('基线轮')) {
    return '第一轮';
  }

  const chineseMatch = value.match(/第([一二三四五六七八九十])轮/);
  if (chineseMatch) {
    return `第${chineseMatch[1]}轮`;
  }

  const digitMatch = value.match(/(?:第)?([1-9]|10)轮/);
  if (digitMatch) {
    return `第${chineseRounds[Number(digitMatch[1]) - 1]}轮`;
  }

  return value;
}

function normalizeRequestedRound(value: unknown) {
  const text = normalizeHeader(value);
  const normalized = normalizeRoundName(text);
  return /^第[一二三四五六七八九十]轮$/.test(normalized) ? normalized : null;
}

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === '被试姓名') &&
    row.some((cell) => normalizeHeader(cell) === '被试编号')
  );
}

function findColumn(row: unknown[], matcher: (header: string) => boolean) {
  return row.findIndex((cell) => matcher(normalizeHeader(cell)));
}

function findGlobalRemarkColumn(groupHeader: unknown[], sessionHeader: unknown[]) {
  for (let index = Math.max(groupHeader.length, sessionHeader.length) - 1; index >= 0; index -= 1) {
    const groupName = normalizeHeader(groupHeader[index]);
    const sessionName = normalizeHeader(sessionHeader[index]);

    if (groupName === '备注' && !sessionName) {
      return index;
    }
  }

  return -1;
}

function parseLongitudinalSheet(sheetName: string, sheet: XLSX.WorkSheet, forcedRoundName?: string | null) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
  fillMergedHeaders(sheet, rows);

  const title = normalizeHeader(rows[0]?.[0]);

  if (title !== 'CCBD-北大站点-纵向队列') {
    return [];
  }

  const headerRowIndex = findHeaderRow(rows);

  if (headerRowIndex < 1) {
    return [];
  }

  const groupHeader = rows[headerRowIndex - 1] ?? [];
  const sessionHeader = rows[headerRowIndex] ?? [];
  const nameCol = findColumn(sessionHeader, (header) => header === '被试姓名');
  const codeCol = findColumn(sessionHeader, (header) => header === '被试编号');
  const paymentCol = findColumn(sessionHeader, (header) => header.includes('被试费发放'));
  const cognitiveReportCol = findColumn(sessionHeader, (header) => header === '认知报告发放');
  const remarkCol = findGlobalRemarkColumn(groupHeader, sessionHeader);
  const records: TaskCompletionRecordInput[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const subjectName = normalizeHeader(row[nameCol]);

    if (!subjectName) {
      continue;
    }

    const tasks: CompletionTaskMap = {};

    for (let colIndex = 0; colIndex < Math.max(groupHeader.length, sessionHeader.length, row.length); colIndex += 1) {
      const taskName = normalizeHeader(groupHeader[colIndex]);
      const sessionName = normalizeHeader(sessionHeader[colIndex]);

      if (ignoredTaskGroups.has(taskName) || !sessionName || sessionName === '备注') {
        continue;
      }

      const normalizedTaskName = `${forcedRoundName ?? normalizeRoundName(sheetName)}-${taskName}`;
      tasks[normalizedTaskName] ??= { sessions: {}, completed: false };
      tasks[normalizedTaskName].sessions[sessionName] = isCompletedCell(row[colIndex]);
    }

    records.push({
      subjectName,
      subjectCode: normalizeHeader(row[codeCol]),
      paymentStatus: paymentCol >= 0 ? normalizeDistributionStatus(row[paymentCol]) : null,
      cognitiveReportStatus: cognitiveReportCol >= 0 ? normalizeDistributionStatus(row[cognitiveReportCol]) : null,
      remark: remarkCol >= 0 ? normalizeHeader(row[remarkCol]) : null,
      tasks
    });
  }

  return records;
}

function parseParentModuleSheet(sheetName: string, sheet: XLSX.WorkSheet, forcedRoundName?: string | null) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
  fillMergedHeaders(sheet, rows);

  const rawTitle = normalizeHeader(rows[0]?.[0]);
  const title = forcedRoundName
    ? rawTitle.replace(/^.*?(?=-家长访谈及问卷)/, forcedRoundName)
    : normalizeRoundName(rawTitle);

  if (!title.includes('家长访谈及问卷')) {
    return [];
  }

  const headerRowIndex = rows.findIndex((row) => normalizeHeader(row[0]) === '被试姓名');

  if (headerRowIndex < 0) {
    return [];
  }

  const header = rows[headerRowIndex] ?? [];
  const records: TaskCompletionRecordInput[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const subjectName = normalizeHeader(row[0]);

    if (!subjectName) {
      continue;
    }

    const tasks: CompletionTaskMap = {
      [title]: {
        sessions: {},
        completed: false
      }
    };

    for (let colIndex = 1; colIndex <= 3; colIndex += 1) {
      const sessionName = normalizeHeader(header[colIndex]);

      if (!sessionName) {
        continue;
      }

      tasks[title].sessions[sessionName] = isCompletedCell(row[colIndex]);
    }

    records.push({
      subjectName,
      subjectCode: '',
      paymentStatus: normalizeDistributionStatus(row[4]),
      cognitiveReportStatus: null,
      tasks
    });
  }

  return records;
}

function parseSimpleModelSheet(sheet: XLSX.WorkSheet, forcedRoundName?: string | null) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
  fillMergedHeaders(sheet, rows);

  const headerRowIndex = rows.findIndex((row) =>
    normalizeHeader(row[0]) === '被试姓名' &&
    normalizeHeader(row[1]) === '被试编号'
  );

  if (headerRowIndex < 0 || !rows[headerRowIndex + 1]) {
    return [];
  }

  const groupHeader = rows[headerRowIndex] ?? [];
  const sessionHeader = rows[headerRowIndex + 1] ?? [];
  const roundName = forcedRoundName ?? '第一轮';
  const paymentCol = findColumn(groupHeader, (header) => header.includes('被试费发放'));
  const cognitiveReportCol = findColumn(groupHeader, (header) => header === '认知报告发放');
  const remarkCol = findGlobalRemarkColumn(groupHeader, sessionHeader);
  const records: TaskCompletionRecordInput[] = [];

  for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const subjectName = normalizeHeader(row[0]);
    const subjectCode = normalizeHeader(row[1]);

    if (!subjectName || subjectName === '被试姓名') {
      continue;
    }

    const tasks: CompletionTaskMap = {};

    for (let colIndex = 2; colIndex < Math.max(groupHeader.length, sessionHeader.length, row.length); colIndex += 1) {
      const taskName = normalizeHeader(groupHeader[colIndex]);
      const sessionName = normalizeHeader(sessionHeader[colIndex]);

      if (ignoredTaskGroups.has(taskName) || !sessionName || sessionName === '备注') {
        continue;
      }

      const normalizedTaskName = `${roundName}-${taskName}`;
      tasks[normalizedTaskName] ??= { sessions: {}, completed: false };
      tasks[normalizedTaskName].sessions[sessionName] = isCompletedCell(row[colIndex]);
    }

    records.push({
      subjectName,
      subjectCode,
      paymentStatus: paymentCol >= 0 ? normalizeDistributionStatus(row[paymentCol]) : null,
      cognitiveReportStatus: cognitiveReportCol >= 0 ? normalizeDistributionStatus(row[cognitiveReportCol]) : null,
      remark: remarkCol >= 0 ? normalizeHeader(row[remarkCol]) : null,
      tasks
    });
  }

  return records;
}

function parseCompletionWorkbook(buffer: Buffer, forcedRoundName?: string | null) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.length === 0) {
    return { records: [], errors: ['文件为空。'] };
  }

  const errors: string[] = [];
  const records: TaskCompletionRecordInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    records.push(...parseSimpleModelSheet(sheet, forcedRoundName));
    records.push(...parseLongitudinalSheet(sheetName, sheet, forcedRoundName));
    records.push(...parseParentModuleSheet(sheetName, sheet, forcedRoundName));
  }

  if (records.length === 0) {
    errors.push('没有找到符合“CCBD-北大站点-纵向队列”格式的数据。');
  }

  return { records, errors };
}

function parseLegacyCompletionWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { records: [], errors: ['文件为空。'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
  fillMergedHeaders(sheet, rows);

  if (rows.length < 3) {
    return { records: [], errors: ['表格至少需要两行表头和一行数据。'] };
  }

  const taskHeader = rows[0] ?? [];
  const sessionHeader = rows[1] ?? [];
  const errors: string[] = [];
  const records: TaskCompletionRecordInput[] = [];

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const subjectName = normalizeHeader(row[0]);

    if (!subjectName) {
      continue;
    }

    const subjectCode = normalizeHeader(row[1]);
    const paymentStatus = normalizeDistributionStatus(row[2]);
    const cognitiveReportStatus = normalizeDistributionStatus(row[3]);
    const tasks: CompletionTaskMap = {};

    for (let colIndex = 4; colIndex < Math.max(taskHeader.length, sessionHeader.length, row.length); colIndex += 1) {
      const taskName = normalizeHeader(taskHeader[colIndex]);
      const sessionName = normalizeHeader(sessionHeader[colIndex]);

      if (!taskName || !sessionName) {
        continue;
      }

      tasks[taskName] ??= { sessions: {}, completed: false };
      tasks[taskName].sessions[sessionName] = isCompletedCell(row[colIndex]);
    }

    records.push({
      subjectName,
      subjectCode,
      paymentStatus,
      cognitiveReportStatus,
      tasks
    });
  }

  if (records.length === 0) {
    errors.push('没有找到可导入的数据。');
  }

  return { records, errors };
}

export async function getTaskCompletionRecords(_req: Request, res: Response) {
  const records = await listTaskCompletionRecords();
  return res.json(records);
}

export async function removeTaskCompletionRecord(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  try {
    await deleteTaskCompletionRecord(id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: '未找到该任务完成度记录。' });
  }
}

export async function patchTaskCompletionRecord(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  const record = await updateTaskCompletionRecord(id, {
    ...('paymentStatus' in req.body ? { paymentStatus: req.body.paymentStatus ? String(req.body.paymentStatus).trim() : null } : {}),
    ...('cognitiveReportStatus' in req.body ? { cognitiveReportStatus: req.body.cognitiveReportStatus ? String(req.body.cognitiveReportStatus).trim() : null } : {}),
    ...('remark' in req.body ? { remark: req.body.remark ? String(req.body.remark).trim() : null } : {}),
    ...('tasks' in req.body && req.body.tasks && typeof req.body.tasks === 'object' ? { tasks: req.body.tasks } : {})
  });

  if (!record) {
    return res.status(404).json({ message: '未找到该任务完成度记录。' });
  }

  return res.json(record);
}

export async function promoteTaskCompletionRecordController(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const currentRound = typeof req.body.currentRound === 'string' ? req.body.currentRound.trim() : '';

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  if (!currentRound) {
    return res.status(400).json({ message: '当前轮次不能为空。' });
  }

  try {
    const record = await promoteTaskCompletionRecord(id, currentRound);

    if (!record) {
      return res.status(404).json({ message: '未找到该任务完成度记录。' });
    }

    return res.json(record);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(400).json({ message: '进入下一轮失败。' });
  }
}

export async function clearTaskCompletionRecordsController(_req: Request, res: Response) {
  const count = await clearTaskCompletionRecords();
  return res.json({ message: '任务完成度记录已清除。', count });
}

export async function importTaskCompletionRecords(req: Request, res: Response) {
  if (!req.file || req.file.size === 0) {
    return res.status(400).json({ message: '文件为空。' });
  }

  const forcedRoundName = normalizeRequestedRound(req.body.roundName);

  if (req.body.roundName && !forcedRoundName) {
    return res.status(400).json({ message: '导入轮次无效。' });
  }

  const { records, errors } = parseCompletionWorkbook(req.file.buffer, forcedRoundName);

  if (errors.length > 0) {
    return res.status(400).json({ message: '任务完成度导入失败。', errors });
  }

  const result = await upsertTaskCompletionRecords(records);
  return res.json({ message: '任务完成度导入完成。', ...result });
}

export async function syncTaskCompletionFromAppointments(req: Request, res: Response) {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const normalizedItems: AppointmentCompletionInput[] = items.map((item: Record<string, unknown>) => ({
    subjectName: String(item.subjectName ?? '').trim(),
    subjectCode: String(item.subjectCode ?? '').trim(),
    taskName: String(item.taskName ?? '').trim(),
    session: String(item.session ?? '').trim(),
    completed: Boolean(item.completed)
  }));

  const result = await syncAppointmentCompletions(normalizedItems);
  const records = await listTaskCompletionRecords();
  return res.json({ message: '任务完成状态已同步。', ...result, records });
}
