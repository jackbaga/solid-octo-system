CREATE TABLE "TaskCompletionRecord" (
    "id" SERIAL NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL DEFAULT '',
    "paymentStatus" TEXT,
    "cognitiveReportStatus" TEXT,
    "tasks" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCompletionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskCompletionRecord_subjectName_subjectCode_key" ON "TaskCompletionRecord"("subjectName", "subjectCode");
CREATE INDEX "TaskCompletionRecord_subjectName_idx" ON "TaskCompletionRecord"("subjectName");
