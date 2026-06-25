import { Request, Response } from 'express';
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

  const result = await registerUser(username, password);
  return res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const { username, password } = normalizeAuthBody(req.body);
  const result = await loginUser(username, password);

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
