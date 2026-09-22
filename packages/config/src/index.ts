import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_DAYS: z.coerce.number().default(365),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'beta', 'production']).optional(),
  BETA: z.string().optional(),
  BETA_BADGE_PUBLIC: z.string().optional(),
  SEED_PASSWORD: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
