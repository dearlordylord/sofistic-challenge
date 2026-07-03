import { Controller, Get, Inject } from '@nestjs/common';
import type { DatabaseSync } from 'node:sqlite';
import { DATABASE } from './database/database.module';

@Controller()
export class AppController {
  constructor(@Inject(DATABASE) private readonly db: DatabaseSync) {}

  @Get('health')
  health() {
    const { count } = this.db
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: number };

    return { status: 'ok', transactionsInDb: count };
  }
}
