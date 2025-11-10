const mysql = require('mysql2/promise');

console.log('=== Database Configuration Debug ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET (length: ' + process.env.DB_PASSWORD.length + ')' : 'NOT SET');

// Create connection pool instead of single connection
let pool;

// Connection configuration
const poolConfig = {
  // Connection details
  host: process.env.DB_HOST || 'mysql.railway.internal',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'QRifbbDOalczEVXMzgGUVGmPILTvbFQw',
  database: process.env.DB_NAME || 'railway',
  
  // Pool configuration
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,    // Maximum number of connections in pool
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,   // Maximum time to get connection from pool
  timeout: parseInt(process.env.DB_TIMEOUT) || 60000,                  // Maximum time for query execution
  reconnect: true,                                                      // Automatically reconnect
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 300000,        // Close idle connections after 5 minutes
  maxIdle: parseInt(process.env.DB_MAX_IDLE) || 5,                     // Maximum idle connections
  
  // Additional stability settings
  charset: 'utf8mb4',
  timezone: '+08:00', // ADD THIS LINE - Malaysia timezone
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: false,
  
  // Handle disconnections
  handleDisconnects: true,
  
  // SSL settings (Railway often requires this)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Additional connection options for stability
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Retry configuration
  multipleStatements: false
};

// Try using DATABASE_URL first if available (Railway's preferred method)
if (process.env.DATABASE_URL) {
  console.log('Creating pool with DATABASE_URL...');
  try {
    // Parse DATABASE_URL and merge with pool config
    const url = new URL(process.env.DATABASE_URL);
    poolConfig.host = url.hostname;
    poolConfig.port = parseInt(url.port) || 3306;
    poolConfig.user = url.username;
    poolConfig.password = url.password;
    poolConfig.database = url.pathname.slice(1); // Remove leading slash
    
    // Handle SSL from URL params if present
    if (url.searchParams.get('ssl') === 'true' || url.searchParams.get('sslmode')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    
    pool = mysql.createPool(poolConfig);
    console.log('Pool created successfully with DATABASE_URL');
  } catch (error) {
    console.error('Failed to create pool with DATABASE_URL:', error.message);
    pool = null;
  }
}

// Fallback to individual environment variables
if (!pool) {
  console.log('Creating pool with individual environment variables...');
  console.log('Pool config:', {
    host: poolConfig.host,
    port: poolConfig.port,
    user: poolConfig.user,
    database: poolConfig.database,
    connectionLimit: poolConfig.connectionLimit,
    acquireTimeout: poolConfig.acquireTimeout,
    idleTimeout: poolConfig.idleTimeout,
    passwordSet: !!poolConfig.password,
    sslEnabled: !!poolConfig.ssl
  });
  
  pool = mysql.createPool(poolConfig);
  console.log('Pool created successfully with individual environment variables');
}

// Test the pool connection
async function testConnection() {
  try {
    console.log('Testing database pool connection...');
    const connection = await pool.getConnection();
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('=== Database Pool Connected Successfully ===');
    console.log('Connection ID:', connection.threadId);
    console.log('Test query result:', rows[0]);
    
    // Get pool stats
    const poolStats = getPoolStats();
    console.log('Pool statistics:', poolStats);
    
    // Release connection back to pool
    connection.release();
    
    return true;
  } catch (error) {
    console.error('=== Database Pool Connection Failed ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log specific error types
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - check if database is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied - check username/password');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found - check database host');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timeout - check network/firewall');
    } else if (error.code === 'ER_CON_COUNT_ERROR') {
      console.error('Too many connections - database connection limit reached');
    } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Connection lost - will be handled by pool reconnection');
    }
    
    return false;
  }
}

// Get pool statistics
function getPoolStats() {
  try {
    return {
      totalConnections: pool.pool._allConnections ? pool.pool._allConnections.length : 0,
      freeConnections: pool.pool._freeConnections ? pool.pool._freeConnections.length : 0,
      acquiringConnections: pool.pool._acquiringConnections ? pool.pool._acquiringConnections.length : 0,
      connectionLimit: poolConfig.connectionLimit
    };
  } catch (error) {
    return {
      error: 'Unable to get pool statistics',
      message: error.message
    };
  }
}

// Initialize connection test
testConnection().then(success => {
  if (success) {
    console.log('Initial database connection test passed');
  } else {
    console.error('Initial database connection test failed');
  }
});

// Periodic health check (every 30 seconds)
const healthCheckInterval = setInterval(async () => {
  try {
    const success = await testConnection();
    if (!success) {
      console.warn('Health check failed - pool may be experiencing issues');
    }
  } catch (error) {
    console.error('Health check error:', error.message);
  }
}, 30000);

// Handle pool events
pool.on('connection', (connection) => {
  console.log('New connection established as id ' + connection.threadId);
});

pool.on('acquire', (connection) => {
  console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('Connection %d released', connection.threadId);
});

pool.on('error', (err) => {
  console.error('=== Database Pool Error ===');
  console.error('Time:', new Date().toISOString());
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  console.error('Error fatal:', err.fatal);
  
  // Log pool statistics when error occurs
  console.error('Pool stats at error:', getPoolStats());
  
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection was closed. Pool will handle reconnection automatically...');
  } else if (err.code === 'ER_CON_COUNT_ERROR') {
    console.log('Database has too many connections. Pool will manage this...');
  } else if (err.code === 'ECONNREFUSED') {
    console.log('Database connection was refused. Pool will retry...');
  } else if (err.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT') {
    console.log('Cannot enqueue after quit. Pool may need restart...');
  } else if (err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
    console.log('Cannot enqueue after fatal error. Pool may need restart...');
  }
});

// Graceful shutdown function
async function gracefulShutdown() {
  console.log('Initiating graceful shutdown...');
  
  // Clear health check interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    console.log('Health check interval cleared');
  }
  
  // Close database pool
  try {
    await pool.end();
    console.log('Database pool closed successfully.');
  } catch (error) {
    console.error('Error closing database pool:', error.message);
  }
}

// Handle process termination signals
process.on('SIGINT', async () => {
  console.log('Received SIGINT signal');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal');
  await gracefulShutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await gracefulShutdown();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown();
  process.exit(1);
});

// Add helper methods to the pool
pool.getStats = getPoolStats;
pool.testConnection = testConnection;

// Export pool instead of single connection
module.exports = pool;