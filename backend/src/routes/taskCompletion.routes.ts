import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import multer from 'multer';
import {
  clearTaskCompletionRecordsController,
  exportTaskCompletionRecords,
  getTaskCompletionRecords,
  importTaskCompletionRecords,
  patchTaskCompletionRecord,
  promoteTaskCompletionRecordController,
  removeTaskCompletionRecord,
  syncTaskCompletionFromAppointments
} from '../controllers/taskCompletion.controller.js';

export const taskCompletionRouter = Router();
const asyncHandler =
  (handler: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('仅支持 .xlsx 文件。'));
  }
});

taskCompletionRouter.get('/records', asyncHandler(getTaskCompletionRecords));
taskCompletionRouter.get('/export', asyncHandler(exportTaskCompletionRecords));
taskCompletionRouter.delete('/records', asyncHandler(clearTaskCompletionRecordsController));
taskCompletionRouter.patch('/records/:id', asyncHandler(patchTaskCompletionRecord));
taskCompletionRouter.post('/records/:id/promote', asyncHandler(promoteTaskCompletionRecordController));
taskCompletionRouter.delete('/records/:id', asyncHandler(removeTaskCompletionRecord));
taskCompletionRouter.post('/import', upload.single('file'), asyncHandler(importTaskCompletionRecords));
taskCompletionRouter.post('/sync-appointments', asyncHandler(syncTaskCompletionFromAppointments));
