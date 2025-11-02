// src/config/database.js
import pg from 'pg';
const { Pool } = pg;

console.log('🔍 DATABASE CONFIG DEBUG:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : 'MISSING');
console.log('DB_SSL:', process.env.DB_SSL);

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'vottery',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
};

console.log('🔧 ACTUAL POOL CONFIG:', {
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user,
  password: poolConfig.password ? '***' + poolConfig.password.slice(-4) : 'MISSING',
  ssl: poolConfig.ssl
});

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// Test connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection test successful');
    console.log('📊 Database info:', {
      host: poolConfig.host,
      database: poolConfig.database,
      user: poolConfig.user,
      port: poolConfig.port,
      ssl: poolConfig.ssl
    });
    client.release();
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    console.error('🔍 Attempted connection:', {
      host: poolConfig.host,
      database: poolConfig.database,
      user: poolConfig.user,
      port: poolConfig.port,
      ssl: poolConfig.ssl
    });
  }
})();

// Query helper with error handling
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Executed query', { duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Database query error:', { text, error: error.message });
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get a client from the pool for manual transaction management
export const getClient = async () => {
  return await pool.connect();
};

// Health check query
export const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
export const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Database pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
    throw error;
  }
};

export default pool;
// // src/config/database.js
// import pg from 'pg';
// const { Pool } = pg;

// console.log('🔍 DATABASE CONFIG DEBUG:');
// console.log('DB_HOST:', process.env.DB_HOST);
// console.log('DB_PORT:', process.env.DB_PORT);
// console.log('DB_NAME:', process.env.DB_NAME);
// console.log('DB_USER:', process.env.DB_USER);
// console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : 'MISSING');
// console.log('DB_SSL:', process.env.DB_SSL);

// const pool = new Pool({
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT) || 5432,
//   database: process.env.DB_NAME || 'vottery',
//   user: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || 'password',
//   ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // 🔥 ADD SSL SUPPORT
//   max: parseInt(process.env.DB_POOL_MAX) || 20,
//   idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
//   connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
// });
// console.log('🔧 ACTUAL POOL CONFIG:', {
//   host: poolConfig.host,
//   port: poolConfig.port,
//   database: poolConfig.database,
//   user: poolConfig.user,
//   password: poolConfig.password ? '***' + poolConfig.password.slice(-4) : 'MISSING',
//   ssl: poolConfig.ssl
// });
// // Test database connection
// pool.on('connect', () => {
//   console.log('✅ Database connected successfully');
// });

// pool.on('error', (err) => {
//   console.error('❌ Unexpected database error:', err);
// });

// // Test connection on startup
// (async () => {
//   try {
//     const client = await pool.connect();
//     console.log('✅ Database connection test successful');
//     console.log('📊 Database info:', {
//       host: process.env.DB_HOST,
//       database: process.env.DB_NAME,
//       user: process.env.DB_USER,
//       port: process.env.DB_PORT,
//       ssl: process.env.DB_SSL === 'true'
//     });
//     client.release();
//   } catch (err) {
//     console.error('❌ Database connection test failed:', err.message);
//     console.error('🔍 Attempted connection:', {
//       host: process.env.DB_HOST,
//       database: process.env.DB_NAME,
//       user: process.env.DB_USER,
//       port: process.env.DB_PORT,
//       ssl: process.env.DB_SSL
//     });
//   }
// })();

// // Query helper with error handling
// export const query = async (text, params) => {
//   const start = Date.now();
//   try {
//     const result = await pool.query(text, params);
//     const duration = Date.now() - start;
//     console.log('✅ Executed query', { duration: `${duration}ms`, rows: result.rowCount });
//     return result;
//   } catch (error) {
//     console.error('❌ Database query error:', { text, error: error.message });
//     throw error;
//   }
// };

// // Transaction helper
// export const transaction = async (callback) => {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const result = await callback(client);
//     await client.query('COMMIT');
//     return result;
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('❌ Transaction error:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// };

// // Get a client from the pool for manual transaction management
// export const getClient = async () => {
//   return await pool.connect();
// };

// // Health check query
// export const healthCheck = async () => {
//   try {
//     const result = await query('SELECT NOW() as current_time, version() as version');
//     return {
//       status: 'healthy',
//       timestamp: result.rows[0].current_time,
//       version: result.rows[0].version,
//       database: process.env.DB_NAME,
//       host: process.env.DB_HOST
//     };
//   } catch (error) {
//     return {
//       status: 'unhealthy',
//       error: error.message
//     };
//   }
// };

// // Graceful shutdown
// export const closePool = async () => {
//   try {
//     await pool.end();
//     console.log('✅ Database pool closed gracefully');
//   } catch (error) {
//     console.error('❌ Error closing database pool:', error);
//     throw error;
//   }
// };

// export default pool;
// // src/config/database.js
// import pg from 'pg';
// const { Pool } = pg;

// const pool = new Pool({
//   host: process.env.DB_HOST || 'localhost',
//   port: process.env.DB_PORT || 5432,
//   database: process.env.DB_NAME || 'vottery',
//   user: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || 'password',
//   max: parseInt(process.env.DB_POOL_MAX) || 20,
//   idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
//   connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
// });

// // Test database connection
// pool.on('connect', () => {
//   console.log('✅ Database connected successfully');
// });

// pool.on('error', (err) => {
//   console.error('❌ Unexpected database error:', err);
//   process.exit(-1);
// });

// // Query helper with error handling
// export const query = async (text, params) => {
//   const start = Date.now();
//   try {
//     const result = await pool.query(text, params);
//     const duration = Date.now() - start;
//     console.log('Executed query', { text, duration, rows: result.rowCount });
//     return result;
//   } catch (error) {
//     console.error('Database query error:', { text, error: error.message });
//     throw error;
//   }
// };

// // Transaction helper
// export const transaction = async (callback) => {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const result = await callback(client);
//     await client.query('COMMIT');
//     return result;
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Transaction error:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// };

// // Get a client from the pool for manual transaction management
// export const getClient = async () => {
//   return await pool.connect();
// };

// // Health check query
// export const healthCheck = async () => {
//   try {
//     const result = await query('SELECT NOW() as current_time, version() as version');
//     return {
//       status: 'healthy',
//       timestamp: result.rows[0].current_time,
//       version: result.rows[0].version
//     };
//   } catch (error) {
//     return {
//       status: 'unhealthy',
//       error: error.message
//     };
//   }
// };

// // Graceful shutdown
// export const closePool = async () => {
//   try {
//     await pool.end();
//     console.log('Database pool closed gracefully');
//   } catch (error) {
//     console.error('Error closing database pool:', error);
//     throw error;
//   }
// };

// export default pool;