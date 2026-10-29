import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createDatabaseClient, type PrismaClient } from '@kliks/database';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be set to connect to PostgreSQL.');
    }
    this.client = createDatabaseClient(connectionString);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
