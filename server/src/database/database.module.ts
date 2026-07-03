import { Global, Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DATABASE = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => {
        const file = join(process.cwd(), 'data', 'app.db');
        if (!existsSync(file)) {
          throw new Error(
            `Database not found at ${file}. Run "npm run seed" from the repo root first.`,
          );
        }
        return new DatabaseSync(file);
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
