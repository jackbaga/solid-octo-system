import { Request, Response } from 'express';
import { Teacher } from '@prisma/client';
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
import { listAppointmentTaskConfigs } from '../services/appointment.service.js';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function getUserId(req: Request) {
  if (!req.user) {
    throw new Error('UNAUTHORIZED');
  }

  return req.user.id;
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

function displayDistributionStatus(value: unknown) {
  return isCompletedCell(value) ? 1 : 0;
}

function displayCompletionStatus(value: unknown) {
  return value ? 1 : 0;
}

function normalizeTeacher(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const text = String(value).trim();
  return Object.values(Teacher).includes(text as Teacher) ? text as Teacher : undefined;
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
const roundLabels = ['第一轮', '第二轮', '第三轮', '第四轮', '第五轮', '第六轮', '第七轮', '第八轮', '第九轮', '第十轮'];
const teacherLabels: Record<Teacher, string> = {
  WANG_LE: '王乐老师',
  WEI_SHIYIN: '魏诗荫老师'
};

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

function stripRoundPrefix(value: string) {
  return normalizeHeader(value).replace(/^第[一二三四五六七八九十]轮-/, '');
}

function getTaskRoundName(taskName: string) {
  const match = normalizeHeader(taskName).match(/^(第[一二三四五六七八九十]轮)-/);
  return match?.[1] ?? null;
}

function getRoundNumber(roundName: string | null) {
  const chineseRounds = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const match = roundName?.match(/^第([一二三四五六七八九十])轮$/);
  return match ? chineseRounds.indexOf(match[1]) + 1 : null;
}

function sortSessions(sessions: string[]) {
  return sessions
    .map((sessionName, index) => {
      const match = sessionName.match(/\d+/);
      return {
        sessionName,
        index,
        number: match ? Number(match[0]) : Number.POSITIVE_INFINITY
      };
    })
    .sort((a, b) => a.number - b.number || a.index - b.index)
    .map((item) => item.sessionName);
}

type AllowedCompletionMap = Map<string, Map<string, Set<string>>>;

async function buildAllowedCompletionMap(userId: number) {
  const configs = await listAppointmentTaskConfigs(userId);
  const allowed: AllowedCompletionMap = new Map();

  for (const config of configs) {
    const taskBaseName = stripRoundPrefix(config.name);
    const roundSessions = config.roundSessions && typeof config.roundSessions === 'object' && !Array.isArray(config.roundSessions)
      ? config.roundSessions as Record<string, unknown>
      : {};

    for (const round of config.rounds) {
      const roundName = normalizeRoundName(`第${round}轮`);
      const sessions = Array.isArray(roundSessions[String(round)])
        ? (roundSessions[String(round)] as unknown[]).map((session) => normalizeHeader(session)).filter(Boolean)
        : config.sessions;

      if (sessions.length === 0) {
        continue;
      }

      if (!allowed.has(roundName)) {
        allowed.set(roundName, new Map());
      }

      allowed.get(roundName)?.set(taskBaseName, new Set(sessions));
    }
  }

  return allowed;
}

function filterTasksBySettings(tasks: CompletionTaskMap, allowed: AllowedCompletionMap) {
  const nextTasks: CompletionTaskMap = {};

  if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks)) {
    return nextTasks;
  }

  for (const [taskName, task] of Object.entries(tasks)) {
    const roundName = getTaskRoundName(taskName);
    const taskBaseName = stripRoundPrefix(taskName);
    const allowedSessions = roundName ? allowed.get(roundName)?.get(taskBaseName) : undefined;

    if (!roundName || !allowedSessions) {
      continue;
    }

    const sessions = Object.fromEntries(
      Object.entries(task.sessions ?? {}).filter(([sessionName]) => allowedSessions.has(sessionName))
    );

    if (Object.keys(sessions).length === 0) {
      continue;
    }

    const sessionValues = Object.values(sessions);
    nextTasks[`${roundName}-${taskBaseName}`] = {
      sessions,
      completed: sessionValues.length > 0 && sessionValues.every(Boolean)
    };
  }

  return nextTasks;
}

function filterRecordsBySettings(records: TaskCompletionRecordInput[], allowed: AllowedCompletionMap) {
  return records
    .map((record) => ({
      ...record,
      tasks: filterTasksBySettings(record.tasks, allowed)
    }))
    .filter((record) => Object.keys(record.tasks).length > 0);
}

async function buildRoundExportDefinitions(userId: number) {
  const configs = await listAppointmentTaskConfigs(userId);

  return roundLabels.map((roundName, roundIndex) => {
    const round = roundIndex + 1;
    const tasks = configs.flatMap((config, configIndex) => {
      const taskBaseName = stripRoundPrefix(config.name);
      const roundSessions = config.roundSessions && typeof config.roundSessions === 'object' && !Array.isArray(config.roundSessions)
        ? config.roundSessions as Record<string, unknown>
        : {};
      const sessions = Array.isArray(roundSessions[String(round)])
        ? (roundSessions[String(round)] as unknown[]).map((session) => normalizeHeader(session)).filter(Boolean)
        : config.sessions.map((session) => normalizeHeader(session)).filter(Boolean);

      if (!config.rounds.includes(round) || sessions.length === 0) {
        return [];
      }

      return [{
        taskName: `${roundName}-${taskBaseName}`,
        displayName: taskBaseName,
        sessions: sortSessions(Array.from(new Set(sessions))),
        sortOrder: configIndex
      }];
    }).sort((a, b) => {
      const aIsParent = a.displayName.includes('家长');
      const bIsParent = b.displayName.includes('家长');

      if (aIsParent !== bIsParent) {
        return aIsParent ? 1 : -1;
      }

      return a.sortOrder - b.sortOrder;
    });

    return { roundName, tasks };
  });
}

function buildRoundWorksheet(roundName: string, tasks: Awaited<ReturnType<typeof buildRoundExportDefinitions>>[number]['tasks'], records: Awaited<ReturnType<typeof listTaskCompletionRecords>>) {
  const baseHeaders = ['姓名', '编号', '分配老师'];
  const tailHeaders = ['被试费发放情况', '认知报告发放', '备注'];
  const firstHeader = [...baseHeaders];
  const secondHeader = baseHeaders.map(() => '');
  const merges: XLSX.Range[] = [];

  baseHeaders.forEach((_, index) => {
    merges.push({ s: { r: 0, c: index }, e: { r: 1, c: index } });
  });

  let columnIndex = baseHeaders.length;

  for (const task of tasks) {
    const childHeaders = ['任务', ...task.sessions];
    firstHeader.push(task.displayName, ...Array.from({ length: childHeaders.length - 1 }, () => ''));
    secondHeader.push(...childHeaders);

    if (childHeaders.length > 1) {
      merges.push({ s: { r: 0, c: columnIndex }, e: { r: 0, c: columnIndex + childHeaders.length - 1 } });
    }

    columnIndex += childHeaders.length;
  }

  firstHeader.push(...tailHeaders);
  secondHeader.push(...tailHeaders.map(() => ''));
  tailHeaders.forEach((_, index) => {
    const tailColumn = columnIndex + index;
    merges.push({ s: { r: 0, c: tailColumn }, e: { r: 1, c: tailColumn } });
  });

  const rows = records
    .filter((record) => tasks.some((task) => Boolean((record.tasks as CompletionTaskMap)?.[task.taskName])))
    .map((record) => {
      const tasksMap = record.tasks as CompletionTaskMap;
      const row: unknown[] = [
        record.subjectName,
        record.subjectCode,
        record.assignedTeacher ? teacherLabels[record.assignedTeacher] : ''
      ];

      for (const task of tasks) {
        const recordTask = tasksMap?.[task.taskName];
        row.push(displayCompletionStatus(recordTask?.completed));
        for (const session of task.sessions) {
          row.push(displayCompletionStatus(recordTask?.sessions?.[session]));
        }
      }

      row.push(
        displayDistributionStatus(record.paymentStatus),
        displayDistributionStatus(record.cognitiveReportStatus),
        record.remark ?? ''
      );

      return row;
    });

  const worksheet = XLSX.utils.aoa_to_sheet([firstHeader, secondHeader, ...rows]);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    ...tasks.flatMap((task) => [{ wch: 10 }, ...task.sessions.map(() => ({ wch: 14 }))]),
    { wch: 16 },
    { wch: 16 },
    { wch: 24 }
  ];
  return worksheet;
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

  const previousHeader = headerRowIndex > 0 ? rows[headerRowIndex - 1] ?? [] : [];
  const currentHeader = rows[headerRowIndex] ?? [];
  const hasTaskGroupHeader = previousHeader.slice(2).some((cell) => normalizeHeader(cell));
  const groupHeader = hasTaskGroupHeader ? previousHeader : currentHeader;
  const sessionHeader = hasTaskGroupHeader ? currentHeader : rows[headerRowIndex + 1] ?? [];
  const dataStartRow = hasTaskGroupHeader ? headerRowIndex + 1 : headerRowIndex + 2;
  const nameCol = findColumn(sessionHeader, (header) => header === '被试姓名');
  const codeCol = findColumn(sessionHeader, (header) => header === '被试编号');
  const roundName = forcedRoundName ?? '第一轮';
  const paymentCol = findColumn(groupHeader, (header) => header.includes('被试费发放'));
  const cognitiveReportCol = findColumn(groupHeader, (header) => header === '认知报告发放');
  const remarkCol = findGlobalRemarkColumn(groupHeader, sessionHeader);
  const records: TaskCompletionRecordInput[] = [];

  for (let rowIndex = dataStartRow; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const subjectName = normalizeHeader(row[nameCol >= 0 ? nameCol : 0]);
    const subjectCode = normalizeHeader(row[codeCol >= 0 ? codeCol : 1]);

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

export async function getTaskCompletionRecords(req: Request, res: Response) {
  const userId = getUserId(req);
  const records = await listTaskCompletionRecords(userId);
  const allowed = await buildAllowedCompletionMap(userId);
  const filteredRecords = records
    .map((record) => ({
      ...record,
      tasks: filterTasksBySettings(record.tasks as CompletionTaskMap, allowed)
    }))
    .filter((record) => Object.keys(record.tasks).length > 0);
  return res.json(filteredRecords);
}

export async function removeTaskCompletionRecord(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  try {
    await deleteTaskCompletionRecord(userId, id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: '未找到该任务完成度记录。' });
  }
}

export async function patchTaskCompletionRecord(req: Request, res: Response) {
  const userId = getUserId(req);
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  const record = await updateTaskCompletionRecord(userId, id, {
    ...('parentAccount' in req.body ? { parentAccount: req.body.parentAccount ? String(req.body.parentAccount).trim() : null } : {}),
    ...('parentPassword' in req.body ? { parentPassword: req.body.parentPassword ? String(req.body.parentPassword).trim() : null } : {}),
    ...('parentPhone' in req.body ? { parentPhone: req.body.parentPhone ? String(req.body.parentPhone).trim() : null } : {}),
    ...('personalAccount' in req.body ? { personalAccount: req.body.personalAccount ? String(req.body.personalAccount).trim() : null } : {}),
    ...('personalPassword' in req.body ? { personalPassword: req.body.personalPassword ? String(req.body.personalPassword).trim() : null } : {}),
    ...('assignedTeacher' in req.body ? { assignedTeacher: normalizeTeacher(req.body.assignedTeacher) ?? null } : {}),
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
  const userId = getUserId(req);
  const id = parseId(req.params.id);
  const currentRound = typeof req.body.currentRound === 'string' ? req.body.currentRound.trim() : '';

  if (!id) {
    return res.status(400).json({ message: '任务完成度记录编号无效。' });
  }

  if (!currentRound) {
    return res.status(400).json({ message: '当前轮次不能为空。' });
  }

  try {
    const record = await promoteTaskCompletionRecord(userId, id, currentRound);

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

export async function clearTaskCompletionRecordsController(req: Request, res: Response) {
  const userId = getUserId(req);
  const count = await clearTaskCompletionRecords(userId);
  return res.json({ message: '任务完成度记录已清除。', count });
}

export async function importTaskCompletionRecords(req: Request, res: Response) {
  const userId = getUserId(req);
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

  const allowed = await buildAllowedCompletionMap(userId);
  const filteredRecords = filterRecordsBySettings(records, allowed);
  const result = await upsertTaskCompletionRecords(userId, filteredRecords);
  return res.json({ message: '任务完成度导入完成。', ...result });
}

export async function syncTaskCompletionFromAppointments(req: Request, res: Response) {
  const userId = getUserId(req);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const normalizedItems: AppointmentCompletionInput[] = items.map((item: Record<string, unknown>) => ({
    subjectName: String(item.subjectName ?? '').trim(),
    subjectCode: String(item.subjectCode ?? '').trim(),
    taskName: String(item.taskName ?? '').trim(),
    session: String(item.session ?? '').trim(),
    completed: Boolean(item.completed)
  }));

  const result = await syncAppointmentCompletions(userId, normalizedItems);
  const records = await listTaskCompletionRecords(userId);
  return res.json({ message: '任务完成状态已同步。', ...result, records });
}

export async function exportTaskCompletionRecords(req: Request, res: Response) {
  const userId = getUserId(req);
  const records = await listTaskCompletionRecords(userId);
  const allowed = await buildAllowedCompletionMap(userId);
  const filteredRecords = records
    .map((record) => ({
      ...record,
      tasks: filterTasksBySettings(record.tasks as CompletionTaskMap, allowed)
    }))
    .filter((record) => Object.keys(record.tasks).length > 0);
  const roundDefinitions = await buildRoundExportDefinitions(userId);
  const workbook = XLSX.utils.book_new();

  for (const definition of roundDefinitions) {
    const worksheet = buildRoundWorksheet(definition.roundName, definition.tasks, filteredRecords);
    XLSX.utils.book_append_sheet(workbook, worksheet, definition.roundName);
  }

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent('任务完成度.xlsx')}"`);
  return res.send(buffer);
}
