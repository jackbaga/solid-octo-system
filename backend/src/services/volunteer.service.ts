import { Prisma, Teacher, VolunteerStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface CreateVolunteerInput {
  sheetId: number;
  name: string;
  age?: number | null;
  phone: string;
  account?: string | null;
  password?: string | null;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
  remark?: string | null;
}

export interface UpdateVolunteerInput {
  name?: string;
  age?: number | null;
  phone?: string;
  account?: string | null;
  password?: string | null;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
  remark?: string | null;
}

export interface ImportVolunteerInput {
  name: string;
  age?: number | null;
  phone: string;
}

export interface CreateVolunteerSheetInput {
  name: string;
}

const teacherRequiredStatuses = new Set<VolunteerStatus>([
  VolunteerStatus.WECHAT_ADDED,
  VolunteerStatus.APPOINTED
]);

export function isValidVolunteerStatus(value: unknown): value is VolunteerStatus {
  return typeof value === 'string' && Object.values(VolunteerStatus).includes(value as VolunteerStatus);
}

export function isValidTeacher(value: unknown): value is Teacher {
  return typeof value === 'string' && Object.values(Teacher).includes(value as Teacher);
}

export function normalizeTeacher(status: VolunteerStatus, teacher?: Teacher | null) {
  if (!teacherRequiredStatuses.has(status)) {
    return null;
  }

  return teacher ?? null;
}

export async function listVolunteers(status?: VolunteerStatus) {
  throw new Error('listVolunteers requires userId');
}

export async function listVolunteersForUser(userId: number, status?: VolunteerStatus) {
  const defaultSheet = await getDefaultVolunteerSheet(userId);

  return prisma.volunteer.findMany({
    where: {
      userId,
      sheetId: defaultSheet.id,
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listVolunteersBySheet(userId: number, sheetId: number, status?: VolunteerStatus) {
  return prisma.volunteer.findMany({
    where: {
      userId,
      sheetId,
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listVolunteerSheets(userId: number) {
  return prisma.volunteerSheet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getDefaultVolunteerSheet(userId: number) {
  const firstSheet = await prisma.volunteerSheet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  if (firstSheet) {
    return firstSheet;
  }

  return prisma.volunteerSheet.create({
    data: { name: '默认表格', userId }
  });
}

export async function createVolunteerSheet(userId: number, input: CreateVolunteerSheetInput) {
  return prisma.volunteerSheet.create({
    data: { name: input.name, userId }
  });
}

export async function updateVolunteerSheet(userId: number, id: number, input: CreateVolunteerSheetInput) {
  const current = await prisma.volunteerSheet.findFirst({ where: { id, userId } });

  if (!current) {
    return null;
  }

  return prisma.volunteerSheet.update({
    where: { id },
    data: { name: input.name }
  });
}

export async function deleteVolunteerSheet(id: number) {
  throw new Error('deleteVolunteerSheet requires userId');
}

export async function deleteVolunteerSheetForUser(userId: number, id: number) {
  const sheetCount = await prisma.volunteerSheet.count({ where: { userId } });
  const current = await prisma.volunteerSheet.findFirst({ where: { id, userId } });

  if (!current) {
    throw new Error('NOT_FOUND');
  }

  if (sheetCount <= 1) {
    throw new Error('至少需要保留一个表格。');
  }

  await prisma.volunteerSheet.delete({ where: { id } });
}

export async function createVolunteer(userId: number, input: CreateVolunteerInput) {
  const status = input.status ?? VolunteerStatus.NOT_CALLED;
  const sheet = await prisma.volunteerSheet.findFirst({ where: { id: input.sheetId, userId }, select: { id: true } });

  if (!sheet) {
    throw new Error('NOT_FOUND');
  }

  return prisma.volunteer.create({
    data: {
      userId,
      name: input.name,
      sheetId: input.sheetId,
      age: input.age ?? null,
      phone: input.phone,
      account: input.account ?? null,
      password: input.password ?? null,
      status,
      teacher: normalizeTeacher(status, input.teacher),
      remark: input.remark ?? null
    }
  });
}

export async function updateVolunteer(userId: number, id: number, input: UpdateVolunteerInput) {
  const current = await prisma.volunteer.findFirst({ where: { id, userId } });

  if (!current) {
    return null;
  }

  const nextStatus = input.status ?? current.status;
  const nextTeacher = 'teacher' in input ? input.teacher : current.teacher;
  const data: Prisma.VolunteerUpdateInput = {
    ...('name' in input ? { name: input.name } : {}),
    ...('age' in input ? { age: input.age } : {}),
    ...('phone' in input ? { phone: input.phone } : {}),
    ...('account' in input ? { account: input.account } : {}),
    ...('password' in input ? { password: input.password } : {}),
    ...('status' in input ? { status: input.status } : {}),
    ...('remark' in input ? { remark: input.remark } : {}),
    teacher: normalizeTeacher(nextStatus, nextTeacher)
  };

  return prisma.volunteer.update({
    where: { id },
    data
  });
}

export async function deleteVolunteer(id: number) {
  throw new Error('deleteVolunteer requires userId');
}

export async function deleteVolunteerForUser(userId: number, id: number) {
  const current = await prisma.volunteer.findFirst({ where: { id, userId } });

  if (!current) {
    throw new Error('NOT_FOUND');
  }

  await prisma.volunteer.delete({ where: { id } });
}

export async function importVolunteerRows(userId: number, sheetId: number, rows: ImportVolunteerInput[]) {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.volunteer.findFirst({
        where: {
          userId,
          sheetId,
          name: row.name,
          phone: row.phone
        }
      });

      if (existing) {
        await tx.volunteer.update({
          where: { id: existing.id },
          data: {
            age: row.age ?? null
          }
        });
        updated += 1;
      } else {
        await tx.volunteer.create({
          data: {
            name: row.name,
            userId,
            sheetId,
            age: row.age ?? null,
            phone: row.phone,
            status: VolunteerStatus.NOT_CALLED
          }
        });
        created += 1;
      }
    }
  });

  return { created, updated, total: rows.length };
}
