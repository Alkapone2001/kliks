import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client.js';

export type { PrismaClient };
export { Prisma } from './generated/client/client.js';
export { PaymentState as PersistedPaymentState } from './generated/client/enums.js';

export function createDatabaseClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
