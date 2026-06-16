import { Prisma, Teacher, VolunteerStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface CreateVolunteerInput {
  name: string;
  age?: number | null;
  phone: string;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
}

export interface UpdateVolunteerInput {
  name?: string;
  age?: number | null;
  phone?: string;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
}

export interface ImportVolunteerInput {
  name: string;
  age?: number | null;
  phone: string;
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
  return prisma.volunteer.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' }
  });
}

export async function createVolunteer(input: CreateVolunteerInput) {
  const status = input.status ?? VolunteerStatus.NOT_CALLED;

  return prisma.volunteer.create({
    data: {
      name: input.name,
      age: input.age ?? null,
      phone: input.phone,
      status,
      teacher: normalizeTeacher(status, input.teacher)
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
    ...('status' in input ? { status: input.status } : {}),
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

export async function importVolunteerRows(rows: ImportVolunteerInput[]) {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.volunteer.findFirst({
        where: { phone: row.phone }
      });

      if (existing) {
        await tx.volunteer.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            age: row.age ?? null
          }
        });
        updated += 1;
      } else {
        await tx.volunteer.create({
          data: {
            name: row.name,
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
