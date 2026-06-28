import {
  bigint,
  index,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

export const personalAccessTokens = mysqlTable(
  'personal_access_tokens',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tokenableType: varchar('tokenable_type', { length: 255 }).notNull(),
    tokenableId: bigint('tokenable_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    token: varchar('token', { length: 64 }).notNull(),
    abilities: text('abilities'),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('personal_access_tokens_tokenable_type_tokenable_id_index').on(
      table.tokenableType,
      table.tokenableId,
    ),
    uniqueIndex('personal_access_tokens_token_unique').on(table.token),
  ],
);
