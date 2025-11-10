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
  branch: 'master'
};

const getDefaultBranch = async () => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return response.data.default_branch;
  } catch (error) {
    console.error('Error getting default branch:', error);
    return 'main';
  }
};

const getGitHubUrl = (filename) => {
  return `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/raw/master/public/media_followup/${filename}`;
};

// ===== GITHUB API FUNCTIONS =====
const uploadToGitHub = async (filename, fileBuffer) => {
  try {
    console.log(`\n=== UPLOADING ${filename} TO GITHUB ===`);
    
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable not set');
    }

    const defaultBranch = await getDefaultBranch();
    const content = fileBuffer.toString('base64');
    
    const apiPath = `public/media_followup/${filename}`;
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${apiPath}`;
    
    const response = await axios.put(url, {
      message: `Auto-upload: Add media file ${filename}`,
      content: content,
      branch: defaultBranch
    }, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Railway-Media-Upload'
      },
      timeout: 60000
    });

    const githubUrl = `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/raw/${defaultBranch}/public/media_followup/${filename}`;
    
    console.log('GitHub upload successful!');
    console.log('File URL:', githubUrl);
    
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
      
      if (error.response.status === 422 && error.response.data.message.includes('already exists')) {
        const defaultBranch = await getDefaultBranch();
        const githubUrl = `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/raw/${defaultBranch}/public/media_followup/${filename}`;
        return {
          success: true,
          githubUrl: githubUrl,
          alreadyExists: true
        };
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

const updateFileInGitHub = async (filename, fileBuffer, oldFilename = null) => {
  try {
    console.log(`\n=== UPDATING ${filename} IN GITHUB ===`);
    const uploadResult = await uploadToGitHub(filename, fileBuffer);
    console.log('Note: Old files are kept in GitHub repository for data integrity');
    return uploadResult;
  } catch (error) {
    console.error('GitHub update failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ===== MULTER CONFIGURATION =====
const tempDir = path.join(__dirname, '..', '..', 'temp_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('Created temporary directory:', tempDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    console.log('File filter - mimetype:', file.mimetype);
    
    // Define allowed types
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4'];
    
    if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, PNG, GIF images and MP4 videos are allowed.'));
    }
  }
});

// ===== HELPER FUNCTIONS =====
const getNextCategorySequence = async () => {
  const query = `SELECT COALESCE(MAX(SEQUENCE), 0) + 1 as nextSequence FROM followup`;
  const [results] = await pool.execute(query);
  return results[0].nextSequence;
};

const getNextItemSequence = async (categoryId) => {
  const query = `SELECT COALESCE(MAX(SEQUENCE), 0) + 1 as nextSequence FROM followup_sub WHERE CATEGORY_ID = ?`;
  const [results] = await pool.execute(query, [categoryId]);
  return results[0].nextSequence;
};

const validateCategoryExists = async (categoryId) => {
  const query = `SELECT PKKEY FROM followup WHERE PKKEY = ?`;
  const [results] = await pool.execute(query, [categoryId]);
  
  if (results.length === 0) {
    throw new Error('Category not found');
  }
  
  return true;
};

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

// ===== CATEGORY ROUTES (followup - MAIN TABLE) =====
// UPDATED: Changed KEYWORDS to TITLE throughout

// Get all categories
router.get('/categories', async (req, res) => {
  const query = `
    SELECT PKKEY, TITLE, SEQUENCE, FOLLOWUP_TIME, FOLLOWUP_SELECTION, CREATED_AT, UPDATED_AT
    FROM followup 
    ORDER BY SEQUENCE ASC
  `;

  try {
    const [results] = await pool.execute(query);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Add new category
router.post('/categories', async (req, res) => {
  const { title, followupTime, followupSelection } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Title is required' 
    });
  }

  if (!followupTime || followupTime.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Follow-up time is required' 
    });
  }

  if (!followupSelection || ![1, 2, 3].includes(parseInt(followupSelection))) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid follow-up selection is required' 
    });
  }

  try {
    const nextSequence = await getNextCategorySequence();

    const insertQuery = `
	  INSERT INTO followup (TITLE, SEQUENCE, FOLLOWUP_TIME, FOLLOWUP_SELECTION, CREATED_AT, UPDATED_AT) 
	  VALUES (?, ?, ?, ?, ?, ?)
	`;

    const malaysiaTime = getMalaysiaDateString();

	const [results] = await pool.execute(insertQuery, [
	  title.trim(), 
	  nextSequence,
	  followupTime.trim(),
	  parseInt(followupSelection),
	  malaysiaTime, // created_at
	  malaysiaTime  // updated_at
	]);

    res.json({
      success: true,
      message: 'Category created successfully',
      id: results.insertId
    });

  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create category' 
    });
  }
});

// Update category
router.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { title, followupTime, followupSelection } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Title is required' 
    });
  }

  if (!followupTime || followupTime.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Follow-up time is required' 
    });
  }

  if (!followupSelection || ![1, 2, 3].includes(parseInt(followupSelection))) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid follow-up selection is required' 
    });
  }

  try {
    const updateQuery = `
	  UPDATE followup 
	  SET TITLE = ?, FOLLOWUP_TIME = ?, FOLLOWUP_SELECTION = ?, UPDATED_AT = ?
	  WHERE PKKEY = ?
	`;

    const malaysiaTime = getMalaysiaDateString();

	const [results] = await pool.execute(updateQuery, [
	  title.trim(), 
	  followupTime.trim(),
	  parseInt(followupSelection),
	  malaysiaTime, // updated_at
	  id
	]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully'
    });

  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update category' 
    });
  }
});

// Delete category (and all its content)
router.delete('/categories/:id', async (req, res) => {
  const { id } = req.params;

  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // First check if category exists
    const checkQuery = `SELECT PKKEY, TITLE FROM followup WHERE PKKEY = ?`;
    const [categoryResult] = await connection.execute(checkQuery, [id]);

    if (categoryResult.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Get count of content items in this category
    const countQuery = `SELECT COUNT(*) as itemCount FROM followup_sub WHERE CATEGORY_ID = ?`;
    const [countResult] = await connection.execute(countQuery, [id]);
    const itemCount = countResult[0].itemCount;

    // Delete all content items in this category first
    if (itemCount > 0) {
      const deleteItemsQuery = `DELETE FROM followup_sub WHERE CATEGORY_ID = ?`;
      await connection.execute(deleteItemsQuery, [id]);
    }

    // Delete the category
    const deleteCategoryQuery = `DELETE FROM followup WHERE PKKEY = ?`;
    await connection.execute(deleteCategoryQuery, [id]);

    await connection.commit();

    res.json({
      success: true,
      message: `Category deleted successfully (${itemCount} content items also removed)`,
      deletedItems: itemCount
    });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete category' 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Update category sequence
router.put('/categories/update-sequence', async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid updates array' 
    });
  }

  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    for (const update of updates) {
      if (!update.pkkey || !update.sequence) {
        throw new Error('Invalid update data');
      }

      const sql = 'UPDATE followup SET SEQUENCE = ? WHERE PKKEY = ?';
      const [result] = await connection.execute(sql, [
        parseInt(update.sequence), 
        update.pkkey
      ]);
      
      if (result.affectedRows === 0) {
        throw new Error(`No category found for PKKEY ${update.pkkey}`);
      }
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: `Successfully updated ${updates.length} category sequences`
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Category sequence update error:', error);
    res.status(500).json({
      success: false,
      message: `Update failed: ${error.message}`
    });
    
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get categories with content count
router.get('/categories/with-counts', async (req, res) => {
  const query = `
    SELECT 
      c.PKKEY, 
      c.TITLE, 
      c.SEQUENCE, 
      c.FOLLOWUP_TIME,
      c.FOLLOWUP_SELECTION,
      c.CREATED_AT,
      c.UPDATED_AT,
      COUNT(fs.PKKEY) as CONTENT_COUNT
    FROM followup c
    LEFT JOIN followup_sub fs ON c.PKKEY = fs.CATEGORY_ID
    GROUP BY c.PKKEY, c.TITLE, c.SEQUENCE, c.FOLLOWUP_TIME, c.FOLLOWUP_SELECTION, c.CREATED_AT, c.UPDATED_AT
    ORDER BY c.SEQUENCE ASC
  `;

  try {
    const [results] = await pool.execute(query);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// ===== CONTENT ROUTES (followup_sub - SUB TABLE) =====
// UPDATED: Changed KEYWORDS references to TITLE

// Get all content entries with category information
router.get('/', async (req, res) => {
  const query = `
    SELECT 
      fs.PKKEY, 
      fs.TYPE, 
      fs.TEXT_CONTENT, 
      fs.MEDIANAME, 
      fs.SEQUENCE, 
      fs.CATEGORY_ID,
      f.TITLE as CATEGORY_TITLE,
      f.FOLLOWUP_TIME,
      f.FOLLOWUP_SELECTION
    FROM followup_sub fs
    LEFT JOIN followup f ON fs.CATEGORY_ID = f.PKKEY
    ORDER BY f.SEQUENCE ASC, fs.SEQUENCE ASC
  `;

  try {
    const [results] = await pool.execute(query);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get entries by category
router.get('/category/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  
  const query = `
    SELECT 
      fs.PKKEY, 
      fs.TYPE, 
      fs.TEXT_CONTENT, 
      fs.MEDIANAME, 
      fs.SEQUENCE, 
      fs.CATEGORY_ID,
      f.TITLE as CATEGORY_TITLE,
      f.FOLLOWUP_TIME,
      f.FOLLOWUP_SELECTION
    FROM followup_sub fs
    LEFT JOIN followup f ON fs.CATEGORY_ID = f.PKKEY
    WHERE fs.CATEGORY_ID = ?
    ORDER BY fs.SEQUENCE ASC
  `;

  try {
    const [results] = await pool.execute(query, [categoryId]);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update sequence within category
router.put('/update-sequence', async (req, res) => {
  console.log('=== SEQUENCE UPDATE ENDPOINT HIT ===');
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    console.log('Invalid updates array');
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid updates array' 
    });
  }

  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    let completedUpdates = 0;
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      console.log(`Processing update ${i + 1}:`, update);

      if (!update.pkkey || !update.sequence) {
        throw new Error(`Invalid data at index ${i}`);
      }

      const sql = 'UPDATE followup_sub SET SEQUENCE = ? WHERE PKKEY = ?';
      const params = [parseInt(update.sequence), update.pkkey];
      
      console.log('Executing SQL:', sql, 'with params:', params);

      const [result] = await connection.execute(sql, params);
      
      if (result.affectedRows === 0) {
        throw new Error(`No record found for PKKEY ${update.pkkey}`);
      }
      
      console.log(`Update ${i + 1} successful, affected rows:`, result.affectedRows);
      completedUpdates++;
    }
    
    await connection.commit();
    
    console.log(`All ${completedUpdates} updates successful`);
    res.json({
      success: true,
      message: `Successfully updated ${completedUpdates} sequences`
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Sequence update error:', error);
    res.status(500).json({
      success: false,
      message: `Update failed: ${error.message}`
    });
    
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Add new text entry
router.post('/text', async (req, res) => {
  const { textContent, categoryId } = req.body;

  if (!textContent || !categoryId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Text content and category are required' 
    });
  }

  try {
    // Validate category exists
    await validateCategoryExists(categoryId);
    
    const nextSequence = await getNextItemSequence(categoryId);
    const malaysiaTime = getMalaysiaDateString();

    const insertQuery = `
      INSERT INTO followup_sub (TYPE, TEXT_CONTENT, CATEGORY_ID, SEQUENCE, CREATED_AT, UPDATED_AT) 
      VALUES (1, ?, ?, ?, ?, ?)
    `;

    const [results] = await pool.execute(insertQuery, [
      textContent, 
      categoryId, 
      nextSequence,
      malaysiaTime,
      malaysiaTime
    ]);

    res.json({
      success: true,
      message: 'Text entry created successfully',
      id: results.insertId
    });

  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to create text entry'
    });
  }
});

// Add new image entry with GitHub upload
router.post('/image', (req, res) => {
  console.log('Image upload endpoint hit');
  
  const uploadSingle = upload.single('image');
  
  uploadSingle(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    
    const { categoryId } = req.body;
    const file = req.file;
    
    console.log('Category ID:', categoryId);
    console.log('File:', file);

    if (!categoryId) {
      cleanupTempFile(file?.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Category is required' 
      });
    }

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Image file is required' 
      });
    }

    // Updated allowed image types - removed 'image/webp'
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedImageTypes.includes(file.mimetype)) {
      cleanupTempFile(file.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file type. Only JPG, JPEG, PNG, and GIF images are allowed' 
      });
    }

    try {
      // Validate category exists
      await validateCategoryExists(categoryId);
      
      const nextSequence = await getNextItemSequence(categoryId);
      const fileBuffer = fs.readFileSync(file.path);
      const malaysiaTime = getMalaysiaDateString();
      
      console.log('=== STARTING GITHUB UPLOAD PROCESS ===');
      const githubResult = await uploadToGitHub(file.filename, fileBuffer);
      console.log('=== GITHUB UPLOAD PROCESS COMPLETED ===');
      
      cleanupTempFile(file.path);

      const insertQuery = `
        INSERT INTO followup_sub (TYPE, MEDIANAME, CATEGORY_ID, SEQUENCE, CREATED_AT, UPDATED_AT) 
        VALUES (2, ?, ?, ?, ?, ?)
      `;

      console.log('Inserting into database:', { 
        filename: file.filename, 
        categoryId,
        nextSequence 
      });

      const [results] = await pool.execute(insertQuery, [
        file.filename, 
        categoryId,
        nextSequence,
        malaysiaTime,
        malaysiaTime
      ]);

      console.log('Image entry created successfully');
      res.json({
        success: true,
        message: `Image entry created successfully${githubResult.success ? ' and uploaded to GitHub' : ' (GitHub upload failed)'}`,
        id: results.insertId,
        filename: file.filename,
        githubUrl: githubResult.success ? githubResult.githubUrl : null,
        github: githubResult
      });

    } catch (err) {
      console.error('Error:', err);
      cleanupTempFile(file?.path);
      
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Failed to create image entry'
      });
    }
  });
});

// Add new video entry with GitHub upload
router.post('/video', (req, res) => {
  console.log('Video upload endpoint hit');
  
  const uploadSingle = upload.single('video');
  
  uploadSingle(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    
    const { categoryId } = req.body;
    const file = req.file;
    
    console.log('Category ID:', categoryId);
    console.log('File:', file);

    if (!categoryId) {
      cleanupTempFile(file?.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Category is required' 
      });
    }

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video file is required' 
      });
    }

    // Updated allowed video types - only MP4
    const allowedVideoTypes = ['video/mp4'];
    if (!allowedVideoTypes.includes(file.mimetype)) {
      cleanupTempFile(file.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file type. Only MP4 videos are allowed' 
      });
    }

    try {
      // Validate category exists
      await validateCategoryExists(categoryId);
      
      const nextSequence = await getNextItemSequence(categoryId);
      const fileBuffer = fs.readFileSync(file.path);
      const malaysiaTime = getMalaysiaDateString();
      
      console.log('=== STARTING GITHUB UPLOAD PROCESS ===');
      const githubResult = await uploadToGitHub(file.filename, fileBuffer);
      console.log('=== GITHUB UPLOAD PROCESS COMPLETED ===');
      
      cleanupTempFile(file.path);

      const insertQuery = `
        INSERT INTO followup_sub (TYPE, MEDIANAME, CATEGORY_ID, SEQUENCE, CREATED_AT, UPDATED_AT) 
        VALUES (3, ?, ?, ?, ?, ?)
      `;

      console.log('Inserting into database:', { 
        filename: file.filename, 
        categoryId,
        nextSequence 
      });

      const [results] = await pool.execute(insertQuery, [
        file.filename, 
        categoryId,
        nextSequence,
        malaysiaTime,
        malaysiaTime
      ]);

      console.log('Video entry created successfully');
      res.json({
        success: true,
        message: `Video entry created successfully${githubResult.success ? ' and uploaded to GitHub' : ' (GitHub upload failed)'}`,
        id: results.insertId,
        filename: file.filename,
        githubUrl: githubResult.success ? githubResult.githubUrl : null,
        github: githubResult
      });

    } catch (err) {
      console.error('Error:', err);
      cleanupTempFile(file?.path);
      
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Failed to create video entry'
      });
    }
  });
});

// Update content entry with GitHub integration
router.put('/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const { id } = req.params;
  const { textContent, categoryId } = req.body;

  if (!categoryId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Category is required' 
    });
  }

  try {
    // Validate category exists
    await validateCategoryExists(categoryId);
    
    // Get the existing entry
    const selectQuery = `SELECT TYPE, MEDIANAME, CATEGORY_ID FROM followup_sub WHERE PKKEY = ?`;
    const [results] = await pool.execute(selectQuery, [id]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }

    const existingEntry = results[0];
    const entryType = existingEntry.TYPE;
    const oldMediaName = existingEntry.MEDIANAME;

    let updateQuery;
    let queryParams;
    let newMediaName = null;
    let githubUploadResult = null;
    const malaysiaTime = getMalaysiaDateString(); // Add Malaysia time

    // Handle different types of updates
    if (entryType === 1) {
      // Text entry
      if (!textContent) {
        return res.status(400).json({ 
          success: false, 
          message: 'Text content is required for text entries' 
        });
      }
      
      updateQuery = `
        UPDATE followup_sub 
        SET TEXT_CONTENT = ?, CATEGORY_ID = ?, UPDATED_AT = ?
        WHERE PKKEY = ?
      `;
      queryParams = [textContent, categoryId, malaysiaTime, id];
      
    } else if (entryType === 2) {
      // Image entry
      if (req.files && req.files.image && req.files.image[0]) {
        const imageFile = req.files.image[0];
        
        // Updated allowed image types
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedImageTypes.includes(imageFile.mimetype)) {
          cleanupTempFile(imageFile.path);
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid file type. Only JPG, JPEG, PNG, and GIF images are allowed' 
          });
        }
        
        const fileBuffer = fs.readFileSync(imageFile.path);
        githubUploadResult = await updateFileInGitHub(imageFile.filename, fileBuffer, oldMediaName);
        
        cleanupTempFile(imageFile.path);
        newMediaName = imageFile.filename;
        
        updateQuery = `
          UPDATE followup_sub 
          SET MEDIANAME = ?, CATEGORY_ID = ?, UPDATED_AT = ?
          WHERE PKKEY = ?
        `;
        queryParams = [newMediaName, categoryId, malaysiaTime, id];
      } else {
        updateQuery = `
          UPDATE followup_sub 
          SET CATEGORY_ID = ?, UPDATED_AT = ?
          WHERE PKKEY = ?
        `;
        queryParams = [categoryId, malaysiaTime, id];
      }
      
    } else if (entryType === 3) {
      // Video entry
      if (req.files && req.files.video && req.files.video[0]) {
        const videoFile = req.files.video[0];
        
        // Updated allowed video types - only MP4
        const allowedVideoTypes = ['video/mp4'];
        if (!allowedVideoTypes.includes(videoFile.mimetype)) {
          cleanupTempFile(videoFile.path);
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid file type. Only MP4 videos are allowed' 
          });
        }
        
        const fileBuffer = fs.readFileSync(videoFile.path);
        githubUploadResult = await updateFileInGitHub(videoFile.filename, fileBuffer, oldMediaName);
        
        cleanupTempFile(videoFile.path);
        newMediaName = videoFile.filename;
        
        updateQuery = `
          UPDATE followup_sub 
          SET MEDIANAME = ?, CATEGORY_ID = ?, UPDATED_AT = ?
          WHERE PKKEY = ?
        `;
        queryParams = [newMediaName, categoryId, malaysiaTime, id];
      } else {
        updateQuery = `
          UPDATE followup_sub 
          SET CATEGORY_ID = ?, UPDATED_AT = ?
          WHERE PKKEY = ?
        `;
        queryParams = [categoryId, malaysiaTime, id];
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid entry type' 
      });
    }

    const [updateResults] = await pool.execute(updateQuery, queryParams);

    if (updateResults.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }

    res.json({
      success: true,
      message: 'Entry updated successfully',
      newFilename: newMediaName,
      newGithubUrl: newMediaName ? getGitHubUrl(newMediaName) : null,
      fileUpdated: !!newMediaName,
      oldFileKept: oldMediaName ? `Old file ${oldMediaName} kept in repository` : null,
      githubUpload: githubUploadResult
    });

  } catch (err) {
    console.error('Database update error:', err);
    
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        cleanupTempFile(req.files.image[0].path);
      }
      if (req.files.video && req.files.video[0]) {
        cleanupTempFile(req.files.video[0].path);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to update entry'
    });
  }
});

// Delete content entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const selectQuery = `SELECT MEDIANAME FROM followup_sub WHERE PKKEY = ?`;
    const [results] = await pool.execute(selectQuery, [id]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }

    const deleteQuery = `DELETE FROM followup_sub WHERE PKKEY = ?`;
    const [deleteResults] = await pool.execute(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Entry deleted successfully',
      note: 'Media file kept in GitHub repository'
    });

  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete entry' 
    });
  }
});

// ===== MEDIA PROXY ENDPOINT =====
router.get('/media/:filename', async (req, res) => {
  const { filename } = req.params;
  
  console.log('🔍 Media request for:', filename);
  
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('❌ GITHUB_TOKEN not found');
      return res.status(500).json({
        success: false,
        message: 'GitHub authentication not configured'
      });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.webm': 'video/webm'
    };
    
    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }
    
    const isVideo = contentType.startsWith('video/');

    if (isVideo) {
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/master/public/media_followup/${filename}`;
      
      try {
        const videoResponse = await axios({
          method: 'GET',
          url: rawUrl,
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Railway-Video-Proxy',
            ...(req.headers.range && { 'Range': req.headers.range })
          },
          responseType: 'stream',
          timeout: 60000
        });

        if (videoResponse.headers['content-length']) {
          res.set('Content-Length', videoResponse.headers['content-length']);
        }
        if (videoResponse.headers['content-range']) {
          res.set('Content-Range', videoResponse.headers['content-range']);
        }
        if (videoResponse.headers['accept-ranges']) {
          res.set('Accept-Ranges', videoResponse.headers['accept-ranges']);
        }

        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff'
        });

        if (videoResponse.status === 206) {
          res.status(206);
        } else {
          res.status(200);
        }

        videoResponse.data.pipe(res);
        return;
        
      } catch (rawError) {
        console.error('❌ Raw URL failed:', rawError.message);
      }
    }

    // Fallback method: Use GitHub API
    const apiPath = `public/media_followup/${filename}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${apiPath}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Railway-Media-Proxy'
      },
      timeout: 30000
    });

    if (!response.data || !response.data.content) {
      throw new Error('No content in GitHub response');
    }

    const maxSafeSize = 25 * 1024 * 1024;
    if (response.data.size > maxSafeSize) {
      return res.status(413).json({
        success: false,
        message: `File too large (${Math.round(response.data.size / 1024 / 1024)}MB). Maximum supported: 25MB`,
        filename: filename
      });
    }

    let fileBuffer;
    try {
      fileBuffer = Buffer.from(response.data.content, 'base64');
    } catch (decodeError) {
      throw new Error('Failed to decode file content');
    }
    
    const fileSize = fileBuffer.length;
    
    if (isVideo && req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      if (start >= fileSize || end >= fileSize || start < 0 || end < start) {
        return res.status(416).send('Requested range not satisfiable');
      }
      
      const chunk = fileBuffer.slice(start, end + 1);
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      
      return res.send(chunk);
    }

    const responseHeaders = {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Cache-Control': 'public, max-age=3600',
      'ETag': response.data.sha,
      'Access-Control-Allow-Origin': '*'
    };
    
    if (isVideo) {
      responseHeaders['Accept-Ranges'] = 'bytes';
      responseHeaders['X-Content-Type-Options'] = 'nosniff';
    }
    
    res.set(responseHeaders);
    return res.send(fileBuffer);
    
  } catch (error) {
    console.error('❌ Media proxy error for', filename, ':', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: `Media file '${filename}' not found in GitHub repository`,
        filename: filename
      });
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'GitHub authentication failed - check GITHUB_TOKEN permissions',
        filename: filename
      });
    }
    
    return res.status(500).json({
      success: false,
      message: `Failed to load media file: ${error.message}`,
      filename: filename,
      error: error.response?.data?.message || error.message
    });
  }
});

// Debug endpoint to check GitHub integration
router.get('/github-debug', async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      return res.json({
        success: false,
        error: 'GITHUB_TOKEN not configured'
      });
    }
    
    const testUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
    
    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    res.json({
      success: true,
      message: 'GitHub integration working',
      repo: response.data.name,
      owner: response.data.owner.login,
      private: response.data.private,
      hasToken: !!token,
      config: GITHUB_CONFIG,
      sampleUrl: getGitHubUrl('example.jpg')
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    });
  }
});

module.exports = router;