-- CreateEnum
CREATE TYPE "AppointmentProjectType" AS ENUM ('PARENT_INTERVIEW', 'FORMAL_TEST', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED');

-- CreateTable
ALTER TABLE "Volunteer" ADD COLUMN "account" TEXT,
ADD COLUMN "password" TEXT;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "volunteerId" INTEGER,
    "subjectName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "projectType" "AppointmentProjectType" NOT NULL,
    "remark" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_volunteerId_idx" ON "Appointment"("volunteerId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AppointmentDay" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "assistants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentDay_date_key" ON "AppointmentDay"("date");

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_appointmentId_key" ON "TaskCompletion"("appointmentId");

-- CreateIndex
CREATE INDEX "TaskCompletion_date_idx" ON "TaskCompletion"("date");

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
