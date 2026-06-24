import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import multer from 'multer';
import {
  exportVolunteers,
  getVolunteerSheets,
  getVolunteers,
  importVolunteers,
  postVolunteerSheet,
  postVolunteer,
  putVolunteerSheet,
  putVolunteer,
  removeVolunteerSheet,
  removeVolunteer
} from '../controllers/volunteer.controller.js';

export const volunteerRouter = Router();
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

volunteerRouter.get('/sheets', asyncHandler(getVolunteerSheets));
volunteerRouter.post('/sheets', asyncHandler(postVolunteerSheet));
volunteerRouter.put('/sheets/:id', asyncHandler(putVolunteerSheet));
volunteerRouter.delete('/sheets/:id', asyncHandler(removeVolunteerSheet));
volunteerRouter.get('/', asyncHandler(getVolunteers));
volunteerRouter.post('/', asyncHandler(postVolunteer));
volunteerRouter.put('/:id', asyncHandler(putVolunteer));
volunteerRouter.delete('/:id', asyncHandler(removeVolunteer));
volunteerRouter.post('/import', upload.single('file'), asyncHandler(importVolunteers));
volunteerRouter.get('/export', asyncHandler(exportVolunteers));
