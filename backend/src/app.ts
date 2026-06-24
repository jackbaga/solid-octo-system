import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { appointmentRouter } from './routes/appointment.routes.js';
import { volunteerRouter } from './routes/volunteer.routes.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: '正常' });
});

app.use('/api/volunteers', volunteerRouter);
app.use('/api/appointments', appointmentRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err.message === '仅支持 .xlsx 文件。') {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(400).json({ message: '同名表格或同一表格中的志愿者信息已存在。' });
    }

    if (err.code === 'P2003') {
      return res.status(400).json({ message: '关联数据无效，请刷新后重试。' });
    }
  }

  console.error(err);
  res.status(500).json({ message: '服务器内部错误。' });
});
