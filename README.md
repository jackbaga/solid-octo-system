# 志愿者管理系统
实验室志愿者管理系统

## 项目结构

```text
backend/
  prisma/
    schema.prisma
  src/
    controllers/
    prisma/
    routes/
    services/
frontend/
  src/
    components/
    constants/
    pages/
    services/
    types/
```

## 后端

后端使用 Node.js、Express、TypeScript、PostgreSQL 和 Prisma。

先启动 PostgreSQL：

```bash
docker compose up -d postgres
```

本项目将 PostgreSQL 映射到本机 `5433` 端口，避免和其他本地数据库冲突。

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

后端默认地址：

```text
http://localhost:4000
```

可用接口：

```text
GET    /api/volunteers
GET    /api/volunteers?status=NO_ANSWER
POST   /api/volunteers
PUT    /api/volunteers/:id
DELETE /api/volunteers/:id
POST   /api/volunteers/import       multipart/form-data，文件字段名：file
GET    /api/volunteers/export
GET    /api/volunteers/export?status=NO_ANSWER
GET    /api/appointments?date=2025-07-20
POST   /api/appointments
PUT    /api/appointments/:id
DELETE /api/appointments/:id
GET    /api/appointments/day?date=2025-07-20
PUT    /api/appointments/day
GET    /api/appointments/export-credentials?date=2025-07-20
POST   /api/appointments/day-summary
```

表格导入模板：

```text
姓名 | 年龄 | 电话
张三 | 20   | 13800000000
```

导入规则：

- 新志愿者默认创建为 `NOT_CALLED` 状态。
- 如果电话已存在，则更新该志愿者的姓名和年龄。
- 导入会校验空文件、缺少姓名、缺少电话、年龄不是数字等情况。

表格导出字段：

```text
姓名 | 年龄 | 电话 | 状态 | 负责老师
```

预约模块：

- 首页点击 `预约` 进入预约页面。
- 页面按年、月、日查看预约日程。
- 默认时间段为 `9:30`、`10:00`、`13:00`、`14:00`、`15:00`。
- 页面左侧显示时间段，点击时间段下方加号创建预约。
- 可新增多个自定义时间段。
- 每个时间段预约数量不限。
- 关联志愿者后，该志愿者状态会自动更新为 `APPOINTED`。
- 预约完成后会在时间段内显示被试姓名、预约项目、备注、状态、关联志愿者等信息。
- 支持再次编辑预约，也支持删除预约；删除预约只删除预约记录，不删除志愿者。
- 右上角可维护当日实验助理。
- 可导出当日预约关联志愿者的账号和密码。
- 当日结束后点击 `更新当日情况`，勾选没做完的任务并确认后，会同步更新任务完成度。

## 前端

前端使用 React、TypeScript、Vite 和 Ant Design。

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:5173
```

Vite 开发服务器会将 `/api` 请求代理到 `http://localhost:4000`。

## Docker 部署

项目已包含生产部署用的 Docker 配置：

```text
postgres  PostgreSQL 数据库
backend   Express + Prisma 后端
frontend  Nginx 静态前端，同时反向代理 /api
```

首次部署：

```bash
cp .env.example .env
```

编辑根目录 `.env`，把 `AUTH_SECRET` 改成足够长的随机字符串。然后启动：

```bash
docker compose up -d --build
```

访问地址：

```text
http://localhost
```

查看运行状态：

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

停止服务：

```bash
docker compose down
```

保留数据库数据时不要删除 volume。若确实需要清空数据库：

```bash
docker compose down -v
```

后端容器启动时会自动执行：

```bash
npx prisma migrate deploy
```

所以服务器部署时不需要手动进入容器跑迁移。

## Vercel 部署前端

Vercel 适合部署本项目的前端静态页面。当前 Express 后端和 PostgreSQL 不在 Vercel 中运行，需要先把后端部署到可公网访问的服务器，例如 Docker 服务器、Render、Railway、Fly.io 或其他 Node.js 主机。

当前根目录部署方式已经包含 `/api` 代理函数。浏览器访问：

```text
https://你的前端域名/api/auth/register
```

时，Vercel 会把请求转发到 `BACKEND_API_URL` 指向的 Express 后端。

根目录部署步骤：

1. 在 Vercel 新建项目并导入本仓库。
2. Root Directory 使用仓库根目录，不要设置为 `frontend`。
3. 在 Vercel 项目的 Environment Variables 中添加：

```text
BACKEND_API_URL=https://你的后端域名/api
```

如果后端部署在 `https://api.example.com`，则填写：

```text
BACKEND_API_URL=https://api.example.com/api
```

4. 点击 Redeploy。

如果你选择把 Vercel 的 Root Directory 设置为 `frontend`，则根目录的 `/api` 代理函数不会被部署。这种部署方式需要改用前端环境变量：

```text
VITE_API_BASE_URL=https://你的后端域名/api
```

然后重新部署前端。

本地前端仍然可以使用：

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

`frontend/.env.example` 中的默认值为：

```text
VITE_API_BASE_URL=http://localhost:4000/api
```
