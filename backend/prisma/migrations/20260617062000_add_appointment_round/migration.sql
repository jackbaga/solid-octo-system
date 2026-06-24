ALTER TABLE "Appointment" ADD COLUMN "round" TEXT NOT NULL DEFAULT '第一轮';

UPDATE "Appointment"
SET
  "round" = "session",
  "session" = 'Session 1'
WHERE "session" LIKE '第%轮';
