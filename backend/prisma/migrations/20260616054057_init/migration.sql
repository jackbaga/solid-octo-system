-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('NOT_CALLED', 'NO_ANSWER', 'REJECTED', 'AVAILABLE', 'WECHAT_ADDED', 'APPOINTED');

-- CreateEnum
CREATE TYPE "Teacher" AS ENUM ('WANG_LE', 'WEI_SHIYIN');

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "phone" TEXT NOT NULL,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'NOT_CALLED',
    "teacher" "Teacher",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Volunteer_status_idx" ON "Volunteer"("status");

-- CreateIndex
CREATE INDEX "Volunteer_phone_idx" ON "Volunteer"("phone");
