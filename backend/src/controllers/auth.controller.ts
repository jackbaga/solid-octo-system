import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { loginUser, registerUser, verifyToken } from '../services/auth.service.js';

function normalizeAuthBody(body: Record<string, unknown>) {
  return {
    username: String(body.username ?? '').trim(),
    password: String(body.password ?? '')
  };
}

function validateAuthInput(username: string, password: string) {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('账号至少需要 3 个字符。');
  }

  if (password.length < 6) {
    errors.push('密码至少需要 6 个字符。');
  }

  return errors;
}

export async function register(req: Request, res: Response) {
  const { username, password } = normalizeAuthBody(req.body);
  const errors = validateAuthInput(username, password);

  if (errors.length > 0) {
    return res.status(400).json({ message: '注册信息有误。', errors });
  }

  try {
    const result = await registerUser(username, password);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json({ message: '该账号已存在，请直接登录或换一个账号。' });
      }

      if (error.code === 'P2021' || error.code === 'P2022') {
        return res.status(500).json({ message: '用户表尚未创建，请先执行数据库迁移。' });
      }
    }

    throw error;
  }
}

export async function login(req: Request, res: Response) {
  const { username, password } = normalizeAuthBody(req.body);
  let result;

  try {
    result = await loginUser(username, password);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022')) {
      return res.status(500).json({ message: '用户表尚未创建，请先执行数据库迁移。' });
    }

    throw error;
  }

  if (!result) {
    return res.status(401).json({ message: '账号或密码错误。' });
  }

  return res.json(result);
}

export async function me(req: Request, res: Response) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ message: '登录已过期，请重新登录。' });
  }

  return res.json({ user });
}
