import { Prisma, Teacher } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface CompletionTaskMap {
  [taskName: string]: {
    sessions: Record<string, boolean>;
    completed: boolean;
  };
}

export interface TaskCompletionRecordInput {
  subjectName: string;
  subjectCode?: string;
  paymentStatus?: string | null;
  cognitiveReportStatus?: string | null;
  remark?: string | null;
  tasks: CompletionTaskMap;
}

export interface AppointmentCompletionInput {
  subjectName: string;
  subjectCode?: string | null;
  taskName: string;
  session?: string | null;
  completed: boolean;
}

export interface UpdateTaskCompletionRecordInput {
  parentAccount?: string | null;
  parentPassword?: string | null;
  parentPhone?: string | null;
  personalAccount?: string | null;
  personalPassword?: string | null;
  assignedTeacher?: Teacher | null;
  paymentStatus?: string | null;
  cognitiveReportStatus?: string | null;
  remark?: string | null;
  tasks?: CompletionTaskMap;
}

const roundLabels = ['第一轮', '第二轮', '第三轮', '第四轮', '第五轮', '第六轮', '第七轮', '第八轮', '第九轮', '第十轮'];

function normalizeCode(value?: string | null) {
  return value?.trim() ?? '';
}

function normalizeTasks(tasks: CompletionTaskMap) {
  return Object.fromEntries(
    Object.entries(tasks).map(([taskName, task]) => {
      const sessions = task.sessions ?? {};
      const sessionValues = Object.values(sessions);
      return [
        taskName,
        {
          sessions,
          completed: sessionValues.length > 0 && sessionValues.every(Boolean)
        }
      ];
    })
  ) as CompletionTaskMap;
}

function asTaskMap(value: Prisma.JsonValue | null | undefined): CompletionTaskMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as CompletionTaskMap;
}

function mergeTaskMaps(base: CompletionTaskMap, incoming: CompletionTaskMap) {
  const merged: CompletionTaskMap = { ...base };

  for (const [taskName, task] of Object.entries(incoming)) {
    const currentTask = merged[taskName] ?? { sessions: {}, completed: false };
    merged[taskName] = {
      sessions: {
        ...currentTask.sessions,
        ...(task.sessions ?? {})
      },
      completed: false
    };
  }

  return normalizeTasks(merged);
}

function getNextRoundName(currentRound: string) {
  const index = roundLabels.indexOf(currentRound);
  return index >= 0 && index < roundLabels.length - 1 ? roundLabels[index + 1] : null;
}

function replaceTaskRound(taskName: string, currentRound: string, nextRound: string) {
  if (taskName.startsWith(`${currentRound}-`)) {
    return `${nextRound}-${taskName.slice(currentRound.length + 1)}`;
  }

  return `${nextRound}-${taskName}`;
}

export async function listTaskCompletionRecords() {
  return prisma.taskCompletionRecord.findMany({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });
}

export async function deleteTaskCompletionRecord(id: number) {
  await prisma.taskCompletionRecord.delete({ where: { id } });
}

export async function clearTaskCompletionRecords() {
  const result = await prisma.taskCompletionRecord.deleteMany();
  return result.count;
}

export async function updateTaskCompletionRecord(id: number, input: UpdateTaskCompletionRecordInput) {
  const current = await prisma.taskCompletionRecord.findUnique({ where: { id } });

  if (!current) {
    return null;
  }

  return prisma.taskCompletionRecord.update({
    where: { id },
    data: {
      ...('parentAccount' in input ? { parentAccount: input.parentAccount ?? null } : {}),
      ...('parentPassword' in input ? { parentPassword: input.parentPassword ?? null } : {}),
      ...('parentPhone' in input ? { parentPhone: input.parentPhone ?? null } : {}),
      ...('personalAccount' in input ? { personalAccount: input.personalAccount ?? null } : {}),
      ...('personalPassword' in input ? { personalPassword: input.personalPassword ?? null } : {}),
      ...('assignedTeacher' in input ? { assignedTeacher: input.assignedTeacher ?? null } : {}),
      ...('paymentStatus' in input ? { paymentStatus: input.paymentStatus ?? null } : {}),
      ...('cognitiveReportStatus' in input ? { cognitiveReportStatus: input.cognitiveReportStatus ?? null } : {}),
      ...('remark' in input ? { remark: input.remark ?? null } : {}),
      ...('tasks' in input && input.tasks ? { tasks: normalizeTasks(input.tasks) } : {})
    }
  });
}

export async function syncTaskCompletionTeacher(subjectName: string, assignedTeacher?: Teacher | null) {
  const normalizedName = subjectName.trim();

  if (!normalizedName) {
    return null;
  }

  const existing = await prisma.taskCompletionRecord.findFirst({
    where: { subjectName: normalizedName },
    orderBy: [{ updatedAt: 'desc' }]
  });

  if (existing) {
    return prisma.taskCompletionRecord.update({
      where: { id: existing.id },
      data: { assignedTeacher: assignedTeacher ?? null }
    });
  }

  return prisma.taskCompletionRecord.create({
    data: {
      subjectName: normalizedName,
      subjectCode: '',
      assignedTeacher: assignedTeacher ?? null,
      tasks: {}
    }
  });
}

export async function promoteTaskCompletionRecord(id: number, currentRound: string) {
  const nextRound = getNextRoundName(currentRound);

  if (!nextRound) {
    throw new Error('当前轮次不能进入下一轮。');
  }

  const current = await prisma.taskCompletionRecord.findUnique({ where: { id } });

  if (!current) {
    return null;
  }

  const tasks = asTaskMap(current.tasks);
  const nextTasks: CompletionTaskMap = {};

  for (const [taskName, task] of Object.entries(tasks)) {
    if (taskName.startsWith(`${currentRound}-`)) {
      const nextTaskName = replaceTaskRound(taskName, currentRound, nextRound);

      if (!tasks[nextTaskName] && !nextTasks[nextTaskName]) {
        nextTasks[nextTaskName] = {
          sessions: Object.fromEntries(
            Object.keys(task.sessions ?? {}).map((sessionName) => [sessionName, false])
          ),
          completed: false
        };
      }

      continue;
    }

    nextTasks[taskName] = task;
  }

  return prisma.taskCompletionRecord.update({
    where: { id },
    data: {
      paymentStatus: '未发放',
      cognitiveReportStatus: '未发放',
      tasks: normalizeTasks(nextTasks)
    }
  });
}

export async function upsertTaskCompletionRecords(records: TaskCompletionRecordInput[]) {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      const subjectCode = normalizeCode(record.subjectCode);
      const existing = await tx.taskCompletionRecord.findUnique({
        where: {
          subjectName_subjectCode: {
            subjectName: record.subjectName,
            subjectCode
          }
        }
      });
      const tasks = normalizeTasks(record.tasks);

      if (existing) {
        const mergedTasks = mergeTaskMaps(asTaskMap(existing.tasks), tasks);
        await tx.taskCompletionRecord.update({
          where: { id: existing.id },
          data: {
            paymentStatus: record.paymentStatus ?? existing.paymentStatus,
            cognitiveReportStatus: record.cognitiveReportStatus ?? existing.cognitiveReportStatus,
            remark: record.remark ?? existing.remark,
            tasks: mergedTasks
          }
        });
        updated += 1;
      } else {
        await tx.taskCompletionRecord.create({
          data: {
            subjectName: record.subjectName,
            subjectCode,
            paymentStatus: record.paymentStatus ?? null,
            cognitiveReportStatus: record.cognitiveReportStatus ?? null,
            remark: record.remark ?? null,
            tasks
          }
        });
        created += 1;
      }
    }
  });

  return { created, updated, total: records.length };
}

export async function syncAppointmentCompletions(items: AppointmentCompletionInput[]) {
  let touched = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const subjectName = item.subjectName.trim();
      const taskName = item.taskName.trim();
      const session = item.session?.trim();

      if (!subjectName || !taskName || !session) {
        continue;
      }

      const subjectCode = normalizeCode(item.subjectCode);
      const existing = subjectCode
        ? await tx.taskCompletionRecord.findUnique({
            where: {
              subjectName_subjectCode: {
                subjectName,
                subjectCode
              }
            }
          })
        : await tx.taskCompletionRecord.findFirst({
            where: { subjectName },
            orderBy: [{ updatedAt: 'desc' }]
          });
      const tasks = asTaskMap(existing?.tasks);
      const task = tasks[taskName] ?? { sessions: {}, completed: false };
      const sessions = { ...task.sessions, [session]: item.completed };
      const nextTasks = normalizeTasks({
        ...tasks,
        [taskName]: {
          sessions,
          completed: false
        }
      });

      if (existing) {
        await tx.taskCompletionRecord.update({
          where: { id: existing.id },
          data: { tasks: nextTasks }
        });
      } else {
        await tx.taskCompletionRecord.create({
          data: {
            subjectName,
            subjectCode,
            tasks: nextTasks
          }
        });
      }

      touched += 1;
    }
  });

  return { touched };
}
