import { AppointmentProjectType, AppointmentStatus, Prisma, VolunteerStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface AppointmentInput {
  volunteerId?: number | null;
  subjectName: string;
  date: string;
  time: string;
  projectType: AppointmentProjectType;
  session?: string;
  round?: string;
  remark?: string | null;
  status?: AppointmentStatus;
}

export interface AppointmentUpdateInput {
  volunteerId?: number | null;
  subjectName?: string;
  date?: string;
  time?: string;
  projectType?: AppointmentProjectType;
  session?: string;
  round?: string;
  remark?: string | null;
  status?: AppointmentStatus;
}

const appointmentInclude = {
  volunteer: {
    select: {
      id: true,
      name: true,
      phone: true,
      age: true,
      status: true,
      teacher: true,
      account: true,
      password: true
    }
  },
  taskCompletion: true
} satisfies Prisma.AppointmentInclude;

const appointmentProjectTypeValues = [
  'MRI',
  'EEG',
  'COGNITION',
  'INTERVIEW',
  'PARENT_INTERVIEW',
  'FORMAL_TEST',
  'OTHER'
] as const;

export function isValidAppointmentProjectType(value: unknown): value is AppointmentProjectType {
  return typeof value === 'string' && appointmentProjectTypeValues.includes(value as AppointmentProjectType);
}

export function isValidAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && Object.values(AppointmentStatus).includes(value as AppointmentStatus);
}

export async function listAppointments(date?: string) {
  return prisma.appointment.findMany({
    where: date ? { date } : undefined,
    include: appointmentInclude,
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function createAppointment(input: AppointmentInput) {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        volunteerId: input.volunteerId ?? null,
        subjectName: input.subjectName,
        date: input.date,
        time: input.time,
        projectType: input.projectType,
        session: input.session ?? 'Session 1',
        round: input.round ?? '第一轮',
        remark: input.remark ?? null,
        status: input.status ?? AppointmentStatus.BOOKED
      },
      include: appointmentInclude
    });

    if (input.volunteerId) {
      await tx.volunteer.update({
        where: { id: input.volunteerId },
        data: { status: VolunteerStatus.APPOINTED }
      });
    }

    return appointment;
  });
}

export async function updateAppointment(id: number, input: AppointmentUpdateInput) {
  const current = await prisma.appointment.findUnique({ where: { id } });

  if (!current) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.update({
      where: { id },
      data: {
        ...('volunteerId' in input ? { volunteerId: input.volunteerId ?? null } : {}),
        ...('subjectName' in input ? { subjectName: input.subjectName } : {}),
        ...('date' in input ? { date: input.date } : {}),
        ...('time' in input ? { time: input.time } : {}),
        ...('projectType' in input ? { projectType: input.projectType } : {}),
        ...('session' in input ? { session: input.session } : {}),
        ...('round' in input ? { round: input.round } : {}),
        ...('remark' in input ? { remark: input.remark ?? null } : {}),
        ...('status' in input ? { status: input.status } : {})
      },
      include: appointmentInclude
    });

    if (input.volunteerId) {
      await tx.volunteer.update({
        where: { id: input.volunteerId },
        data: { status: VolunteerStatus.APPOINTED }
      });
    }

    return appointment;
  });
}

export async function deleteAppointment(id: number) {
  await prisma.appointment.delete({ where: { id } });
}

export async function getAppointmentDay(date: string) {
  return prisma.appointmentDay.upsert({
    where: { date },
    update: {},
    create: { date, assistants: [] }
  });
}

export async function updateAppointmentDay(date: string, assistants: string[]) {
  return prisma.appointmentDay.upsert({
    where: { date },
    update: { assistants },
    create: { date, assistants }
  });
}

export async function syncDayTaskCompletion(date: string, incompleteAppointmentIds: number[]) {
  const appointments = await prisma.appointment.findMany({
    where: { date },
    select: { id: true }
  });
  const incompleteSet = new Set(incompleteAppointmentIds);

  await prisma.$transaction(async (tx) => {
    for (const appointment of appointments) {
      const completed = !incompleteSet.has(appointment.id);

      await tx.taskCompletion.upsert({
        where: { appointmentId: appointment.id },
        update: { completed, date },
        create: {
          appointmentId: appointment.id,
          date,
          completed
        }
      });

      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: completed ? AppointmentStatus.COMPLETED : AppointmentStatus.BOOKED }
      });
    }
  });

  return listAppointments(date);
}
