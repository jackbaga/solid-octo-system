import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`志愿者管理系统后端已启动：http://localhost:${port}`);
});
