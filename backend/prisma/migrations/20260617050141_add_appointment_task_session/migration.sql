-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentProjectType" ADD VALUE 'MRI';
ALTER TYPE "AppointmentProjectType" ADD VALUE 'EEG';
ALTER TYPE "AppointmentProjectType" ADD VALUE 'COGNITION';
ALTER TYPE "AppointmentProjectType" ADD VALUE 'INTERVIEW';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "session" TEXT NOT NULL DEFAULT '第一轮';
