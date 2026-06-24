import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import {
  exportAppointmentCredentials,
  getAppointmentDayInfo,
  getAppointmentTaskConfigs,
  getAppointments,
  postAppointment,
  postAppointmentDaySummary,
  putAppointmentTaskConfigs,
  putAppointmentDayInfo,
  putAppointment,
  removeAppointment
} from '../controllers/appointment.controller.js';

export const appointmentRouter = Router();
const asyncHandler =
  (handler: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

appointmentRouter.get('/', asyncHandler(getAppointments));
appointmentRouter.get('/day', asyncHandler(getAppointmentDayInfo));
appointmentRouter.put('/day', asyncHandler(putAppointmentDayInfo));
appointmentRouter.get('/export-credentials', asyncHandler(exportAppointmentCredentials));
appointmentRouter.post('/day-summary', asyncHandler(postAppointmentDaySummary));
appointmentRouter.get('/task-configs', asyncHandler(getAppointmentTaskConfigs));
appointmentRouter.put('/task-configs', asyncHandler(putAppointmentTaskConfigs));
appointmentRouter.post('/', asyncHandler(postAppointment));
appointmentRouter.put('/:id', asyncHandler(putAppointment));
appointmentRouter.delete('/:id', asyncHandler(removeAppointment));
