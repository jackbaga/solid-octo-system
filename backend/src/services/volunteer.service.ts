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
  const defaultSheet = await getDefaultVolunteerSheet();

  return prisma.volunteer.findMany({
    where: {
      sheetId: defaultSheet.id,
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listVolunteersBySheet(sheetId: number, status?: VolunteerStatus) {
  return prisma.volunteer.findMany({
    where: {
      sheetId,
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listVolunteerSheets() {
  return prisma.volunteerSheet.findMany({
    orderBy: { createdAt: 'asc' }
  });
}

export async function getDefaultVolunteerSheet() {
  const firstSheet = await prisma.volunteerSheet.findFirst({
    orderBy: { createdAt: 'asc' }
  });

  if (firstSheet) {
    return firstSheet;
  }

  return prisma.volunteerSheet.create({
    data: { name: '默认表格' }
  });
}

export async function createVolunteerSheet(input: CreateVolunteerSheetInput) {
  return prisma.volunteerSheet.create({
    data: { name: input.name }
  });
}

export async function updateVolunteerSheet(id: number, input: CreateVolunteerSheetInput) {
  const current = await prisma.volunteerSheet.findUnique({ where: { id } });

  if (!current) {
    return null;
  }

  return prisma.volunteerSheet.update({
    where: { id },
    data: { name: input.name }
  });
}

export async function deleteVolunteerSheet(id: number) {
  const sheetCount = await prisma.volunteerSheet.count();

  if (sheetCount <= 1) {
    throw new Error('至少需要保留一个表格。');
  }

  await prisma.volunteerSheet.delete({ where: { id } });
}

export async function createVolunteer(input: CreateVolunteerInput) {
  const status = input.status ?? VolunteerStatus.NOT_CALLED;

  return prisma.volunteer.create({
    data: {
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

export async function updateVolunteer(id: number, input: UpdateVolunteerInput) {
  const current = await prisma.volunteer.findUnique({ where: { id } });

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
  await prisma.volunteer.delete({ where: { id } });
}

export async function importVolunteerRows(sheetId: number, rows: ImportVolunteerInput[]) {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.volunteer.findFirst({
        where: {
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
