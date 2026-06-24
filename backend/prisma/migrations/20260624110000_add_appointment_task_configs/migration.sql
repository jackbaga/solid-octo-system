CREATE TABLE "AppointmentTaskConfig" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sessions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rounds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentTaskConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentTaskConfig_name_key" ON "AppointmentTaskConfig"("name");

INSERT INTO "AppointmentTaskConfig" ("name", "sessions", "rounds", "sortOrder", "updatedAt")
VALUES
  ('磁共振', ARRAY['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'], ARRAY[1,2,3,4,5,6,7,8,9,10], 1, CURRENT_TIMESTAMP),
  ('脑电', ARRAY['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'], ARRAY[1,2,3,4,5,6,7,8,9,10], 2, CURRENT_TIMESTAMP),
  ('认知', ARRAY['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'], ARRAY[1,2,3,4,5,6,7,8,9,10], 3, CURRENT_TIMESTAMP),
  ('访谈', ARRAY['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'], ARRAY[1,2,3,4,5,6,7,8,9,10], 4, CURRENT_TIMESTAMP);

ALTER TABLE "Appointment" ADD COLUMN "projectName" TEXT;

UPDATE "Appointment"
SET "projectName" = CASE "projectType"
  WHEN 'MRI' THEN '磁共振'
  WHEN 'EEG' THEN '脑电'
  WHEN 'COGNITION' THEN '认知'
  WHEN 'INTERVIEW' THEN '访谈'
  WHEN 'PARENT_INTERVIEW' THEN '家长访谈'
  WHEN 'FORMAL_TEST' THEN '正式测试'
  ELSE '其它'
END;

ALTER TABLE "Appointment" ALTER COLUMN "subjectName" SET DEFAULT '';
ALTER TABLE "Appointment" ALTER COLUMN "session" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "session" DROP DEFAULT;
ALTER TABLE "Appointment" ALTER COLUMN "round" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "round" DROP DEFAULT;
