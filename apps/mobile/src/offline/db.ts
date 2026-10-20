export const SQLITE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS cached_menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  selling_price REAL NOT NULL,
  portion_size TEXT NOT NULL,
  remaining_portions INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cached_credit_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  credit_limit REAL NOT NULL,
  current_balance REAL NOT NULL,
  available_credit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_commands (
  idempotency_key TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  client_timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
`;

export interface OutboxCommandRecord {
  idempotencyKey: string;
  deviceId: string;
  commandType: string;
  payload: any;
  clientTimestamp: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retryCount: number;
}
