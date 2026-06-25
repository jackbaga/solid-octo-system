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

export async function listAppointments(date?: string) {
  return prisma.appointment.findMany({
    where: date ? { date } : undefined,
    include: appointmentInclude,
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }]
  });
}

async function syncAssignedTeacherFromAppointment(
  tx: Prisma.TransactionClient,
  subjectName: string,
  volunteerId?: number | null
) {
  const normalizedName = subjectName.trim();

  if (!normalizedName || !volunteerId) {
    return;
  }

  const volunteer = await tx.volunteer.findUnique({
    where: { id: volunteerId },
    select: { teacher: true }
  });

  const existing = await tx.taskCompletionRecord.findFirst({
    where: { subjectName: normalizedName },
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
      assignedTeacher: volunteer?.teacher ?? null,
      tasks: {}
    }
  });
}

export async function createAppointment(input: AppointmentInput) {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        volunteerId: input.volunteerId ?? null,
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

    if (input.volunteerId) {
      await tx.volunteer.update({
        where: { id: input.volunteerId },
        data: { status: VolunteerStatus.APPOINTED }
      });
    }

    await syncAssignedTeacherFromAppointment(tx, appointment.subjectName, appointment.volunteerId);

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
        ...('projectName' in input ? { projectName: input.projectName ?? null } : {}),
        ...('session' in input ? { session: input.session ?? null } : {}),
        ...('round' in input ? { round: input.round ?? null } : {}),
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

    await syncAssignedTeacherFromAppointment(tx, appointment.subjectName, appointment.volunteerId);

    return appointment;
  });
}

export async function deleteAppointment(id: number) {
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

export async function listAppointmentTaskConfigs() {
  const configs = await prisma.appointmentTaskConfig.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });

  if (configs.length > 0) {
    return configs;
  }

  await prisma.appointmentTaskConfig.createMany({
    data: defaultTaskConfigs.map((config, index) => ({
      ...config,
      sortOrder: index + 1
    }))
  });

  return prisma.appointmentTaskConfig.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function replaceAppointmentTaskConfigs(configs: AppointmentTaskConfigInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.appointmentTaskConfig.deleteMany();
    await tx.appointmentTaskConfig.createMany({
      data: configs.map((config, index) => ({
        name: config.name,
        sessions: config.sessions,
        rounds: config.rounds,
        roundSessions: config.roundSessions,
        sortOrder: index + 1
      }))
    });
  });

  return listAppointmentTaskConfigs();
}

export async function getAppointmentDay(date: string) {
  return prisma.appointmentDay.upsert({
    where: { date },
    update: {},
    create: { date, assistants: [] }
  });
}

export async function listAppointmentDays() {
  return prisma.appointmentDay.findMany();
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
