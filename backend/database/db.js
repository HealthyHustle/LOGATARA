import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
const isPostgres = Boolean(DATABASE_URL);

let sqliteDb = null;
let pgPool = null;

function convertPlaceholdersToPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function initDatabase() {
  if (isPostgres) {
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });
    const schema = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf8');
    await pgPool.query(schema);
    return { engine: 'postgresql' };
  }

  const dbPath = path.join(__dirname, 'logatara.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sqlite.sql'), 'utf8');
  sqliteDb.exec(schema);
  return { engine: 'sqlite', path: dbPath };
}

export function getDbEngine() {
  return isPostgres ? 'postgresql' : 'sqlite';
}

export async function queryAll(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(convertPlaceholdersToPg(sql), params);
    return res.rows;
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.all(...params);
}

export async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql, params = []) {
  if (isPostgres) {
    const pgSql = convertPlaceholdersToPg(sql);
    const hasReturning = /\bRETURNING\b/i.test(pgSql);
    const isInsert = /^\s*INSERT\b/i.test(pgSql);
    const finalSql = isInsert && !hasReturning && !/\bON CONFLICT\b/i.test(pgSql)
      ? `${pgSql} RETURNING id`
      : pgSql;
    const res = await pgPool.query(finalSql, params);
    return {
      changes: res.rowCount ?? 0,
      lastInsertRowid: res.rows?.[0]?.id ?? null,
      rows: res.rows ?? [],
    };
  }
  const stmt = sqliteDb.prepare(sql);
  const res = stmt.run(...params);
  return {
    changes: Number(res.changes ?? 0),
    lastInsertRowid: Number(res.lastInsertRowid ?? 0),
    rows: [],
  };
}

export async function runInTransaction(fn) {
  if (isPostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  sqliteDb.exec('BEGIN');
  try {
    const result = await fn();
    sqliteDb.exec('COMMIT');
    return result;
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }
}
