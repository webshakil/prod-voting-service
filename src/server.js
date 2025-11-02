// src/server.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🔥 Load .env from root (one level up from src/)
const envPath = join(__dirname, '..', '.env');
console.log('📂 Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Failed to load .env file:', result.error.message);
  console.error('❌ Make sure .env exists at:', envPath);
  process.exit(1);
}

console.log('✅ .env file loaded successfully');

// 🔥 VERIFY immediately
console.log('🔍 Environment loaded:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : 'MISSING');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 🔥 Exit if critical vars missing
if (!process.env.DB_USER || !process.env.DB_HOST) {
  console.error('❌ CRITICAL: Required environment variables missing!');
  console.error('❌ Check your .env file format');
  process.exit(1);
}

console.log('✅ All required environment variables loaded');

// 🔥 NOW import app (env vars are guaranteed to be loaded)
const { default: app } = await import('./app.js');