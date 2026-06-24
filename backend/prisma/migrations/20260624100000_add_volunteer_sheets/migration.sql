CREATE TABLE "VolunteerSheet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VolunteerSheet_name_key" ON "VolunteerSheet"("name");

INSERT INTO "VolunteerSheet" ("name", "updatedAt")
VALUES ('默认表格', CURRENT_TIMESTAMP);

ALTER TABLE "Volunteer" ADD COLUMN "sheetId" INTEGER;

UPDATE "Volunteer"
SET "sheetId" = (SELECT "id" FROM "VolunteerSheet" WHERE "name" = '默认表格' LIMIT 1);

ALTER TABLE "Volunteer" ALTER COLUMN "sheetId" SET NOT NULL;

DROP INDEX IF EXISTS "Volunteer_name_phone_key";

CREATE INDEX "Volunteer_sheetId_idx" ON "Volunteer"("sheetId");
CREATE UNIQUE INDEX "Volunteer_sheetId_name_phone_key" ON "Volunteer"("sheetId", "name", "phone");

ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "VolunteerSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
