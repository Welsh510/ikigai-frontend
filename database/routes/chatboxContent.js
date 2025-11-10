const express = require('express');
const router = express.Router();
const pool = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const { getMalaysiaDateString } = require('./utils/dateUtils');

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'master';

// PRODUCTION LOGGING SYSTEM
const isDevelopment = process.env.NODE_ENV === 'development';
const isVerboseLogging = process.env.VERBOSE_LOGGING === 'true';

const logger = {
  // Always log errors
  error: (message, data = null) => {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data) : '');
  },
  
  // Always log warnings
  warn: (message, data = null) => {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : '');
  },
  
  // Only log info in development or verbose mode
  info: (message, data = null) => {
    if (isDevelopment || isVerboseLogging) {
      console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : '');
    }
  },
  
  // Only log debug in development with verbose mode
  debug: (message, data = null) => {
    if (isDevelopment && isVerboseLogging) {
      console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data) : '');
    }
  },
  
  // Production-safe logging for critical operations
  production: (message, data = null) => {
    console.log(`[PROD] ${message}`, data ? JSON.stringify(data) : '');
  }
};

// GitHub API helper functions
const uploadToGitHub = async (fileName, fileBuffer, mediaType) => {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('GitHub configuration missing. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables.');
  }

  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentDay = now.getDate().toString().padStart(2, '0');
  
  const filePath = `public/send_media/${mediaType}/${currentYear}/${currentMonth}/${currentDay}/${fileName}`;
  const content = fileBuffer.toString('base64');
  
  logger.info('Starting GitHub upload', {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    size: fileBuffer.length
  });

  try {
    // Check if file already exists
    let sha = null;
    try {
      const existingFile = await axios.get(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      sha = existingFile.data.sha;
      logger.debug('File exists, will update', { sha });
    } catch (error) {
      if (error.response?.status !== 404) {
        logger.warn('Error checking existing file', error.response?.data);
      }
    }

    // Upload/Update file to GitHub
    const uploadPayload = {
      message: `Upload media file: ${fileName} (${currentYear}/${currentMonth}/${currentDay})`,
      content: content,
      branch: GITHUB_BRANCH
    };

    if (sha) {
      uploadPayload.sha = sha;
    }

    const response = await axios.put(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      uploadPayload,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('GitHub upload successful', {
      path: response.data.content.path,
      size: response.data.content.size
    });

    return {
      success: true,
      path: filePath,
      relativePath: `${mediaType}/${currentYear}/${currentMonth}/${currentDay}/${fileName}`,
      sha: response.data.content.sha,
      downloadUrl: response.data.content.download_url,
      htmlUrl: response.data.content.html_url,
      dateInfo: { year: currentYear, month: currentMonth, day: currentDay }
    };

  } catch (error) {
    logger.error('GitHub upload failed', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    if (error.response?.status === 401) {
      throw new Error('GitHub authentication failed. Check your GITHUB_TOKEN.');
    } else if (error.response?.status === 404) {
      throw new Error('GitHub repository not found. Check GITHUB_OWNER and GITHUB_REPO.');
    } else if (error.response?.status === 422) {
      throw new Error('GitHub API validation error. Check file path and content.');
    }

    throw new Error(`GitHub upload failed: ${error.message}`);
  }
};

// Utility function to detect and format Malaysian phone numbers
function detectAndFormatMalaysianPhone(phoneNumber) {
  if (!phoneNumber) return null;
  
  let digits = phoneNumber.replace(/[^\d]/g, '');
  
  if (digits.startsWith('60') && digits.length >= 11 && digits.length <= 13) {
    return digits;
  }
  
  if (digits.startsWith('01') && digits.length >= 10 && digits.length <= 11) {
    return '6' + digits;
  }
  
  if (digits.startsWith('1') && digits.length >= 9 && digits.length <= 10) {
    return '60' + digits;
  }
  
  const malaysianPrefixes = ['2', '3', '4', '5', '6', '7', '8', '9'];
  if (digits.length >= 8 && digits.length <= 9 && malaysianPrefixes.includes(digits[0])) {
    return '601' + digits;
  }
  
  if (digits.length >= 8 && digits.length <= 11 && !digits.startsWith('60')) {
    return '60' + digits;
  }
  
  return digits;
}

// Enhanced client lookup function
async function getClientInfo(phoneNumber, pool) {
  if (!phoneNumber || !pool) return null;
  
  try {
    let query = 'SELECT NAME, PHONENUMBER FROM client WHERE PHONENUMBER = ?';
    let [results] = await pool.execute(query, [phoneNumber]);
    
    if (results.length > 0) {
      return { name: results[0].NAME, phone: results[0].PHONENUMBER };
    }
    
    const normalizedPhone = detectAndFormatMalaysianPhone(phoneNumber);
    if (normalizedPhone !== phoneNumber) {
      [results] = await pool.execute(query, [normalizedPhone]);
      if (results.length > 0) {
        return { name: results[0].NAME, phone: results[0].PHONENUMBER };
      }
    }
    
    if (phoneNumber.startsWith('60')) {
      const withoutCountryCode = phoneNumber.substring(2);
      [results] = await pool.execute(query, [withoutCountryCode]);
      if (results.length > 0) {
        return { name: results[0].NAME, phone: results[0].PHONENUMBER };
      }
      
      const withZeroPrefix = '0' + withoutCountryCode;
      [results] = await pool.execute(query, [withZeroPrefix]);
      if (results.length > 0) {
        return { name: results[0].NAME, phone: results[0].PHONENUMBER };
      }
    }
    
    if (!phoneNumber.startsWith('60')) {
      const withCountryCode = '60' + phoneNumber.replace(/^0/, '');
      [results] = await pool.execute(query, [withCountryCode]);
      if (results.length > 0) {
        return { name: results[0].NAME, phone: results[0].PHONENUMBER };
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error looking up client info', { error: error.message });
    return null;
  }
}

// Directory structure setup
const ensureDirectoryStructure = () => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const publicDir = path.join(projectRoot, 'public');
    const sendMediaDir = path.join(publicDir, 'send_media');
    
    const baseDirs = [
      publicDir,
      sendMediaDir,
      path.join(sendMediaDir, 'image'),
      path.join(sendMediaDir, 'video'),
      path.join(sendMediaDir, 'document'),
      path.join(sendMediaDir, 'audio') // ADDED
    ];
    
    baseDirs.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          logger.info('Created directory', { dir });
        }
      } catch (dirError) {
        logger.error('Failed to create directory', { dir, error: dirError.message });
      }
    });
    
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentDay = now.getDate().toString().padStart(2, '0');
    
    const mediaTypes = ['image', 'video', 'document', 'audio']; // ADDED audio
    
    mediaTypes.forEach(mediaType => {
      const datePath = path.join(sendMediaDir, mediaType, currentYear, currentMonth, currentDay);
      try {
        if (!fs.existsSync(datePath)) {
          fs.mkdirSync(datePath, { recursive: true });
          logger.debug('Created date-based directory', { datePath });
        }
      } catch (dateError) {
        logger.error('Failed to create date-based directory', { datePath, error: dateError.message });
      }
    });
    
  } catch (error) {
    logger.error('Error in ensureDirectoryStructure', { error: error.message });
  }
};

// Call this when the module loads
ensureDirectoryStructure();

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    logger.debug('FileFilter - File details', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    const allAllowedTypes = [
      // Image types
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Video types
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
      // Audio types - FIXED: Include all WhatsApp-supported audio formats
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/aac', 'audio/m4a', 
      'audio/mp4', 'audio/amr', 'audio/webm',
      // Document types
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (allAllowedTypes.includes(file.mimetype)) {
      logger.debug('File type allowed', { mimetype: file.mimetype });
      cb(null, true);
    } else {
      logger.warn('File type not allowed', { mimetype: file.mimetype });
      cb(new Error(`Invalid file type: ${file.mimetype}. Please upload a valid file.`));
    }
  }
});

const validateMediaTypeMatch = (mediaType, mimeType) => {
  const typeMapping = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'],
    // FIXED: Include all WhatsApp-supported audio formats
    audio: [
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/aac', 
      'audio/m4a', 'audio/mp4', 'audio/amr', 'audio/webm'
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  };
  
  return typeMapping[mediaType] && typeMapping[mediaType].includes(mimeType);
};

async function checkCustomerServiceWindow(phoneNumber, pool) {
  try {
    // Check when the user last sent a message (not admin/assistant)
    const query = `
      SELECT MAX(timestamp) as last_user_message
      FROM chat_messages 
      WHERE phone_number = ? AND role = 'user'
    `;
    
    const [result] = await pool.execute(query, [phoneNumber]);
    
    if (!result || !result[0] || !result[0].last_user_message) {
      return {
        hasWindow: false,
        reason: 'User has never sent a message',
        lastUserMessage: null,
        hoursSinceLastMessage: null
      };
    }
    
    const lastUserMessage = new Date(result[0].last_user_message);
    const now = new Date();
    const hoursSinceLastMessage = (now - lastUserMessage) / (1000 * 60 * 60);
    
    return {
      hasWindow: hoursSinceLastMessage < 24,
      reason: hoursSinceLastMessage < 24 ? 'Within 24-hour window' : 'Outside 24-hour window',
      lastUserMessage: lastUserMessage,
      hoursSinceLastMessage: hoursSinceLastMessage.toFixed(2)
    };
    
  } catch (error) {
    logger.error('Error checking customer service window', { error: error.message });
    return {
      hasWindow: false,
      reason: 'Error checking window',
      error: error.message
    };
  }
}

async function uploadMediaToWhatsAppFromBuffer(fileBuffer, fileName, mimeType) {
  const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
  const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
  const META_WHATSAPP_PHONE_ID = process.env.META_WHATSAPP_PHONE_ID;
  
  logger.info('WhatsApp upload from buffer started', {
    hasToken: !!META_WHATSAPP_TOKEN,
    phoneId: META_WHATSAPP_PHONE_ID,
    fileName: fileName,
    mimeType: mimeType,
    bufferSize: fileBuffer.length
  });
  
  if (!META_WHATSAPP_TOKEN) {
    throw new Error('WhatsApp token not configured');
  }
  
  if (!META_WHATSAPP_PHONE_ID) {
    throw new Error('WhatsApp Phone ID not configured');
  }
  
  const UPLOAD_URL = `https://graph.facebook.com/${META_API_VERSION}/${META_WHATSAPP_PHONE_ID}/media`;
  
  try {
    // Check file size limits with specific audio limits
    const maxSizes = {
      'image/jpeg': 5 * 1024 * 1024,
      'image/png': 5 * 1024 * 1024,
      'image/gif': 5 * 1024 * 1024,
      'image/webp': 5 * 1024 * 1024,
      'video/mp4': 16 * 1024 * 1024,
      'video/3gpp': 16 * 1024 * 1024,
      // Audio size limits - WhatsApp allows up to 16MB for audio
      'audio/mpeg': 16 * 1024 * 1024,
      'audio/mp3': 16 * 1024 * 1024,
      'audio/aac': 16 * 1024 * 1024,
      'audio/ogg': 16 * 1024 * 1024,
      'audio/m4a': 16 * 1024 * 1024,
      'audio/mp4': 16 * 1024 * 1024,
      'audio/amr': 16 * 1024 * 1024,
      'audio/webm': 16 * 1024 * 1024,
      // Documents
      'application/pdf': 100 * 1024 * 1024,
      'application/msword': 100 * 1024 * 1024,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 100 * 1024 * 1024
    };
    
    const maxSize = maxSizes[mimeType] || 100 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File too large for WhatsApp. Size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB, Max: ${(maxSize / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    // Special handling for audio files
    const isAudioFile = mimeType.startsWith('audio/');
    const isVoiceMessage = fileName.includes('voice_') || fileName.includes('recording_');
    
    if (isAudioFile) {
      logger.info('Processing audio file for WhatsApp', {
        originalMimeType: mimeType,
        fileSize: fileBuffer.length,
        fileName: fileName,
        isVoiceMessage: isVoiceMessage,
        bufferFirstBytes: Array.from(fileBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      
      // Special logging for voice messages
      if (isVoiceMessage) {
        logger.production('VOICE MESSAGE UPLOAD DEBUG', {
          step: 'PROCESSING_VOICE_FILE',
          originalMimeType: mimeType,
          fileName: fileName,
          fileSize: fileBuffer.length,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const FormData = require('form-data');
    const form = new FormData();
    
    // COMPREHENSIVE MIME TYPE MAPPING FOR WHATSAPP API
    const whatsappMimeTypes = {
      // Images - WhatsApp supported formats
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
      
      // Videos - WhatsApp supported formats
      'video/mp4': 'video/mp4',
      'video/3gpp': 'video/3gpp',
      'video/avi': 'video/mp4',        // Convert AVI to MP4
      'video/mov': 'video/mp4',        // Convert MOV to MP4
      'video/wmv': 'video/mp4',        // Convert WMV to MP4
      'video/webm': 'video/mp4',       // Convert WebM to MP4
      
      // Audio - CRITICAL: Proper WhatsApp audio format mapping
      'audio/mpeg': 'audio/mpeg',
      'audio/mp3': 'audio/mpeg',
      
      // Voice messages - OGG with Opus codec is preferred for voice
      'audio/ogg': 'audio/ogg; codecs=opus',
      'audio/webm': 'audio/ogg; codecs=opus',  // Convert WebM to OGG for voice
      
      // Other audio formats
      'audio/aac': 'audio/aac',
      'audio/m4a': 'audio/aac',        // M4A uses AAC codec
      'audio/mp4': 'audio/aac',        // MP4 audio uses AAC codec
      'audio/amr': 'audio/amr',        // AMR is supported by WhatsApp
      
      // Documents - WhatsApp supported formats
      'application/pdf': 'application/pdf',
      'application/msword': 'application/vnd.ms-word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.ms-word.document.12',
      'text/plain': 'text/plain',
      'application/vnd.ms-excel': 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.ms-excel.sheet.12',
      'application/vnd.ms-powerpoint': 'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.ms-powerpoint.presentation.12'
    };
    
    // Get the appropriate WhatsApp MIME type
    let whatsappMimeType = whatsappMimeTypes[mimeType] || mimeType;
    
    // Special handling for voice messages - force OGG format
    if (isVoiceMessage && isAudioFile) {
      whatsappMimeType = 'audio/ogg; codecs=opus';
      logger.info('Voice message detected - forcing OGG/Opus format', {
        originalMimeType: mimeType,
        whatsappMimeType: whatsappMimeType
      });
    }
    
    logger.info('MIME type mapping for WhatsApp', {
      original: mimeType,
      whatsapp: whatsappMimeType,
      isAudio: isAudioFile,
      isVoiceMessage: isVoiceMessage,
      fileName: fileName
    });
    
    // Prepare form data for WhatsApp API
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: whatsappMimeType
    });
    form.append('type', whatsappMimeType);
    form.append('messaging_product', 'whatsapp');
    
    logger.info('Uploading to WhatsApp with details', {
      url: UPLOAD_URL,
      mimeType: whatsappMimeType,
      fileName: fileName,
      fileSize: fileBuffer.length,
      isAudio: isAudioFile,
      isVoiceMessage: isVoiceMessage
    });
    
    // Special debug logging for voice messages before upload
    if (isVoiceMessage) {
      logger.production('VOICE MESSAGE UPLOAD DEBUG', {
        step: 'SENDING_TO_WHATSAPP_API',
        whatsappMimeType: whatsappMimeType,
        fileName: fileName,
        fileSize: fileBuffer.length,
        uploadUrl: UPLOAD_URL,
        timestamp: new Date().toISOString()
      });
    }
    
    const response = await axios.post(UPLOAD_URL, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    logger.info('WhatsApp media upload response', {
      status: response.status,
      statusText: response.statusText,
      hasId: !!response.data?.id,
      responseData: response.data,
      isAudio: isAudioFile,
      isVoiceMessage: isVoiceMessage
    });
    
    // Special success logging for voice messages
    if (isVoiceMessage && response.data && response.data.id) {
      logger.production('VOICE MESSAGE UPLOAD DEBUG', {
        step: 'WHATSAPP_UPLOAD_SUCCESS',
        mediaId: response.data.id,
        whatsappMimeType: whatsappMimeType,
        fileName: fileName,
        timestamp: new Date().toISOString()
      });
    }
    
    if (response.data && response.data.id) {
      logger.production('Media uploaded successfully', { 
        mediaId: response.data.id,
        mediaType: mimeType,
        whatsappMimeType: whatsappMimeType,
        isVoiceMessage: isVoiceMessage,
        fileName: fileName
      });
      return response.data.id;
    } else {
      logger.error('Unexpected WhatsApp upload response format', {
        status: response.status,
        data: response.data,
        isAudio: isAudioFile,
        isVoiceMessage: isVoiceMessage
      });
      throw new Error('No media ID returned from WhatsApp API - check response format');
    }
    
  } catch (error) {
    logger.error('WhatsApp upload error details', {
      errorType: error.constructor.name,
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      requestConfig: {
        url: UPLOAD_URL,
        mimeType: mimeType,
        fileName: fileName,
        isAudio: mimeType.startsWith('audio/'),
        isVoiceMessage: fileName.includes('voice_') || fileName.includes('recording_')
      }
    });
    
    // Special error logging for voice messages
    if ((fileName.includes('voice_') || fileName.includes('recording_')) && mimeType.startsWith('audio/')) {
      logger.production('VOICE MESSAGE UPLOAD DEBUG', {
        step: 'WHATSAPP_UPLOAD_FAILED',
        errorMessage: error.message,
        errorStatus: error.response?.status,
        errorData: error.response?.data,
        originalMimeType: mimeType,
        fileName: fileName,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      logger.error('WhatsApp API Error Details', {
        code: apiError.code,
        message: apiError.message,
        type: apiError.type,
        errorSubcode: apiError.error_subcode,
        fbtrace_id: apiError.fbtrace_id,
        isAudio: mimeType.startsWith('audio/'),
        isVoiceMessage: fileName.includes('voice_') || fileName.includes('recording_')
      });
      
      // Enhanced error handling for audio files
      if (apiError.code === 100) {
        if (apiError.message.includes('Invalid parameter')) {
          if (mimeType.startsWith('audio/')) {
            throw new Error(`Invalid audio format for WhatsApp: ${mimeType}. Voice messages require OGG/Opus format. Regular audio supports MP3, AAC, OGG. Error: ${apiError.message}`);
          } else {
            throw new Error(`Invalid file format for WhatsApp: ${mimeType}. Error: ${apiError.message}`);
          }
        } else if (apiError.message.includes('Media upload failed')) {
          throw new Error(`WhatsApp media upload failed - check file format and size. Original: ${mimeType}, File: ${fileName}. Error: ${apiError.message}`);
        }
      } else if (apiError.code === 190) {
        throw new Error('Invalid WhatsApp access token. Please check your META_WHATSAPP_TOKEN');
      } else if (apiError.code === 200) {
        throw new Error('WhatsApp permission error. Check if your account has media upload permissions');
      } else if (apiError.code === 131009) {
        throw new Error('WhatsApp API rate limit exceeded. Please try again later');
      }
      
      throw new Error(`WhatsApp API Error: ${apiError.message} (Code: ${apiError.code}, Type: ${apiError.type})`);
    }
    
    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('WhatsApp upload timeout - file may be too large or network issues');
    }
    
    if (error.code === 'ENOTFOUND') {
      throw new Error('Cannot connect to WhatsApp API - check internet connection');
    }
    
    throw error;
  }
}

// ===== ROUTES =====

// GET /api/chatboxContent/chat-sessions - ENHANCED with new_message_count
router.get('/chat-sessions', async (req, res) => {
  logger.debug('GET /chat-sessions endpoint hit');
  
  try {
    if (!pool) {
      logger.error('Database pool is null or undefined');
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const query = `
	  SELECT 
		cs.session_id,
		cs.phone_number,
		cs.session_start,
		cs.session_end,
		cs.message_count,
		cs.last_activity,
		cs.opening_sequence_completed,
		cs.current_opening_step,
		cs.manual_reply,
		cs.appointment_section,
		cs.human_section,
		cs.human_reply,
		cs.new_message_count,
		c.NAME as client_name,
		cm.latest_message_timestamp
	  FROM chat_sessions cs
	  LEFT JOIN client c ON (
		cs.phone_number = c.PHONENUMBER OR
		cs.phone_number = CONCAT('60', c.PHONENUMBER) OR
		cs.phone_number = CONCAT('60', SUBSTRING(c.PHONENUMBER, 2)) OR
		CONCAT('60', SUBSTRING(cs.phone_number, 2)) = c.PHONENUMBER OR
		SUBSTRING(cs.phone_number, 3) = c.PHONENUMBER OR
		SUBSTRING(cs.phone_number, 3) = SUBSTRING(c.PHONENUMBER, 2)
	  )
	  LEFT JOIN (
		SELECT 
		  session_id,
		  MAX(timestamp) as latest_message_timestamp
		FROM chat_messages 
		GROUP BY session_id
	  ) cm ON cs.session_id = cm.session_id
	  ORDER BY 
		CASE WHEN cs.new_message_count > 0 THEN 0 ELSE 1 END,
		COALESCE(cm.latest_message_timestamp, cs.last_activity) DESC,
		cs.last_activity DESC
	`;
    
    const [sessions] = await pool.execute(query);
    
    const enhancedSessions = await Promise.all(sessions.map(async (session) => {
      if (!session.client_name) {
        const clientInfo = await getClientInfo(session.phone_number, pool);
        if (clientInfo) {
          session.client_name = clientInfo.name;
        }
      }
      return session;
    }));
    
    logger.info('Enhanced sessions fetched', { count: enhancedSessions.length });
    
    res.json(enhancedSessions || []);
  } catch (error) {
    logger.error('Error in /chat-sessions', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch chat sessions',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// NEW: PUT /api/chatboxContent/reset-new-message-count/:sessionId
router.put('/reset-new-message-count/:sessionId', async (req, res) => {
  logger.debug('PUT /reset-new-message-count/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const resetQuery = `
      UPDATE chat_sessions 
      SET new_message_count = 0 
      WHERE session_id = ?
    `;
    
    const [result] = await pool.execute(resetQuery, [sessionId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Session not found',
        details: `No session found with ID: ${sessionId}`
      });
    }
    
    logger.production('New message count reset successfully', {
      sessionId,
      affectedRows: result.affectedRows
    });
    
    res.json({ 
      success: true,
      message: 'New message count reset successfully',
      session_id: sessionId,
      affected_rows: result.affectedRows
    });
  } catch (error) {
    logger.error('Error in PUT /reset-new-message-count', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to reset new message count',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// GET /api/chatboxContent/chat-messages/:sessionId
router.get('/chat-messages/:sessionId', async (req, res) => {
  logger.debug('GET /chat-messages/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const query = `
      SELECT 
        message_id,
        session_id,
        phone_number,
        message,
        role,
        timestamp,
        message_type,
        audio_file_path,
        audio_file_name,
        audio_mime_type,
        audio_duration,
        audio_file_size,
        audio_hash,
        transcribed_text,
        opening_message_id,
        image_file_path,
        image_file_name,
        image_mime_type,
        image_file_size,
        image_hash,
        video_file_path,
        video_file_name,
        video_mime_type,
        video_file_size,
        video_hash,
        document_file_path,
        document_file_name,
        document_mime_type,
        document_file_size,
        document_hash,
        document_extracted_text,
        media_caption,
        processed
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;
    
    const [messages] = await pool.execute(query, [sessionId]);
    
    logger.debug('Messages fetched', { sessionId, count: messages?.length || 0 });
    
    res.json(messages || []);
  } catch (error) {
    logger.error('Error in /chat-messages', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch chat messages',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// POST /api/chatboxContent/send-reply - ENHANCED
router.post('/send-reply', async (req, res) => {
  logger.debug('POST /send-reply endpoint hit');
  
  try {
    const { phoneNumber, message, sessionId, adminUser } = req.body;
    
    logger.info('Send reply request', { 
      phoneNumber, 
      messageLength: message?.length,
      sessionId, 
      adminUser 
    });
    
    if (!phoneNumber || !message || !sessionId) {
      return res.status(400).json({ 
        error: 'Phone number, message, and session ID are required',
        missing: {
          phoneNumber: !phoneNumber,
          message: !message,
          sessionId: !sessionId
        }
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({ 
        error: 'Message is too long. Maximum 1000 characters allowed.',
        currentLength: message.length
      });
    }

    const cleanPhoneNumber = detectAndFormatMalaysianPhone(phoneNumber);
    
    logger.debug('Phone number cleaned', {
      original: phoneNumber,
      cleaned: cleanPhoneNumber
    });

    const META_WHATSAPP_PHONE_ID = process.env.META_WHATSAPP_PHONE_ID;
    const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
    const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
    
    if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
      logger.error('WhatsApp configuration missing');
      return res.status(500).json({ 
        error: 'WhatsApp API not configured properly',
        details: 'Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID environment variables'
      });
    }

    const WHATSAPP_API_URL = `https://graph.facebook.com/${META_API_VERSION}/${META_WHATSAPP_PHONE_ID}/messages`;
    
    const whatsappPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhoneNumber,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    };

    logger.debug('WhatsApp payload prepared', { to: cleanPhoneNumber });

    let updateSessionQuery;
    let updateParams;

    try {
      const sessionCheckQuery = `
        SELECT session_id, phone_number, appointment_section, human_section, human_reply
        FROM chat_sessions 
        WHERE session_id = ?
      `;
      
      const [sessionCheck] = await pool.execute(sessionCheckQuery, [sessionId]);
      
      if (!sessionCheck || sessionCheck.length === 0) {
        logger.error('Session not found', { sessionId });
        return res.status(400).json({
          error: 'Session not found',
          details: `No session found with ID: ${sessionId}`
        });
      }

      const currentSession = sessionCheck[0];
      
      const insertMessageQuery = `
        INSERT INTO chat_messages (
          session_id, 
          phone_number, 
          message, 
          role, 
          message_type,
          timestamp,
          processed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const malaysiaTime = getMalaysiaDateString();

      const [messageResult] = await pool.execute(insertMessageQuery, [
        sessionId, 
        cleanPhoneNumber,
        message, 
        'admin',
        'text',
        malaysiaTime, // Use Malaysia time instead of NOW()
        1
      ]);
      
      logger.debug('Message inserted', { messageId: messageResult.insertId });
      
      const appointmentSection = currentSession.appointment_section || 0;
      const humanSection = currentSession.human_section || 0;
      
      if (appointmentSection === 0 && humanSection === 0) {
        updateSessionQuery = `
          UPDATE chat_sessions 
          SET message_count = message_count + 1, 
              last_activity = CURRENT_TIMESTAMP,
              human_reply = 1,
              human_section = 1
          WHERE session_id = ?
        `;
        updateParams = [sessionId];
      } else {
        updateSessionQuery = `
          UPDATE chat_sessions 
          SET message_count = message_count + 1, 
              last_activity = CURRENT_TIMESTAMP,
              human_reply = 1
          WHERE session_id = ?
        `;
        updateParams = [sessionId];
      }
      
    } catch (dbError) {
      logger.error('Database error when saving admin reply', { error: dbError.message });
      return res.status(500).json({
        error: 'Failed to save message to database',
        details: dbError.message
      });
    }

    try {
      const whatsappResponse = await axios.post(WHATSAPP_API_URL, whatsappPayload, {
        headers: {
          'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      logger.info('WhatsApp API response', {
        status: whatsappResponse.status,
        hasData: !!whatsappResponse.data
      });

      if (whatsappResponse.status !== 200) {
        throw new Error(`WhatsApp API returned status ${whatsappResponse.status}`);
      }

      if (updateSessionQuery && updateParams) {
        await pool.execute(updateSessionQuery, updateParams);
        logger.debug('Session updated successfully');
      }

      logger.production('Reply sent successfully', {
        phoneNumber: cleanPhoneNumber,
        sessionId,
        adminUser: adminUser || 'Unknown'
      });

      return res.json({
        success: true,
        message: 'Reply sent successfully',
        whatsapp_message_id: whatsappResponse.data?.messages?.[0]?.id,
        whatsapp_status: whatsappResponse.data?.messages?.[0]?.message_status,
        sent_at: new Date().toISOString(),
        admin_user: adminUser || 'Unknown',
        phone_number: cleanPhoneNumber,
        original_phone: phoneNumber
      });

    } catch (whatsappError) {
      logger.error('WhatsApp API error', {
        message: whatsappError.message,
        status: whatsappError.response?.status,
        responseData: whatsappError.response?.data
      });
      
      if (whatsappError.response) {
        return res.status(500).json({
          error: 'WhatsApp API error',
          details: whatsappError.response.data?.error?.message || 'Unknown WhatsApp API error',
          whatsapp_error: whatsappError.response.data,
          status: whatsappError.response.status,
          phone_number: cleanPhoneNumber,
          message_saved: true
        });
      }
      
      throw whatsappError;
    }

  } catch (error) {
    logger.error('Error in /send-reply', { message: error.message });
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'WhatsApp API request timed out. Please try again.',
        code: 'TIMEOUT'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send reply',
      details: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// POST /api/chatboxContent/send-media - ENHANCED
router.post('/send-media', upload.single('media'), async (req, res) => {
  logger.debug('POST /send-media endpoint hit');
  
  try {
    logger.debug('Request details', {
      hasBody: !!req.body,
      hasFile: !!req.file,
      fileDetails: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });
    
    const { phoneNumber, sessionId, mediaType, adminUser, caption } = req.body;
    const file = req.file;
    
    if (!phoneNumber || !sessionId || !mediaType || !file) {
      return res.status(400).json({ 
        error: 'Phone number, session ID, media type, and file are required',
        missing: {
          phoneNumber: !phoneNumber,
          sessionId: !sessionId,
          mediaType: !mediaType,
          file: !file
        }
      });
    }

    if (!file.buffer) {
      return res.status(400).json({ 
        error: 'File buffer not available',
        details: 'File was not properly uploaded to memory'
      });
    }

    if (!validateMediaTypeMatch(mediaType, file.mimetype)) {
      return res.status(400).json({
        error: `File type mismatch`,
        details: `Selected media type "${mediaType}" does not match the uploaded file type "${file.mimetype}"`
      });
    }

    logger.info('Media type validation passed', {
      mediaType: mediaType,
      mimeType: file.mimetype
    });

    const cleanPhoneNumber = detectAndFormatMalaysianPhone(phoneNumber);
    
    logger.debug('Phone number cleaned for media', {
      original: phoneNumber,
      cleaned: cleanPhoneNumber
    });

    const META_WHATSAPP_PHONE_ID = process.env.META_WHATSAPP_PHONE_ID;
    const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
    const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
    
    if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
      logger.error('WhatsApp configuration missing for media upload');
      return res.status(500).json({ 
        error: 'WhatsApp API not configured properly',
        details: 'Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID environment variables'
      });
    }

    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const extension = file.originalname.split('.').pop();
    const uniqueFileName = `${timestamp}_${randomString}.${extension}`;
    
    logger.debug('Generated unique filename', { uniqueFileName });

    // Step 1: Upload to GitHub
    logger.info('Starting GitHub upload');
    let githubResult;
    try {
      githubResult = await uploadToGitHub(uniqueFileName, file.buffer, mediaType);
      logger.info('GitHub upload successful', { path: githubResult.path });
    } catch (githubError) {
      logger.error('Failed to upload to GitHub', { error: githubError.message });
      return res.status(500).json({
        error: 'Failed to upload media to GitHub',
        details: githubError.message
      });
    }

    // Step 2: Upload media to WhatsApp
    let mediaId;
    try {
      logger.info('Starting WhatsApp media upload', {
        mediaType,
        originalMimeType: file.mimetype,
        fileName: uniqueFileName,
        fileSize: file.size,
        fileDuration: file.duration || 'unknown'
      });
      
      mediaId = await uploadMediaToWhatsAppFromBuffer(file.buffer, uniqueFileName, file.mimetype);
      logger.info('Media uploaded to WhatsApp successfully', { 
        mediaId,
        mediaType,
        fileName: uniqueFileName
      });
    } catch (uploadError) {
      logger.error('Failed to upload media to WhatsApp', { 
        error: uploadError.message,
        mediaType,
        originalMimeType: file.mimetype,
        fileName: uniqueFileName,
        fileSize: file.size
      });
      
      return res.status(500).json({
        error: 'Failed to upload media to WhatsApp',
        details: uploadError.message,
        mediaType,
        originalMimeType: file.mimetype,
        fileName: uniqueFileName,
        github_uploaded: true,
        github_path: githubResult.path
      });
    }

    const WHATSAPP_API_URL = `https://graph.facebook.com/${META_API_VERSION}/${META_WHATSAPP_PHONE_ID}/messages`;
    
    let whatsappPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhoneNumber,
      type: mediaType
    };

    // UPDATED SWITCH STATEMENT WITH BETTER AUDIO HANDLING
    switch (mediaType) {
      case 'image':
        whatsappPayload.image = { id: mediaId };
        if (caption) whatsappPayload.image.caption = caption;
        break;
      case 'video':
        whatsappPayload.video = { id: mediaId };
        if (caption) whatsappPayload.video.caption = caption;
        break;
      case 'audio': {
        // Do not hard-block outside 24h window; just log it and proceed
        try {
          const windowCheck = await checkCustomerServiceWindow(cleanPhoneNumber, pool);
          logger && logger.production && logger.production('VOICE MESSAGE WINDOW CHECK', windowCheck);
        } catch (e) {
          logger && logger.warn && logger.warn('Window check failed for audio', { error: e.message });
        }
        // Send as WhatsApp voice note (PTT)
        whatsappPayload.audio = { id: mediaId, voice: true };
        break;
      }
      
      case 'document':
        whatsappPayload.document = {
          id: mediaId,
          filename: file.originalname
        };
        if (caption) whatsappPayload.document.caption = caption;
        break;
      default:
        return res.status(400).json({
          error: 'Unsupported media type',
          details: `Media type ${mediaType} is not supported`
        });
    }

    logger.info('WhatsApp message payload prepared', { 
      mediaType, 
      hasCaption: !!caption,
      payload: JSON.stringify(whatsappPayload, null, 2)
    });

    // Step 3: Database operations with better error handling
    try {
      const sessionCheckQuery = `
        SELECT session_id, phone_number, appointment_section, human_section, human_reply
        FROM chat_sessions 
        WHERE session_id = ?
      `;
      
      const [sessionCheck] = await pool.execute(sessionCheckQuery, [sessionId]);
      
      if (!sessionCheck || sessionCheck.length === 0) {
        logger.error('Session not found for media upload', { sessionId });
        return res.status(400).json({
          error: 'Session not found',
          details: `No session found with ID: ${sessionId}`
        });
      }

      const currentSession = sessionCheck[0];
      
      // IMPROVED DATABASE INSERT WITH PROPER COLUMN MAPPING
      let insertMessageQuery;
      let insertParams;
      
      const malaysiaTime = getMalaysiaDateString();
      const githubPath = githubResult.relativePath;
      
      // Build the query based on media type
      if (mediaType === 'audio') {
        // Log the exact WhatsApp API call
        logger.production('VOICE MESSAGE SEND ATTEMPT', {
          phoneNumber: cleanPhoneNumber,
          mediaId: mediaId,
          whatsappPayload: JSON.stringify(whatsappPayload),
          timestamp: new Date().toISOString(),
          sessionInfo: {
            sessionId: sessionId,
            hasCustomerServiceWindow: 'UNKNOWN' // You'd need to track this
          }
        });
  
        insertMessageQuery = `
          INSERT INTO chat_messages (
            session_id, 
            phone_number, 
            message, 
            role, 
            message_type,
            audio_file_path,
            audio_file_name,
            audio_mime_type,
            audio_file_size,
            media_caption,
            timestamp,
            processed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        insertParams = [
          sessionId, 
          cleanPhoneNumber,
          uniqueFileName,
          'admin',
          mediaType,
          githubPath,
          file.originalname,
          file.mimetype,
          file.size,
          caption || null,
          malaysiaTime,
          1
        ];
      } else {
        // For other media types, use dynamic column names
        insertMessageQuery = `
          INSERT INTO chat_messages (
            session_id, 
            phone_number, 
            message, 
            role, 
            message_type,
            ${mediaType}_file_path,
            ${mediaType}_file_name,
            ${mediaType}_mime_type,
            ${mediaType}_file_size,
            media_caption,
            timestamp,
            processed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        insertParams = [
          sessionId, 
          cleanPhoneNumber,
          uniqueFileName,
          'admin',
          mediaType,
          githubPath,
          file.originalname,
          file.mimetype,
          file.size,
          caption || null,
          malaysiaTime,
          1
        ];
      }
      
      logger.debug('Database insert query', { 
        query: insertMessageQuery,
        paramsCount: insertParams.length 
      });
      
      const [messageResult] = await pool.execute(insertMessageQuery, insertParams);
      
      logger.debug('Media message inserted', { 
        messageId: messageResult.insertId,
        githubPath 
      });
      
      const appointmentSection = currentSession.appointment_section || 0;
      const humanSection = currentSession.human_section || 0;
      
      let updateSessionQuery;
      let updateParams;
      
      if (appointmentSection === 0 && humanSection === 0) {
        updateSessionQuery = `
          UPDATE chat_sessions 
          SET message_count = message_count + 1, 
              last_activity = CURRENT_TIMESTAMP,
              human_reply = 1,
              human_section = 1
          WHERE session_id = ?
        `;
        updateParams = [sessionId];
      } else {
        updateSessionQuery = `
          UPDATE chat_sessions 
          SET message_count = message_count + 1, 
              last_activity = CURRENT_TIMESTAMP,
              human_reply = 1
          WHERE session_id = ?
        `;
        updateParams = [sessionId];
      }
      
      await pool.execute(updateSessionQuery, updateParams);
      logger.debug('Session updated successfully for media');
      
    } catch (dbError) {
      logger.error('Database error when saving admin media message', { 
        error: dbError.message,
        code: dbError.code,
        sqlState: dbError.sqlState 
      });
      
      // Set a flag to include warning in response
      const databaseSaveFailed = true;
      logger.warn('Continuing with WhatsApp message send despite database error');
    }

    // Step 4: Send media message via WhatsApp
    try {
      logger.info('Sending media message via WhatsApp API', {
        url: WHATSAPP_API_URL,
        phoneNumber: cleanPhoneNumber,
        mediaType,
        mediaId,
        payloadSize: JSON.stringify(whatsappPayload).length
      });
      
      const whatsappResponse = await axios.post(WHATSAPP_API_URL, whatsappPayload, {
        headers: {
          'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      logger.info('WhatsApp media API response received', {
        status: whatsappResponse.status,
        statusText: whatsappResponse.statusText,
        hasData: !!whatsappResponse.data,
        responseData: whatsappResponse.data
      });

      if (whatsappResponse.status !== 200) {
        logger.error('WhatsApp API returned non-200 status', {
          status: whatsappResponse.status,
          statusText: whatsappResponse.statusText,
          data: whatsappResponse.data
        });
        throw new Error(`WhatsApp API returned status ${whatsappResponse.status}: ${whatsappResponse.statusText}`);
      }

      // Check if the response contains the expected message data
      if (!whatsappResponse.data.messages || !whatsappResponse.data.messages[0]) {
        logger.error('WhatsApp API response missing message data', {
          fullResponse: whatsappResponse.data
        });
        throw new Error('WhatsApp API response missing message data - message may not have been sent');
      }

      const messageData = whatsappResponse.data.messages[0];
      logger.production('Media message sent successfully via WhatsApp', {
        mediaType,
        phoneNumber: cleanPhoneNumber,
        sessionId,
        adminUser: adminUser || 'Unknown',
        fileSize: file.size,
        whatsappMessageId: messageData.id,
        messageStatus: messageData.message_status
      });

      return res.json({
        success: true,
        message: `${mediaType} message sent successfully`,
        media_type: mediaType,
        filename: file.originalname,
        unique_filename: uniqueFileName,
        file_size: file.size,
        github_path: githubResult.path,
        github_url: githubResult.downloadUrl,
        whatsapp_message_id: messageData.id,
        whatsapp_status: messageData.message_status,
        sent_at: new Date().toISOString(),
        admin_user: adminUser || 'Unknown',
        phone_number: cleanPhoneNumber,
        original_phone: phoneNumber,
        caption: caption || null,
        // Add debug info for audio messages
        debug_info: mediaType === 'audio' ? {
          original_mime_type: file.mimetype,
          recorded_format: file.type,
          whatsapp_media_id: mediaId
        } : undefined
      });

    } catch (whatsappError) {
      logger.error('WhatsApp media API error - detailed', {
        errorType: whatsappError.constructor.name,
        message: whatsappError.message,
        status: whatsappError.response?.status,
        statusText: whatsappError.response?.statusText,
        responseData: whatsappError.response?.data,
        requestPayload: whatsappPayload,
        mediaType,
        phoneNumber: cleanPhoneNumber,
        mediaId
      });
      
      if (whatsappError.response) {
        const errorData = whatsappError.response.data;
        let errorMessage = 'WhatsApp API error';
        
        if (errorData?.error) {
          errorMessage = `WhatsApp API Error: ${errorData.error.message} (Code: ${errorData.error.code})`;
          
          // Special handling for audio-related errors
          if (mediaType === 'audio' && errorData.error.code === 100) {
            errorMessage += `. Audio format issue: Original=${file.mimetype}, WhatsApp Media ID=${mediaId}`;
          }
        }
        
        return res.status(500).json({
          error: errorMessage,
          details: errorData?.error?.message || 'Unknown WhatsApp API error',
          whatsapp_error: errorData,
          status: whatsappError.response.status,
          phone_number: cleanPhoneNumber,
          message_saved: true,
          github_uploaded: true,
          github_path: githubResult.path,
          media_uploaded_to_whatsapp: !!mediaId,
          media_id: mediaId,
          debug_info: {
            media_type: mediaType,
            original_mime_type: file.mimetype,
            file_size: file.size,
            whatsapp_payload: whatsappPayload
          }
        });
      }
      
      throw whatsappError;
    }

  } catch (error) {
    logger.error('Error in /send-media', { 
      message: error.message,
      stack: error.stack,
      code: error.code 
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: 'File size exceeds 10MB limit',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'WhatsApp API request timed out. Please try again.',
        code: 'TIMEOUT'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send media message',
      details: error.message,
      code: error.code || 'UNKNOWN',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// RESET SESSION FLAGS - ENHANCED
router.put('/reset-session-flags/:sessionId', async (req, res) => {
  logger.debug('PUT /reset-session-flags/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const sessionCheckQuery = `
      SELECT session_id, phone_number 
      FROM chat_sessions 
      WHERE session_id = ?
    `;
    
    const [sessionCheck] = await pool.execute(sessionCheckQuery, [sessionId]);
    
    if (!sessionCheck || sessionCheck.length === 0) {
      logger.error('Session not found for reset', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        details: `No session found with ID: ${sessionId}`
      });
    }

    const resetQuery = `
      UPDATE chat_sessions 
      SET appointment_section = 0,
          human_section = 0,
          human_reply = 0,
          manual_reply = 0,
          last_activity = ?
      WHERE session_id = ?
    `;
    
    const malaysiaTime = getMalaysiaDateString();

    const [result] = await pool.execute(resetQuery, [malaysiaTime, sessionId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Session not found or no changes made',
        details: `No session found with ID: ${sessionId} or flags were already reset`
      });
    }
    
    logger.production('Session flags reset successfully', {
      sessionId,
      affectedRows: result.affectedRows
    });
    
    res.json({ 
      success: true,
      message: 'Session flags reset successfully',
      session_id: sessionId,
      affected_rows: result.affectedRows,
      reset_flags: {
        appointment_section: 0,
        human_section: 0,
        human_reply: 0,
        manual_reply: 0
      }
    });
  } catch (error) {
    logger.error('Error in PUT /reset-session-flags', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to reset session flags',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  logger.debug('Test endpoint hit');
  res.json({ 
    message: 'Chatbox routes are working!', 
    timestamp: new Date().toISOString(),
    malaysiaTime: getMalaysiaDateString(), // ADD this line
    timezone: 'Asia/Kuala_Lumpur (GMT+8)', // ADD this line
    environment: process.env.NODE_ENV || 'development',
    logging: {
      isDevelopment,
      isVerboseLogging
    }
  });
});

// ===== FACEBOOK ROUTES =====

// GET /api/chatboxContent/facebook/chat-sessions
router.get('/facebook/chat-sessions', async (req, res) => {
  logger.debug('GET /facebook/chat-sessions endpoint hit');
  
  try {
    if (!pool) {
      logger.error('Database pool is null or undefined');
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const query = `
      SELECT 
        fcs.session_id,
        fcs.page_id,
        fcs.user_id,
        fcs.session_start,
        fcs.session_end,
        fcs.message_count,
        fcs.last_activity,
        fcs.appointment_section,
        fcs.human_section,
        fcs.human_reply,
        fcs.new_message_count,
        fcm.latest_message_timestamp
      FROM facebook_chat_sessions fcs
      LEFT JOIN (
        SELECT 
          session_id,
          MAX(timestamp) as latest_message_timestamp
        FROM facebook_chat_messages 
        GROUP BY session_id
      ) fcm ON fcs.session_id = fcm.session_id
      ORDER BY 
        CASE WHEN fcs.new_message_count > 0 THEN 0 ELSE 1 END,
        COALESCE(fcm.latest_message_timestamp, fcs.last_activity) DESC,
        fcs.last_activity DESC
    `;
    
    const [sessions] = await pool.execute(query);
    
    logger.info('Facebook sessions fetched', { count: sessions.length });
    
    res.json(sessions || []);
  } catch (error) {
    logger.error('Error in /facebook/chat-sessions', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch Facebook chat sessions',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// GET /api/chatboxContent/facebook/chat-messages/:sessionId
router.get('/facebook/chat-messages/:sessionId', async (req, res) => {
  logger.debug('GET /facebook/chat-messages/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const query = `
      SELECT 
        message_id,
        session_id,
        page_id,
        user_id,
        message,
        role,
        timestamp,
        message_type,
        opening_message_id,
        media_url,
        media_filename,
        media_caption,
        processed
      FROM facebook_chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;
    
    const [messages] = await pool.execute(query, [sessionId]);
    
    logger.debug('Facebook messages fetched', { sessionId, count: messages?.length || 0 });
    
    res.json(messages || []);
  } catch (error) {
    logger.error('Error in /facebook/chat-messages', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch Facebook chat messages',
      details: error.message,
      code: error.code || 'UNKNOWN',
      sqlState: error.sqlState || 'N/A'
    });
  }
});

// PUT /api/chatboxContent/facebook/reset-new-message-count/:sessionId
router.put('/facebook/reset-new-message-count/:sessionId', async (req, res) => {
  logger.debug('PUT /facebook/reset-new-message-count/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const resetQuery = `
      UPDATE facebook_chat_sessions 
      SET new_message_count = 0 
      WHERE session_id = ?
    `;
    
    const [result] = await pool.execute(resetQuery, [sessionId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Session not found',
        details: `No Facebook session found with ID: ${sessionId}`
      });
    }
    
    logger.production('Facebook new message count reset', {
      sessionId,
      affectedRows: result.affectedRows
    });
    
    res.json({ 
      success: true,
      message: 'New message count reset successfully',
      session_id: sessionId
    });
  } catch (error) {
    logger.error('Error in PUT /facebook/reset-new-message-count', {
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to reset new message count',
      details: error.message
    });
  }
});

// POST /api/chatboxContent/facebook/send-reply
router.post('/facebook/send-reply', async (req, res) => {
  logger.debug('POST /facebook/send-reply endpoint hit');
  
  try {
    const { pageId, userId, message, sessionId, adminUser } = req.body;
    
    logger.info('Facebook send reply request', { 
      pageId,
      userId,
      messageLength: message?.length,
      sessionId, 
      adminUser 
    });
    
    if (!pageId || !userId || !message || !sessionId) {
      return res.status(400).json({ 
        error: 'Page ID, User ID, message, and session ID are required',
        missing: {
          pageId: !pageId,
          userId: !userId,
          message: !message,
          sessionId: !sessionId
        }
      });
    }

    // Facebook API configuration
    const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
    
    if (!META_PAGE_ACCESS_TOKEN) {
      logger.error('Facebook Page Access Token missing');
      return res.status(500).json({ 
        error: 'Facebook API not configured properly',
        details: 'Missing META_PAGE_ACCESS_TOKEN environment variable'
      });
    }

    const FACEBOOK_API_URL = `https://graph.facebook.com/${META_API_VERSION}/me/messages`;
    
    const facebookPayload = {
      recipient: { id: userId },
      message: { text: message },
      messaging_type: 'RESPONSE'
    };

    // Save to database first
    const malaysiaTime = getMalaysiaDateString();
    
    const insertMessageQuery = `
      INSERT INTO facebook_chat_messages (
        session_id, 
        page_id,
        user_id,
        message, 
        role, 
        message_type,
        timestamp,
        processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(insertMessageQuery, [
      sessionId,
      pageId,
      userId,
      message, 
      'admin',
      'text',
      malaysiaTime,
      1
    ]);

    // Send via Facebook API
    const response = await axios.post(
      FACEBOOK_API_URL, 
      facebookPayload,
      {
        params: { access_token: META_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    // Update session
    await pool.execute(`
      UPDATE facebook_chat_sessions 
      SET message_count = message_count + 1, 
          last_activity = CURRENT_TIMESTAMP,
          human_reply = 1
      WHERE session_id = ?
    `, [sessionId]);

    logger.production('Facebook reply sent successfully', {
      userId,
      sessionId,
      adminUser
    });

    return res.json({
      success: true,
      message: 'Facebook reply sent successfully',
      facebook_message_id: response.data?.message_id,
      sent_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in /facebook/send-reply', { message: error.message });
    
    res.status(500).json({ 
      error: 'Failed to send Facebook reply',
      details: error.message
    });
  }
});

// GET /api/chatboxContent/media_opening/:filename
// ===== OPENING MESSAGE MEDIA FILES =====
router.use('/media_opening', express.static(path.join(process.cwd(), 'public', 'media_opening')));

// Alternative: Specific route with logging
router.get('/media_opening/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Clean the filename (remove any path traversal attempts)
  const cleanFilename = path.basename(filename);
  
  // ✅ FIX: Use process.cwd() instead of __dirname for consistent path resolution
  const projectRoot = process.cwd();
  const filePath = path.join(projectRoot, 'public', 'media_opening', cleanFilename);
  
  logger.production('Opening media file requested', {
    requestedFilename: filename,
    cleanFilename: cleanFilename,
    projectRoot: projectRoot,
    filePath: filePath,
    exists: fs.existsSync(filePath),
    requestedFrom: req.headers.referer || 'unknown'
  });
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.error('Opening media file not found', { 
      filename: cleanFilename, 
      filePath: filePath,
      projectRoot: projectRoot,
      directoryExists: fs.existsSync(path.join(projectRoot, 'public', 'media_opening')),
      directoryContents: fs.existsSync(path.join(projectRoot, 'public', 'media_opening'))
        ? fs.readdirSync(path.join(projectRoot, 'public', 'media_opening')).slice(0, 10)
        : 'Directory does not exist'
    });
    
    return res.status(404).json({ 
      error: 'Opening media file not found',
      requestedFile: cleanFilename,
      fullPath: filePath,
      hint: 'Check that the file exists in public/media_opening/ directory'
    });
  }
  
  // Determine content type based on file extension
  const ext = path.extname(cleanFilename).toLowerCase();
  const mimeTypes = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    
    // Videos
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mkv': 'video/x-matroska',
    
    // Audio
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm'
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  logger.production('Serving opening media file', {
    filename: cleanFilename,
    contentType: contentType,
    size: fs.statSync(filePath).size,
    extension: ext
  });
  
  // Set response headers
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  
  // Handle range requests for videos
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      
      logger.debug('Serving partial content', {
        filename: cleanFilename,
        range: `${start}-${end}/${fileSize}`
      });
      
      return;
    }
    
    // No range request - send full file
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
  }
  
  // Send the file
  res.sendFile(filePath, (err) => {
    if (err) {
      logger.error('Error sending opening media file', {
        filename: cleanFilename,
        error: err.message
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to send file',
          details: err.message
        });
      }
    }
  });
});

// POST /api/chatboxContent/facebook/send-media
router.post('/facebook/send-media', upload.single('media'), async (req, res) => {
  logger.debug('POST /facebook/send-media endpoint hit');
  
  try {
    const { pageId, userId, sessionId, mediaType, adminUser, caption } = req.body;
    const file = req.file;
    
    if (!pageId || !userId || !sessionId || !mediaType || !file) {
      return res.status(400).json({ 
        error: 'Page ID, User ID, session ID, media type, and file are required'
      });
    }

    // Facebook API configuration
    const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
    
    if (!META_PAGE_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Facebook API not configured properly'
      });
    }

    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const extension = file.originalname.split('.').pop();
    const uniqueFileName = `${timestamp}_${randomString}.${extension}`;

    // Upload to GitHub
    const githubResult = await uploadToGitHub(uniqueFileName, file.buffer, mediaType);
    
    logger.info('GitHub upload successful for Facebook', { 
      relativePath: githubResult.relativePath 
    });

    // Upload to Facebook
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: uniqueFileName,
      contentType: file.mimetype
    });

    const uploadUrl = `https://graph.facebook.com/${META_API_VERSION}/me/message_attachments`;
    const uploadResponse = await axios.post(uploadUrl, form, {
      params: {
        access_token: META_PAGE_ACCESS_TOKEN,
        message: JSON.stringify({
          attachment: {
            type: mediaType === 'document' ? 'file' : mediaType,
            payload: { is_reusable: true }
          }
        })
      },
      headers: form.getHeaders(),
      timeout: 60000
    });

    const attachmentId = uploadResponse.data.attachment_id;

    // Send message with attachment
    const sendUrl = `https://graph.facebook.com/${META_API_VERSION}/me/messages`;
    const messagePayload = {
      recipient: { id: userId },
      message: {
        attachment: {
          type: mediaType === 'document' ? 'file' : mediaType,
          payload: { attachment_id: attachmentId }
        }
      }
    };

    if (caption) {
      messagePayload.message.text = caption;
    }

    await axios.post(sendUrl, messagePayload, {
      params: { access_token: META_PAGE_ACCESS_TOKEN },
      headers: { 'Content-Type': 'application/json' }
    });

    // ✅ Save to database with proper column mapping:
    // - media_url: relative path in send_media (e.g., "image/2025/10/15/file.jpg")
    // - media_filename: original filename
    const malaysiaTime = getMalaysiaDateString();
    await pool.execute(`
      INSERT INTO facebook_chat_messages (
        session_id, page_id, user_id, message, role, message_type,
        media_url, media_filename, media_caption, timestamp, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId, 
      pageId, 
      userId, 
      uniqueFileName,                 // message column
      'admin', 
      mediaType,
      githubResult.relativePath,      // ✅ media_url: "image/2025/10/15/file.jpg"
      file.originalname,              // ✅ media_filename: original name
      caption || null,
      malaysiaTime, 
      1
    ]);

    // Update session
    await pool.execute(`
      UPDATE facebook_chat_sessions 
      SET message_count = message_count + 1, 
          last_activity = CURRENT_TIMESTAMP,
          human_reply = 1
      WHERE session_id = ?
    `, [sessionId]);

    logger.production('Facebook media sent successfully', {
      sessionId,
      mediaType,
      relativePath: githubResult.relativePath,
      originalFilename: file.originalname,
      adminUser
    });

    res.json({
      success: true,
      message: 'Facebook media sent successfully',
      attachment_id: attachmentId,
      media_url: githubResult.relativePath,
      media_filename: file.originalname
    });

  } catch (error) {
    logger.error('Error in /facebook/send-media', { 
      message: error.message,
      stack: error.stack 
    });
    res.status(500).json({ 
      error: 'Failed to send Facebook media',
      details: error.message
    });
  }
});

// PUT /api/chatboxContent/facebook/reset-session-flags/:sessionId
router.put('/facebook/reset-session-flags/:sessionId', async (req, res) => {
  logger.debug('PUT /facebook/reset-session-flags/:sessionId endpoint hit');
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const malaysiaTime = getMalaysiaDateString();
    const [result] = await pool.execute(`
      UPDATE facebook_chat_sessions 
      SET appointment_section = 0,
          human_section = 0,
          human_reply = 0,
          last_activity = ?
      WHERE session_id = ?
    `, [malaysiaTime, sessionId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Session not found'
      });
    }
    
    logger.production('Facebook session flags reset', { sessionId });
    
    res.json({ 
      success: true,
      message: 'Session flags reset successfully'
    });
  } catch (error) {
    logger.error('Error in PUT /facebook/reset-session-flags', {
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to reset session flags',
      details: error.message
    });
  }
});


// ===== FIXED MEDIA FILE SERVING ENDPOINTS =====

// FIXED: Serve admin-sent media files from local send_media directory
router.use('/send_media', express.static(path.join(__dirname, '../public/send_media')));

const PYTHON_RAILWAY_SERVICE_URL = 'https://python-chatbot-production-f8c4.up.railway.app';

// FIXED: Audio file serving endpoint - handles both user and admin audio
router.get('/audios/*', async (req, res) => {
  const fullPath = req.params[0];
  console.log('Audio request for full path:', fullPath);
  
  // FIXED: Construct the correct local path with media type prefix
  const localPath = path.join(__dirname, '../public/send_media/audio', fullPath);
  const isAdminFile = fs.existsSync(localPath);
  
  console.log('Checking if admin file exists:', localPath, 'Result:', isAdminFile);
  
  if (isAdminFile) {
    // This is an admin file - serve from local storage
    console.log('Serving admin audio from local path:', localPath);
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm'
    };
    
    const contentType = mimeTypes[ext] || 'audio/mpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(localPath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
    }
    
    return;
  }
  
  // This is a user file - fetch from Python Railway service
  console.log('Treating as user file, fetching from Python Railway service');
  
  try {
    const railwayUrl = `${PYTHON_RAILWAY_SERVICE_URL}/media/${fullPath}`;
    console.log('Fetching user audio from Railway service:', railwayUrl);
    
    const headers = {
      'User-Agent': 'Node.js Audio Proxy'
    };
    
    if (req.headers.range) {
      headers.range = req.headers.range;
    }
    
    const response = await axios.get(railwayUrl, { 
      responseType: 'stream',
      headers: headers,
      timeout: 30000,
      validateStatus: function (status) {
        return (status >= 200 && status < 300) || status === 206;
      }
    });

    if (response.status === 206) {
      res.status(206);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    const headersToForward = [
      'content-type', 
      'content-length', 
      'accept-ranges', 
      'content-range',
      'cache-control',
      'last-modified',
      'etag'
    ];
    
    headersToForward.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });
    
    if (!response.headers['content-type']) {
      const ext = fullPath.split('.').pop().toLowerCase();
      const audioMimeTypes = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'aac': 'audio/aac',
        'm4a': 'audio/mp4',
        'webm': 'audio/webm'
      };
      res.setHeader('Content-Type', audioMimeTypes[ext] || 'audio/mpeg');
    }
    
    response.data.pipe(res);
    
    response.data.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).send('Audio stream error');
      }
    });
    
  } catch (error) {
    console.error('Failed to fetch user audio from Railway service:', error.message);
    
    if (error.response?.status === 404) {
      res.status(404).send('Audio file not found');
    } else if (error.response?.status === 416) {
      res.status(416).send('Range not satisfiable');
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).send('Audio request timeout');
    } else {
      res.status(500).send(`Audio server error: ${error.message}`);
    }
  }
});

// FIXED: Image file serving endpoint
router.get('/images/*', async (req, res) => {
  const fullPath = req.params[0];
  console.log('Image request for full path:', fullPath);
  
  // FIXED: Construct the correct local path with media type prefix
  // Frontend sends: "2025/08/06/filename.jpg"
  // We need to check: "public/send_media/image/2025/08/06/filename.jpg"
  const localPath = path.join(__dirname, '../public/send_media/image', fullPath);
  const isAdminFile = fs.existsSync(localPath);
  
  console.log('Checking if admin file exists:', localPath, 'Result:', isAdminFile);
  
  if (isAdminFile) {
    // This is an admin file - serve from local storage
    console.log('Serving admin image from local path:', localPath);
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    const contentType = mimeTypes[ext] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const stream = fs.createReadStream(localPath);
    stream.pipe(res);
    return;
  }
  
  // This is a user file - fetch from Python Railway service
  console.log('Treating as user file, fetching from Python Railway service');
  
  try {
    const railwayUrl = `${PYTHON_RAILWAY_SERVICE_URL}/media/${fullPath}`;
    console.log('Fetching user image from Railway service:', railwayUrl);
    
    const response = await axios.get(railwayUrl, { 
      responseType: 'stream',
      timeout: 30000
    });
    
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Failed to fetch user image from Railway service:', error.message);
    res.status(404).send('Image not found.');
  }
});

// FIXED: Video file serving endpoint
router.get('/videos/*', async (req, res) => {
  const fullPath = req.params[0];
  console.log('Video request for full path:', fullPath);
  
  // FIXED: Construct the correct local path with media type prefix
  const localPath = path.join(__dirname, '../public/send_media/video', fullPath);
  const isAdminFile = fs.existsSync(localPath);
  
  console.log('Checking if admin file exists:', localPath, 'Result:', isAdminFile);
  
  if (isAdminFile) {
    // This is an admin file - serve from local storage
    console.log('Serving admin video from local path:', localPath);
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.webm': 'video/webm'
    };
    
    const contentType = mimeTypes[ext] || 'video/mp4';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(localPath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
    }
    
    return;
  }
  
  // This is a user file - fetch from Python Railway service
  console.log('Treating as user file, fetching from Python Railway service');
  
  try {
    const railwayUrl = `${PYTHON_RAILWAY_SERVICE_URL}/media/${fullPath}`;
    console.log('Fetching user video from Railway service:', railwayUrl);
    
    const headers = {};
    if (req.headers.range) {
      headers.range = req.headers.range;
    }
    
    const response = await axios.get(railwayUrl, { 
      responseType: 'stream',
      headers: headers,
      timeout: 60000
    });
    
    if (response.status === 206) {
      res.status(206);
    }
    
    const headersToForward = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
    headersToForward.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Failed to fetch user video from Railway service:', error.message);
    res.status(404).send('Video not found.');
  }
});

// FIXED: Document file serving endpoint
router.get('/documents/*', async (req, res) => {
  const fullPath = req.params[0];
  console.log('Document request for full path:', fullPath);
  
  // FIXED: Construct the correct local path with media type prefix
  const localPath = path.join(__dirname, '../public/send_media/document', fullPath);
  const isAdminFile = fs.existsSync(localPath);
  
  console.log('Checking if admin file exists:', localPath, 'Result:', isAdminFile);
  
  if (isAdminFile) {
    // This is an admin file - serve from local storage
    console.log('Serving admin document from local path:', localPath);
    
    const filename = path.basename(fullPath);
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const stream = fs.createReadStream(localPath);
    stream.pipe(res);
    return;
  }
  
  // This is a user file - fetch from Python Railway service
  console.log('Treating as user file, fetching from Python Railway service');
  
  try {
    const railwayUrl = `${PYTHON_RAILWAY_SERVICE_URL}/media/${fullPath}`;
    console.log('Fetching user document from Railway service:', railwayUrl);

    const response = await axios.get(railwayUrl, { 
      responseType: 'stream',
      timeout: 60000
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const filename = fullPath.split('/').pop();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Failed to fetch user document from Railway service:', error.message);
    res.status(404).send('Document not found.');
  }
});

router.get('/facebook/user-info/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  try {
    // Use the same token you already use elsewhere for FB messaging
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
    if (!PAGE_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Facebook Page Access Token not configured (META_PAGE_ACCESS_TOKEN)'
      });
    }

    // Ask Graph API for the user's public Messenger profile fields
    const graphUrl = `https://graph.facebook.com/${META_API_VERSION}/${userId}`;
    const { data } = await axios.get(graphUrl, {
      params: {
        fields: 'name,first_name,last_name,profile_pic',
        access_token: PAGE_TOKEN
      },
      timeout: 15000
    });

    if (data?.name) {
      return res.json({
        success: true,
        user_id: userId,
        name: data.name,
        first_name: data.first_name,
        last_name: data.last_name,
        profile_pic: data.profile_pic || null
      });
    }

    return res.json({ success: false, error: 'User name not found', user_id: userId });
  } catch (error) {
    logger.error('Error fetching Facebook user info', {
      userId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return res.json({
      success: false,
      error: 'Failed to fetch name from Facebook',
      fallback_user_id: userId
    });
  }
});

module.exports = router;