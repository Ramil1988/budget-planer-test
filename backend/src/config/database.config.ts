import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  type: 'postgres' as const,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
}));
