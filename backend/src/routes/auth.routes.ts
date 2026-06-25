import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { login, me, register } from '../controllers/auth.controller.js';

export const authRouter = Router();
const asyncHandler =
  (handler: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

authRouter.post('/register', asyncHandler(register));
authRouter.post('/login', asyncHandler(login));
authRouter.get('/me', asyncHandler(me));
