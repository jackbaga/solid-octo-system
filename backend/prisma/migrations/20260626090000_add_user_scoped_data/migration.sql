ALTER TABLE "Volunteer" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "VolunteerSheet" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "AppointmentTaskConfig" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "AppointmentDay" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "TaskCompletion" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "TaskCompletionRecord" ADD COLUMN IF NOT EXISTS "userId" INTEGER;

DROP INDEX IF EXISTS "Volunteer_sheetId_name_phone_key";
DROP INDEX IF EXISTS "VolunteerSheet_name_key";
DROP INDEX IF EXISTS "AppointmentTaskConfig_name_key";
DROP INDEX IF EXISTS "AppointmentDay_date_key";
DROP INDEX IF EXISTS "TaskCompletionRecord_subjectName_subjectCode_key";

CREATE INDEX IF NOT EXISTS "Volunteer_userId_idx" ON "Volunteer"("userId");
CREATE INDEX IF NOT EXISTS "VolunteerSheet_userId_idx" ON "VolunteerSheet"("userId");
CREATE INDEX IF NOT EXISTS "Appointment_userId_idx" ON "Appointment"("userId");
CREATE INDEX IF NOT EXISTS "AppointmentTaskConfig_userId_idx" ON "AppointmentTaskConfig"("userId");
CREATE INDEX IF NOT EXISTS "AppointmentDay_userId_idx" ON "AppointmentDay"("userId");
CREATE INDEX IF NOT EXISTS "TaskCompletion_userId_idx" ON "TaskCompletion"("userId");
CREATE INDEX IF NOT EXISTS "TaskCompletionRecord_userId_idx" ON "TaskCompletionRecord"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Volunteer_userId_sheetId_name_phone_key" ON "Volunteer"("userId", "sheetId", "name", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "VolunteerSheet_userId_name_key" ON "VolunteerSheet"("userId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentTaskConfig_userId_name_key" ON "AppointmentTaskConfig"("userId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentDay_userId_date_key" ON "AppointmentDay"("userId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskCompletionRecord_userId_subjectName_subjectCode_key" ON "TaskCompletionRecord"("userId", "subjectName", "subjectCode");

ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VolunteerSheet" ADD CONSTRAINT "VolunteerSheet_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentTaskConfig" ADD CONSTRAINT "AppointmentTaskConfig_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentDay" ADD CONSTRAINT "AppointmentDay_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskCompletionRecord" ADD CONSTRAINT "TaskCompletionRecord_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
