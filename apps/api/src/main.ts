import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

import { authRouter } from './controllers/auth.controller.js';
import { restaurantRouter } from './controllers/restaurant.controller.js';
import { menuRouter } from './controllers/menu.controller.js';
import { recipeRouter } from './controllers/recipe.controller.js';
import { inventoryRouter } from './controllers/inventory.controller.js';
import { kitchenRouter } from './controllers/kitchen.controller.js';
import { posRouter } from './controllers/pos.controller.js';
import { creditRouter } from './controllers/credit.controller.js';
import { invoiceRouter } from './controllers/invoice.controller.js';
import { shiftRouter } from './controllers/shift.controller.js';
import { financeRouter } from './controllers/finance.controller.js';
import { syncRouter } from './controllers/sync.controller.js';
import { zraRouter } from './controllers/zra.controller.js';

export const app = express();

// Security Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Healthcheck & System Info
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    system: 'LSpot Restaurant Manager API',
    location: 'Manyama, Kalumbila, Zambia',
    currency: 'ZMW',
    timezone: 'Africa/Lusaka',
    timestamp: new Date().toISOString()
  });
});

// Mount Domain API routes under /api/v1
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/restaurant`, restaurantRouter);
app.use(`${API_PREFIX}/menu`, menuRouter);
app.use(`${API_PREFIX}/recipes`, recipeRouter);
app.use(`${API_PREFIX}/inventory`, inventoryRouter);
app.use(`${API_PREFIX}/kitchen`, kitchenRouter);
app.use(`${API_PREFIX}/pos`, posRouter);
app.use(`${API_PREFIX}/credit`, creditRouter);
app.use(`${API_PREFIX}/invoices`, invoiceRouter);
app.use(`${API_PREFIX}/shifts`, shiftRouter);
app.use(`${API_PREFIX}/finance`, financeRouter);
app.use(`${API_PREFIX}/sync`, syncRouter);
app.use(`${API_PREFIX}/zra`, zraRouter);

// Serve static SPA build in production if present on disk
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// Global Error Handler (ERR-01: Prisma error mapping and safe error sanitization)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Application Error:', err);

  let status = err.status || err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred.';

  // Map known Prisma ORM errors to user-friendly messages and appropriate HTTP statuses
  if (err.name === 'PrismaClientKnownRequestError' || (typeof err.code === 'string' && err.code.startsWith('P'))) {
    switch (err.code) {
      case 'P2002':
        status = 409;
        code = 'RECORD_ALREADY_EXISTS';
        message = 'A record with this unique value or identifier already exists.';
        break;
      case 'P2025':
        status = 404;
        code = 'RECORD_NOT_FOUND';
        message = 'The requested database record was not found.';
        break;
      case 'P2003':
        status = 400;
        code = 'FOREIGN_KEY_VIOLATION';
        message = 'A referenced record or constraint does not exist.';
        break;
      case 'P2014':
        status = 400;
        code = 'RELATION_VIOLATION';
        message = 'The change would violate the relation constraint between records.';
        break;
      default:
        status = 500;
        code = 'DATABASE_ERROR';
        message = 'A database operation error occurred. Please try again.';
        break;
    }
  } else if (err.name === 'ZodError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed.';
  } else if (status >= 500 && process.env.NODE_ENV === 'production') {
    // In production, prevent leaking internal details or raw stack traces
    message = 'An unexpected server error occurred. Please contact system support.';
  }

  res.status(status).json({
    success: false,
    message,
    code
  });
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`LSpot Restaurant Manager API server running on port ${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}${API_PREFIX}`);
  });
}
