# solid-octo-system
Volunteer Management System

## Project Structure

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

## Backend

The backend uses Node.js, Express, TypeScript, PostgreSQL, and Prisma.

Start PostgreSQL first:

```bash
docker compose up -d postgres
```

This project maps PostgreSQL to local port `5433` to avoid conflicts with other local databases.

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Default backend URL:

```text
http://localhost:4000
```

Available APIs:

```text
GET    /api/volunteers
GET    /api/volunteers?status=NO_ANSWER
POST   /api/volunteers
PUT    /api/volunteers/:id
DELETE /api/volunteers/:id
POST   /api/volunteers/import       multipart/form-data, field name: file
GET    /api/volunteers/export
GET    /api/volunteers/export?status=NO_ANSWER
```

Excel import template:

```text
姓名 | 年龄 | 电话
张三 | 20   | 13800000000
```

Import rules:

- New volunteers are created with `NOT_CALLED`.
- If the phone already exists, the existing volunteer's name and age are updated.
- Import validates empty files, missing name, missing phone, and invalid age.

Excel export columns:

```text
姓名 | 年龄 | 电话 | 状态 | 负责老师
```

## Frontend

The frontend uses React, TypeScript, Vite, and Ant Design.

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:4000`.
