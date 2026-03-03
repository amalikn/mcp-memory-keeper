#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const defaultDbPath = path.resolve(process.cwd(), 'context.db');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbArg = args.find(arg => !arg.startsWith('--'));
const dbPath = dbArg ? path.resolve(dbArg) : defaultDbPath;

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

let backupPath = '';
if (!dryRun) {
  backupPath = `${dbPath}.bak-localtime-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
  fs.copyFileSync(dbPath, backupPath);
}

const db = new Database(dbPath);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map(row => row.name);

const explicitTimestampColumns = new Set([
  'created_at',
  'updated_at',
  'timestamp',
  'last_read',
  'applied_at',
  'rolled_back_at',
  'rollback_at',
  'evaluated_at',
  'date_range_start',
  'date_range_end',
  'archived_at',
  'last_run',
]);

let totalUpdates = 0;

db.exec('BEGIN');

try {
  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();

    for (const column of columns) {
      const columnName = String(column.name);
      const columnType = String(column.type || '').toUpperCase();
      const defaultValue = String(column.dflt_value || '').toUpperCase();
      const looksLikeTimestamp =
        explicitTimestampColumns.has(columnName) ||
        /(_at|timestamp|time)$/.test(columnName) ||
        columnType.includes('TIMESTAMP') ||
        columnType.includes('DATETIME') ||
        defaultValue.includes('CURRENT_TIMESTAMP') ||
        defaultValue.includes("DATETIME('NOW'");

      if (!looksLikeTimestamp) {
        continue;
      }

      const statement = `
        UPDATE ${table}
        SET ${columnName} = CASE
          WHEN ${columnName} IS NULL THEN NULL
          WHEN ${columnName} LIKE '%T%' THEN datetime(${columnName}, 'localtime')
          WHEN ${columnName} LIKE '%Z' THEN datetime(${columnName}, 'localtime')
          WHEN ${columnName} LIKE '%+__:__' OR ${columnName} LIKE '%-__:__' THEN datetime(${columnName}, 'localtime')
          ELSE datetime(${columnName}, 'utc', 'localtime')
        END
        WHERE ${columnName} IS NOT NULL
      `;

      const result = db.prepare(statement).run();
      totalUpdates += result.changes;
    }
  }

  if (dryRun) {
    db.exec('ROLLBACK');
  } else {
    db.exec('COMMIT');
  }
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Timestamp migration failed:', error);
  process.exit(1);
}

db.close();

if (dryRun) {
  console.log(`[dry-run] Checked timestamp migration impact for ${dbPath}`);
  console.log(`[dry-run] Rows that would be touched: ${totalUpdates}`);
} else {
  console.log(`Migrated timestamps in ${dbPath}`);
  console.log(`Backup created at ${backupPath}`);
  console.log(`Rows touched: ${totalUpdates}`);
}
