ALTER TABLE "AppointmentTaskConfig" ADD COLUMN "roundSessions" JSONB NOT NULL DEFAULT '{}';

UPDATE "AppointmentTaskConfig"
SET "roundSessions" = jsonb_build_object(
  '1', to_jsonb("sessions"),
  '2', to_jsonb("sessions"),
  '3', to_jsonb("sessions"),
  '4', to_jsonb("sessions"),
  '5', to_jsonb("sessions"),
  '6', to_jsonb("sessions"),
  '7', to_jsonb("sessions"),
  '8', to_jsonb("sessions"),
  '9', to_jsonb("sessions"),
  '10', to_jsonb("sessions")
)
WHERE "roundSessions" = '{}';
