import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lspot_db?schema=public';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

export * from '@prisma/client';
export * from './seed.js';
