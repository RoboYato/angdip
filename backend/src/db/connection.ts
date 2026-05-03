import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const defaultHost = process.env.DB_HOST || 'localhost';
const defaultPort = parseInt(process.env.DB_PORT || '5432', 10);
const defaultUser = process.env.DB_USER || 'lms_user';
const defaultPassword = process.env.DB_PASSWORD || 'lms_password';
const defaultDatabase = process.env.DB_NAME || 'lms_db';

/** Основная БД (пользователи, курсы, публичные материалы, аудит и т.д.) */
export const mainPool = new Pool({
  host: defaultHost,
  port: defaultPort,
  user: defaultUser,
  password: defaultPassword,
  database: defaultDatabase
});

const classifiedHost = process.env.CLASSIFIED_DB_HOST || process.env.DB_HOST || 'localhost';
const classifiedPort = parseInt(process.env.CLASSIFIED_DB_PORT || process.env.DB_PORT || '5432', 10);
const classifiedUser = process.env.CLASSIFIED_DB_USER || process.env.DB_USER || 'lms_user';
const classifiedPassword = process.env.CLASSIFIED_DB_PASSWORD || process.env.DB_PASSWORD || 'lms_password';
const classifiedDatabase = process.env.CLASSIFIED_DB_NAME || process.env.CLASSIFIED_DB || '';

/**
 * Секретная БД: непубличные материалы, ключи шифрования, журнал доступа к секретным материалам.
 * Если CLASSIFIED_DB_NAME не задан — используется отдельный пул к той же БД (режим разработки без второго инстанса).
 */
export const classifiedPool =
  classifiedDatabase && classifiedDatabase !== defaultDatabase
    ? new Pool({
        host: classifiedHost,
        port: classifiedPort,
        user: classifiedUser,
        password: classifiedPassword,
        database: classifiedDatabase
      })
    : new Pool({
        host: classifiedHost,
        port: classifiedPort,
        user: classifiedUser,
        password: classifiedPassword,
        database: defaultDatabase
      });

/** @deprecated Используйте mainPool; оставлено для постепенной миграции кода */
export const pool = mainPool;

export const aiusPool = new Pool({
  host: process.env.AIUS_DB_HOST || 'localhost',
  port: parseInt(process.env.AIUS_DB_PORT || '5432', 10),
  user: process.env.AIUS_DB_USER || 'aius_user',
  password: process.env.AIUS_DB_PASSWORD || 'aius_password',
  database: process.env.AIUS_DB_NAME || 'aius_db'
});

mainPool.on('error', (err: unknown) => {
  console.error('Unexpected error on mainPool idle client', err);
});

classifiedPool.on('error', (err: unknown) => {
  console.error('Unexpected error on classifiedPool idle client', err);
});

aiusPool.on('error', (err: unknown) => {
  console.error('Unexpected error on AIUS idle client', err);
});

export default mainPool;
