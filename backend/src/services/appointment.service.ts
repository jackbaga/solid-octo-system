import { AppointmentProjectType, AppointmentStatus, Prisma, VolunteerStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface AppointmentInput {
  volunteerId?: number | null;
  subjectName?: string;
  date: string;
  time: string;
  projectType?: AppointmentProjectType;
  projectName?: string | null;
  session?: string | null;
  round?: string | null;
  remark?: string | null;
  status?: AppointmentStatus;
}

export interface AppointmentUpdateInput {
  volunteerId?: number | null;
  subjectName?: string;
  date?: string;
  time?: string;
  projectType?: AppointmentProjectType;
  projectName?: string | null;
  session?: string | null;
  round?: string | null;
  remark?: string | null;
  status?: AppointmentStatus;
}

export interface AppointmentTaskConfigInput {
  name: string;
  sessions: string[];
  rounds: number[];
  roundSessions: Record<string, string[]>;
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

export async function listAppointments(userId: number, date?: string) {
  return prisma.appointment.findMany({
    where: {
      userId,
      ...(date ? { date } : {})
    },
    include: appointmentInclude,
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }]
  });
}

async function syncAssignedTeacherFromAppointment(
  tx: Prisma.TransactionClient,
  userId: number,
  subjectName: string,
  volunteerId?: number | null
) {
  const normalizedName = subjectName.trim();

  if (!normalizedName || !volunteerId) {
    return;
  }

  const volunteer = await tx.volunteer.findFirst({
    where: { id: volunteerId, userId },
    select: { teacher: true }
  });

  const existing = await tx.taskCompletionRecord.findFirst({
    where: { userId, subjectName: normalizedName },
    orderBy: [{ updatedAt: 'desc' }]
  });

  if (existing) {
    await tx.taskCompletionRecord.update({
      where: { id: existing.id },
      data: { assignedTeacher: volunteer?.teacher ?? null }
    });
    return;
  }

  await tx.taskCompletionRecord.create({
    data: {
      subjectName: normalizedName,
      subjectCode: '',
      userId,
      assignedTeacher: volunteer?.teacher ?? null,
      tasks: {}
    }
  });
}

export async function createAppointment(userId: number, input: AppointmentInput) {
  return prisma.$transaction(async (tx) => {
    const volunteerId = input.volunteerId
      ? (await tx.volunteer.findFirst({ where: { id: input.volunteerId, userId }, select: { id: true } }))?.id ?? null
      : null;
    const appointment = await tx.appointment.create({
      data: {
        userId,
        volunteerId,
        subjectName: input.subjectName ?? '',
        date: input.date,
        time: input.time,
        projectType: input.projectType ?? AppointmentProjectType.OTHER,
        projectName: input.projectName ?? null,
        session: input.session ?? null,
        round: input.round ?? null,
        remark: input.remark ?? null,
        status: input.status ?? AppointmentStatus.BOOKED
      },
      include: appointmentInclude
    });

    if (volunteerId) {
      await tx.volunteer.updateMany({
        where: { id: volunteerId, userId },
        data: { status: VolunteerStatus.APPOINTED }
      });
    }

    await syncAssignedTeacherFromAppointment(tx, userId, appointment.subjectName, appointment.volunteerId);

    return appointment;
  });
}

export async function updateAppointment(userId: number, id: number, input: AppointmentUpdateInput) {
  const current = await prisma.appointment.findFirst({ where: { id, userId } });

  if (!current) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const volunteerId = 'volunteerId' in input && input.volunteerId
      ? (await tx.volunteer.findFirst({ where: { id: input.volunteerId, userId }, select: { id: true } }))?.id ?? null
      : input.volunteerId ?? null;
    const appointment = await tx.appointment.update({
      where: { id },
      data: {
        ...('volunteerId' in input ? { volunteerId } : {}),
        ...('subjectName' in input ? { subjectName: input.subjectName } : {}),
        ...('date' in input ? { date: input.date } : {}),
        ...('time' in input ? { time: input.time } : {}),
        ...('projectType' in input ? { projectType: input.projectType } : {}),
        ...('projectName' in input ? { projectName: input.projectName ?? null } : {}),
        ...('session' in input ? { session: input.session ?? null } : {}),
        ...('round' in input ? { round: input.round ?? null } : {}),
        ...('remark' in input ? { remark: input.remark ?? null } : {}),
        ...('status' in input ? { status: input.status } : {})
      },
      include: appointmentInclude
    });

    if (volunteerId) {
      await tx.volunteer.updateMany({
        where: { id: volunteerId, userId },
        data: { status: VolunteerStatus.APPOINTED }
      });
    }

    await syncAssignedTeacherFromAppointment(tx, userId, appointment.subjectName, appointment.volunteerId);

    return appointment;
  });
}

export async function deleteAppointment(userId: number, id: number) {
  const appointment = await prisma.appointment.findFirst({ where: { id, userId }, select: { id: true } });

  if (!appointment) {
    throw new Error('NOT_FOUND');
  }

  await prisma.appointment.delete({ where: { id } });
}

const defaultTaskConfigs: AppointmentTaskConfigInput[] = ['磁共振', '脑电', '认知', '访谈'].map((name) => ({
  name,
  sessions: ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'],
  rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  roundSessions: Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [String(index + 1), ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5']])
  )
}));

export async function listAppointmentTaskConfigs(userId: number) {
  const configs = await prisma.appointmentTaskConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });

  if (configs.length > 0) {
    return configs;
  }

  await prisma.appointmentTaskConfig.createMany({
    data: defaultTaskConfigs.map((config, index) => ({
      ...config,
      userId,
      sortOrder: index + 1
    }))
  });

  return prisma.appointmentTaskConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function replaceAppointmentTaskConfigs(userId: number, configs: AppointmentTaskConfigInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.appointmentTaskConfig.deleteMany({ where: { userId } });
    await tx.appointmentTaskConfig.createMany({
      data: configs.map((config, index) => ({
        userId,
        name: config.name,
        sessions: config.sessions,
        rounds: config.rounds,
        roundSessions: config.roundSessions,
        sortOrder: index + 1
      }))
    });
  });

  return listAppointmentTaskConfigs(userId);
}

export async function getAppointmentDay(userId: number, date: string) {
  return prisma.appointmentDay.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date, assistants: [] }
  });
}

export async function listAppointmentDays(userId: number) {
  return prisma.appointmentDay.findMany({ where: { userId } });
}

export async function updateAppointmentDay(userId: number, date: string, assistants: string[]) {
  return prisma.appointmentDay.upsert({
    where: { userId_date: { userId, date } },
    update: { assistants },
    create: { userId, date, assistants }
  });
}

export async function syncDayTaskCompletion(userId: number, date: string, incompleteAppointmentIds: number[]) {
  const appointments = await prisma.appointment.findMany({
    where: { userId, date },
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
          userId,
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

  return listAppointments(userId, date);
}
