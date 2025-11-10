const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config');

// ===== HELPER FUNCTIONS =====
// SHA1 encryption function
const sha1Hash = (password) => {
  return crypto.createHash('sha1').update(password).digest('hex');
};

// Function to remove all spaces from string (like PHP preg_replace('/\s+/', '', $str))
const removeAllSpaces = (str) => {
  return str.replace(/\s+/g, '');
};

// ===== USER MANAGEMENT ROUTES =====

// Get all users for User Control page
router.get('/', async (req, res) => {
  console.log('GET / - Fetching all users');
  
  const query = `
    SELECT PKKEY, USERCODE, NAME, TYPE, STATUS 
    FROM user 
    ORDER BY USERCODE
  `;

  try {
    const [results] = await pool.execute(query);

    console.log(`Found ${results.length} users`);
    res.json({
      success: true,
      users: results
    });

  } catch (err) {
    console.error('Database query error in GET /:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error: ' + err.message
    });
  }
});

// Add new user
router.post('/newusers', async (req, res) => {
  console.log('POST /newusers called');
  console.log('Request body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);
  
  // Check if request body exists
  if (!req.body) {
    console.error('No request body received');
    return res.status(400).json({
      success: false,
      message: 'No data received'
    });
  }
  
  const { usercode, name, password, type = 2, status = 1 } = req.body;
  
  console.log('Extracted values:', { usercode, name, password: password ? '[PROVIDED]' : '[MISSING]', type, status });

  // Validate required fields
  if (!usercode || !name || !password) {
    console.error('Missing required fields:', { 
      usercode: !!usercode, 
      name: !!name, 
      password: !!password 
    });
    return res.status(400).json({ 
      success: false, 
      message: 'User code, name, and password are required' 
    });
  }

  // Remove all spaces from usercode
  const cleanUsercode = removeAllSpaces(usercode);
  console.log('Clean usercode:', cleanUsercode);

  if (!cleanUsercode) {
    console.error('Usercode is empty after removing spaces');
    return res.status(400).json({ 
      success: false, 
      message: 'User code cannot be empty after removing spaces' 
    });
  }

  // Validate and set defaults for type and status
  const numericType = type ? parseInt(type) : 2;
  const numericStatus = status ? parseInt(status) : 1;
  
  if (![1, 2, 3].includes(numericType)) {
    console.error('Invalid user type:', type, 'parsed as:', numericType);
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid user type. Must be 1 (Administrator), 2 (User), or 3 (Other)' 
    });
  }

  console.log('Starting database operations...');

  try {
    // Check if usercode already exists
    const checkQuery = `SELECT PKKEY FROM user WHERE USERCODE = ?`;
    console.log('Executing check query:', checkQuery, 'with usercode:', cleanUsercode);

    const [checkResults] = await pool.execute(checkQuery, [cleanUsercode]);
    console.log('Check query results:', checkResults);

    if (checkResults.length > 0) {
      console.log('User code already exists');
      return res.status(400).json({ 
        success: false, 
        message: 'User code already exists' 
      });
    }

    // Hash the password
    let hashedPassword;
    try {
      hashedPassword = sha1Hash(password);
      console.log('Password hashed successfully');
    } catch (hashError) {
      console.error('Password hashing error:', hashError);
      return res.status(500).json({
        success: false,
        message: 'Password processing error'
      });
    }

    // Insert new user with cleaned usercode
    const insertQuery = `
      INSERT INTO user (USERCODE, NAME, PASSWORD, TYPE, STATUS) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const insertValues = [cleanUsercode, name, hashedPassword, numericType, numericStatus];
    console.log('Executing insert query:', insertQuery);
    console.log('Insert values:', [cleanUsercode, name, '[HASHED_PASSWORD]', numericType, numericStatus]);

    const [insertResults] = await pool.execute(insertQuery, insertValues);

    console.log('User created successfully:', insertResults);
    res.json({
      success: true,
      message: 'User created successfully',
      userId: insertResults.insertId
    });

  } catch (err) {
    console.error('Database error:', err);
    console.error('Error details:', {
      code: err.code,
      errno: err.errno,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Database error: ' + err.message
    });
  }
});

// Update user (edit)
router.put('/saveusers/:pkkey', async (req, res) => {
  console.log('PUT /saveusers/:pkkey called');
  console.log('PKKEY:', req.params.pkkey);
  console.log('Request body:', req.body);
  
  const { pkkey } = req.params;
  const { name, type, status } = req.body;

  if (!name) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name is required' 
    });
  }

  // Validate user type if provided
  if (type !== undefined && ![1, 2, 3].includes(parseInt(type))) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid user type. Must be 1 (Administrator), 2 (User), or 3 (Other)' 
    });
  }

  const updateQuery = `
    UPDATE user 
    SET NAME = ?, TYPE = ?, STATUS = ?
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(updateQuery, [name, parseInt(type), parseInt(status), pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('User updated successfully');
    res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user: ' + err.message
    });
  }
});

// API endpoint to get current user info (for session validation)
router.get('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('GET /:pkkey called with pkkey:', pkkey);

  const query = `
    SELECT PKKEY, USERCODE, NAME, TYPE, STATUS 
    FROM user 
    WHERE PKKEY = ? AND STATUS = 1
  `;

  try {
    const [results] = await pool.execute(query, [pkkey]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found or inactive' 
      });
    }

    const user = results[0];
    
    res.json({
      success: true,
      user: {
        pkkey: user.PKKEY,
        usercode: user.USERCODE,
        name: user.NAME,
        type: user.TYPE,
        status: user.STATUS
      }
    });

  } catch (err) {
    console.error('Database query error in GET /:pkkey:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error: ' + err.message
    });
  }
});

router.delete('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('DELETE /:pkkey called with pkkey:', pkkey);

  const deleteQuery = `DELETE FROM user WHERE PKKEY = ?`;

  try {
    const [results] = await pool.execute(deleteQuery, [pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('User deleted successfully');
    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user: ' + err.message
    });
  }
});

module.exports = router;