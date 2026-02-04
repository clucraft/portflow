import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Or use individual params:
  // host: process.env.DB_HOST,
  // port: parseInt(process.env.DB_PORT || '5432'),
  // database: process.env.DB_NAME,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async <T>(text: string, params?: unknown[]): Promise<T[]> => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }

  return res.rows as T[];
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export default pool;
