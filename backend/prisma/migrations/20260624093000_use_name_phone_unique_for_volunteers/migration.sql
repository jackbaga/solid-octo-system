DROP INDEX IF EXISTS "Volunteer_phone_key";

CREATE UNIQUE INDEX "Volunteer_name_phone_key" ON "Volunteer"("name", "phone");
