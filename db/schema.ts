import {sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';

export const vocabularyState = sqliteTable('vocabulary_state', {
  userId: text('user_id').primaryKey().notNull(),
  revision: integer('revision').notNull().default(0),
  stateJson: text('state_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
