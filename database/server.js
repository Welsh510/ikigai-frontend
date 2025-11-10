// Load environment variables FIRST - before any other imports
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import utility functions from correct path
const { getMalaysiaDateTime, getMalaysiaDateString } = require('./routes/utils/dateUtils');

console.log('Environment Variables Check:');
console.log('META_WHATSAPP_TOKEN:', process.env.META_WHATSAPP_TOKEN ? 'LOADED' : 'MISSING');
console.log('META_WHATSAPP_PHONE_ID:', process.env.META_WHATSAPP_PHONE_ID ? 'LOADED' : 'MISSING');
console.log('PORT:', process.env.PORT || 'Using default 5050');

// Database Configuration Debug
console.log('Database Configuration:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Import route modules with correct paths
const loginRoutes = require('./routes/login');
const changePasswordRoutes = require('./routes/changePassword');
const chatboxContentRoutes = require('./routes/chatboxContent');
const clientRoutes = require('./routes/clientContent');
const doctorRoutes = require('./routes/doctorContent');
const calendarContentRoutes = require('./routes/calendarContent');
const masterCharacterRoutes = require('./routes/masterCharacter');
const masterOpeningRoutes = require('./routes/masterOpening');
const sensitiveContentRoutes = require('./routes/sensitiveContent');
const additionalContentRoutes = require('./routes/additionalContent');
const specialReplyContentRoutes = require('./routes/specialReplyContent');
const followUpContentRoutes = require('./routes/followUpContent');
const scheduledMessagesRoutes = require('./routes/scheduledMessagesContent');
const userRoutes = require('./routes/user');

// Import database connection
const db = require('./config');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://reactjs-appointmentwhatsapp-production.up.railway.app'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request body keys:', Object.keys(req.body));
  }
  next();
});

// Serve React build files FIRST (before API routes)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  
  if (fs.existsSync(buildPath)) {
    console.log('Serving React build files from:', buildPath);
    app.use(express.static(buildPath));
  } else {
    console.log('React build directory not found, API-only mode');
  }
}

// Route modules (API endpoints)
app.use('/api/login', loginRoutes);
app.use('/api/changePassword', changePasswordRoutes);
app.use('/api/chatboxContent', chatboxContentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/calendarContent', calendarContentRoutes);
app.use('/api/masterCharacter', masterCharacterRoutes);
app.use('/api/masterOpening', masterOpeningRoutes);
app.use('/api/sensitiveContent', sensitiveContentRoutes);
app.use('/api/additionalContent', additionalContentRoutes);
app.use('/api/specialReply', specialReplyContentRoutes);
app.use('/api/followUp', followUpContentRoutes);
app.use('/api/scheduler', scheduledMessagesRoutes);
app.use('/api/users', userRoutes);

// Serve static files from public directories (adjust paths for database folder)
app.use('/media_opening', express.static(path.join(__dirname, '..', 'public', 'media_opening')));
app.use('/additional_content_files', express.static(path.join(__dirname, '..', 'public', 'additional_content_files')));

app.use('/send_media', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(path.join(__dirname, '..', 'public', 'send_media'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const malaysiaTime = getMalaysiaDateTime();
  res.json({
    status: 'OK',
    timestamp: malaysiaTime.toISOString(),
    malaysiaTime: getMalaysiaDateString(),
    timezone: 'Asia/Kuala_Lumpur (GMT+8)',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Environment variables check endpoint
app.get('/api/env-check', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    hasWhatsAppToken: !!process.env.META_WHATSAPP_TOKEN,
    hasPhoneId: !!process.env.META_WHATSAPP_PHONE_ID,
    port: process.env.PORT || 5050,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbUser: process.env.DB_USER,
    dbName: process.env.DB_NAME,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    tokenLength: process.env.META_WHATSAPP_TOKEN ? process.env.META_WHATSAPP_TOKEN.length : 0
  });
});

// Test database connection endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT 1 + 1 AS result');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      result: results[0].result,
      timestamp: getMalaysiaDateString(),
      timezone: 'Malaysia (GMT+8)'
    });
  } catch (err) {
    console.error('Database test failed:', err);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
      timestamp: getMalaysiaDateString()
    });
  }
});

// Test calendar API endpoints
app.get('/api/calendar-test', async (req, res) => {
  try {
    const [appointmentsTest] = await db.execute('SELECT COUNT(*) as count FROM appointments LIMIT 1');
    const [doctorsTest] = await db.execute('SELECT COUNT(*) as count FROM doctor LIMIT 1');
    const [clientsTest] = await db.execute('SELECT COUNT(*) as count FROM client LIMIT 1');
    
    res.json({
      success: true,
      message: 'Calendar system ready',
      tables: {
        appointments: appointmentsTest[0].count,
        doctors: doctorsTest[0].count,
        clients: clientsTest[0].count
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Calendar test failed:', err);
    res.status(500).json({
      success: false,
      message: 'Calendar system test failed',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle 404 for API routes BEFORE the catch-all React route
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// IMPORTANT: This catch-all handler must be AFTER all API routes
// Serve React App for all non-API routes (React Router handling)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  
  if (fs.existsSync(buildPath)) {
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } else {
    // Fallback if no build directory
    app.get('*', (req, res) => {
      res.json({
        message: 'WhatsApp Appointment System API',
        status: 'running',
        note: 'React build not found - API only mode',
        endpoints: {
          health: '/api/health',
          login: '/api/login',
          chatbox: '/api/chatboxContent',
          calendar: '/api/calendarContent',
          clients: '/api/clients',
          doctors: '/api/doctors'
        },
        timestamp: getMalaysiaDateString()
      });
    });
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.'
      });
    }
  }
  
  console.error('Unexpected error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 8080; // Changed to match nixpacks.toml
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`React App available at http://localhost:${PORT}/`);
  console.log(`API available at http://localhost:${PORT}/api/`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;