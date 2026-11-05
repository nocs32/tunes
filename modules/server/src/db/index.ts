import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrations } from './migrations.ts';

export type Db = DatabaseSync;

const userVersion = (db: Db): number => {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };

  return row.user_version;
};

// Runs the migrations this file hasn't seen yet, each in its own transaction.
export const migrate = (db: Db): number => {
  const from = userVersion(db);

  migrations.slice(from).forEach((sql, index) => {
    const version = from + index + 1;

    db.exec('BEGIN');

    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${version} failed`, { cause: error });
    }
  });

  return userVersion(db);
};

// `:memory:` gives a throwaway database (tests).
export const openDb = (file: string): Db => {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);

  return db;
};
