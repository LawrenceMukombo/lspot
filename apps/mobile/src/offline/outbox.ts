import { OutboxCommandRecord } from './db.js';

export class MobileOutboxManager {
  private queue: OutboxCommandRecord[] = [];

  enqueue(commandType: string, payload: any, deviceId: string): OutboxCommandRecord {
    const cmd: OutboxCommandRecord = {
      idempotencyKey: crypto.randomUUID(),
      deviceId,
      commandType,
      payload,
      clientTimestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0
    };
    this.queue.push(cmd);
    return cmd;
  }

  getPendingCommands(): OutboxCommandRecord[] {
    return this.queue.filter((c) => c.status === 'PENDING');
  }

  markSynced(idempotencyKey: string) {
    const cmd = this.queue.find((c) => c.idempotencyKey === idempotencyKey);
    if (cmd) {
      cmd.status = 'SYNCED';
    }
  }

  markFailed(idempotencyKey: string) {
    const cmd = this.queue.find((c) => c.idempotencyKey === idempotencyKey);
    if (cmd) {
      cmd.retryCount += 1;
      cmd.status = cmd.retryCount > 5 ? 'FAILED' : 'PENDING';
    }
  }
}

export const mobileOutbox = new MobileOutboxManager();
