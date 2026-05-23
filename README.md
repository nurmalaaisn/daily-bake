# DailyBake API

Backend API untuk sistem pre-order dessert & bakery berbasis NestJS.

## Tech Stack

- NestJS
- Prisma ORM
- PostgreSQL
- Swagger UI
- Railway (deployment)

## Cara Menjalankan Lokal

1. Clone repository
   git clone <repo-url>
   cd dailybake-api

2. Install dependencies
   npm install

3. Copy environment variables
   cp .env.example .env
   Lalu isi nilai DATABASE_URL dan JWT secrets di file .env

4. Generate Prisma client & migrasi database
   npx prisma generate
   npx prisma migrate dev --name init

5. Jalankan server
   npm run start:dev

## API Documentation

Setelah server berjalan, buka:
http://localhost:3000/api/docs

## Environment Variables

Lihat file .env.example untuk daftar lengkap variable yang dibutuhkan.