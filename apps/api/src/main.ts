import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
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

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
    code: err.code || 'INTERNAL_ERROR'
  });
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`LSpot Restaurant Manager API server running on port ${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}${API_PREFIX}`);
  });
}
