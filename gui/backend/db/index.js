import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'klangkiste.sqlite');
const schemaPath = path.join(__dirname, 'schema.sql');

export const db = new sqlite3.Database(dbPath);

db.exec('PRAGMA foreign_keys = ON;');

export function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

export function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

export function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

export async function ensureSchema() {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  return new Promise((resolve, reject) => {
    db.exec(schema, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
  });
}
