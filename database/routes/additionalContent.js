const express = require('express');
const router = express.Router();
const pool = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const { getMalaysiaDateString } = require('./utils/dateUtils');

// ===== GITHUB CONFIGURATION =====
const GITHUB_CONFIG = {
  owner: 'Welsh510',
  repo: 'reactjs-appointmentwhatsapp',
  branch: 'master' // Use correct branch
};

// ===== GITHUB URL HELPER FUNCTION =====
const getGitHubUrl = (filename) => {
  return `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/public/additional_content_files/${filename}`;
};

// ===== GITHUB API FUNCTIONS =====
const uploadToGitHub = async (filename, fileBuffer) => {
  try {
    console.log(`\n=== UPLOADING ${filename} TO GITHUB (ADDITIONAL CONTENT) ===`);
    
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable not set');
    }

    // Convert file buffer to base64
    const content = fileBuffer.toString('base64');
    
    const apiPath = `public/additional_content_files/${filename}`;
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${apiPath}`;
    
    console.log('Uploading to GitHub:', url);
    console.log('File size:', fileBuffer.length, 'bytes');
    
    const response = await axios.put(url, {
      message: `Auto-upload: Add additional content file ${filename}`,
      content: content,
      branch: GITHUB_CONFIG.branch
    }, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Railway-Additional-Content-Upload'
      },
      timeout: 60000
    });

    const githubUrl = getGitHubUrl(filename);
    
    console.log('GitHub upload successful!');
    console.log('File URL:', githubUrl);
    console.log(`=== UPLOAD COMPLETED FOR ${filename} ===\n`);
    
    return {
      success: true,
      githubUrl: githubUrl,
      sha: response.data.commit.sha,
      htmlUrl: response.data.content.html_url
    };
    
  } catch (error) {
    console.error(`=== GITHUB UPLOAD FAILED FOR ${filename} ===`);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      // Check if file already exists
      if (error.response.status === 422 && error.response.data.message.includes('already exists')) {
        console.log('File already exists in repository');
        const githubUrl = getGitHubUrl(filename);
        return {
          success: true,
          githubUrl: githubUrl,
          alreadyExists: true
        };
      }
    } else {
      console.error('Error:', error.message);
    }
    
    console.error('==========================================\n');
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

// ===== MULTER CONFIGURATION FOR ADDITIONAL CONTENT =====
// Create temporary directory for file processing
const tempDir = path.join(__dirname, '..', '..', 'temp_additional_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('Created temporary directory for additional content:', tempDir);
}

// Configure multer for temporary file storage
const additionalContentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Generate filename using current timestamp
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}${extension}`;
    cb(null, filename);
  }
});

const additionalContentUpload = multer({ 
  storage: additionalContentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    console.log('File filter - mimetype:', file.mimetype);
    // Accept PDF, Word documents, and Excel files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', // Excel .xls files
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // Excel .xlsx files
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word documents, and Excel files are allowed.'));
    }
  }
});

// Clean up temporary file
const cleanupTempFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Cleaned up temporary file:', filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temporary file:', error);
  }
};

// ===== ROUTES =====

// Get chatbox additional content by PKKEY
router.get('/additional-content/:pkkey', async (req, res) => {
  const { pkkey } = req.params;

  const query = `
    SELECT ADDITIONAL_CONTENT 
    FROM chatbox_frame 
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(query, [pkkey]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Additional content not found' 
      });
    }

    res.json({
      success: true,
      additionalContent: results[0].ADDITIONAL_CONTENT
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update chatbox additional content by PKKEY
router.put('/additional-content/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  const { additionalContent } = req.body;

  if (additionalContent === undefined || additionalContent === null) {
    return res.status(400).json({ 
      success: false, 
      message: 'Additional content is required' 
    });
  }

  const updateQuery = `
    UPDATE chatbox_frame 
    SET ADDITIONAL_CONTENT = ?
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(updateQuery, [additionalContent, pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Additional content not found' 
      });
    }

    res.json({
      success: true,
      message: 'Additional content updated successfully'
    });

  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update additional content' 
    });
  }
});

// Get all additional content files (with blob size info)
router.get('/', async (req, res) => {
  const query = `
    SELECT id, filename, original_name, file_size, mime_type, created_at,
           LENGTH(file_content) as blob_size
    FROM additional_content_files 
    ORDER BY created_at DESC
  `;

  try {
    const [results] = await pool.execute(query);

    res.json({
      success: true,
      files: results.map(file => ({
        ...file,
        has_blob_content: file.blob_size > 0,
        blob_size_mb: file.blob_size ? (file.blob_size / 1024 / 1024).toFixed(2) : '0'
      }))
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Updated file download route - serve from database blob OR GitHub (fallback)
router.get('/file/:id', async (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT filename, original_name, mime_type, file_content 
    FROM additional_content_files 
    WHERE id = ?
  `;

  try {
    const [results] = await pool.execute(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }

    const file = results[0];
    
    // Try to serve from database blob first
    if (file.file_content && file.file_content.length > 0) {
      console.log('✅ Serving file from database blob:', file.original_name);
      
      // Set headers and send file from blob
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Length', file.file_content.length);
      res.send(file.file_content);
      return;
    }
    
    // Fallback to GitHub if blob is not available
    console.log('⚠️ Blob not found, falling back to GitHub for:', file.original_name);
    
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({
        success: false,
        message: 'File content not available and GitHub token not configured'
      });
    }

    const apiPath = `public/additional_content_files/${file.filename}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${apiPath}`;
    
    console.log('Fetching from GitHub API as fallback:', apiUrl);

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Decode base64 content
      const fileContent = Buffer.from(response.data.content, 'base64');
      
      // Set headers and send file
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Length', fileContent.length);
      res.send(fileContent);
      
      console.log('✅ File downloaded successfully via GitHub API fallback');

    } catch (githubError) {
      console.error('❌ GitHub API error:', githubError.message);
      res.status(404).json({
        success: false,
        message: 'File not found in database or GitHub repository'
      });
    }

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Upload additional content files WITH GITHUB INTEGRATION AND BLOB STORAGE
router.post('/upload', (req, res) => {
  console.log('Additional content file upload endpoint hit');
  
  const uploadMultiple = additionalContentUpload.array('files', 10); // Allow up to 10 files
  
  uploadMultiple(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    
    const files = req.files;
    
    console.log('Files:', files);

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    // Process files: Upload to GitHub and save to database WITH BLOB CONTENT
    const uploadPromises = files.map(file => {
      return new Promise(async (resolve, reject) => {
        try {
          // Read the file content as buffer
          const fileBuffer = fs.readFileSync(file.path);
          
          // Upload to GitHub
          console.log(`=== STARTING GITHUB UPLOAD FOR ${file.filename} ===`);
          const githubResult = await uploadToGitHub(file.filename, fileBuffer);
          console.log(`=== GITHUB UPLOAD COMPLETED FOR ${file.filename} ===`);
          
          // Clean up temporary file
          cleanupTempFile(file.path);

          // Save to database WITH file_content BLOB
          const insertQuery = `
			INSERT INTO additional_content_files (filename, original_name, file_size, mime_type, file_content, created_at) 
			VALUES (?, ?, ?, ?, ?, ?)
		  `;

          const malaysiaTime = getMalaysiaDateString();

			const [results] = await pool.execute(insertQuery, [
			  file.filename, 
			  file.originalname, 
			  file.size, 
			  file.mimetype,
			  fileBuffer,
			  malaysiaTime  // created_at with Malaysia time
			]);
          
          console.log(`✅ File saved to database with blob content: ${file.originalname} (${fileBuffer.length} bytes)`);
          
          resolve({
            id: results.insertId,
            filename: file.filename,
            originalName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            blobSize: fileBuffer.length,
            githubUrl: githubResult.success ? githubResult.githubUrl : null,
            github: githubResult
          });

        } catch (error) {
          console.error('Error processing file:', error);
          
          // Clean up temporary file on error
          cleanupTempFile(file?.path);
          
          reject(error);
        }
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      
      const successfulUploads = results.filter(r => r.github && r.github.success);
      const failedUploads = results.filter(r => !r.github || !r.github.success);
      
      console.log(`Processed ${files.length} files: ${successfulUploads.length} successful, ${failedUploads.length} failed`);
      
      let message = `${successfulUploads.length} file(s) uploaded successfully with blob content saved`;
      if (failedUploads.length > 0) {
        message += ` (${failedUploads.length} GitHub uploads failed)`;
      }
      
      res.json({
        success: true,
        message: message,
        files: results,
        githubStats: {
          successful: successfulUploads.length,
          failed: failedUploads.length
        },
        blobStats: {
          totalBlobSize: results.reduce((sum, r) => sum + (r.blobSize || 0), 0),
          averageBlobSize: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.blobSize || 0), 0) / results.length) : 0
        }
      });

    } catch (error) {
      console.error('Error processing files:', error);
      
      // Clean up any remaining temporary files
      files.forEach(file => {
        cleanupTempFile(file.path);
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to process files: ' + error.message
      });
    }
  });
});

// Delete additional content file (NO GITHUB DELETION, but removes blob)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Get file info before deletion (for logging)
  const selectQuery = `SELECT original_name, LENGTH(file_content) as blob_size FROM additional_content_files WHERE id = ?`;
  
  try {
    const [selectResults] = await pool.execute(selectQuery, [id]);
    
    if (selectResults.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }
    
    const fileInfo = selectResults[0];
    
    // Delete from database only (keep file in GitHub as requested)
    const deleteQuery = `DELETE FROM additional_content_files WHERE id = ?`;
    const [deleteResults] = await pool.execute(deleteQuery, [id]);

    console.log(`🗑️ Deleted file record: ${fileInfo.original_name} (blob size: ${fileInfo.blob_size} bytes)`);

    res.json({
      success: true,
      message: 'File deleted successfully (blob and metadata removed)',
      note: 'File kept in GitHub repository',
      deletedFile: {
        name: fileInfo.original_name,
        blobSize: fileInfo.blob_size
      }
    });

  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete file record' 
    });
  }
});

module.exports = router;