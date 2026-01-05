const { sqliteTable, integer, text } = require('drizzle-orm/sqlite-core');

const ttsLogs = sqliteTable('tts_logs', {
    id: integer('id').primaryKey(),
    text: text('text').notNull(),
    voice: text('voice').notNull(),
    rate: text('rate').notNull().default('0%'),
    filename: text('filename').notNull(),
    metadata: text('metadata'), // JSON string
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now()),
});

module.exports = { ttsLogs };
