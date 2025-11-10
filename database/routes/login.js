const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config');

// ===== HELPER FUNCTIONS =====
// SHA1 encryption function
const sha1Hash = (password) => {
  return crypto.createHash('sha1').update(password).digest('hex');
};

// Generate random remember token
const generateRememberToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ===== AUTHENTICATION ROUTES =====

// Login API endpoint
router.post('/login', async (req, res) => {
  const { usercode, password, rememberMe = false } = req.body;

  if (!usercode || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required' 
    });
  }

  // Hash the password using SHA1
  const hashedPassword = sha1Hash(password);

  try {
    // Query to check user credentials
    const query = `
      SELECT PKKEY, USERCODE, NAME, TYPE, STATUS 
      FROM user 
      WHERE USERCODE = ? AND PASSWORD = ? AND STATUS = 1
    `;

    const [results] = await pool.execute(query, [usercode, hashedPassword]);

    if (results.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials or account inactive' 
      });
    }

    const user = results[0];
    let rememberToken = null;

    // If remember me is checked, generate and store token
    if (rememberMe) {
      rememberToken = generateRememberToken();
      
      const updateTokenQuery = `
        UPDATE user 
        SET REMEMBER_TOKEN = ? 
        WHERE PKKEY = ?
      `;

      try {
        await pool.execute(updateTokenQuery, [rememberToken, user.PKKEY]);
      } catch (updateErr) {
        console.error('Error updating remember token:', updateErr);
      }
    }
    
    // Return success with user data
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        pkkey: user.PKKEY,
        usercode: user.USERCODE,
        name: user.NAME,
        type: user.TYPE,
        status: user.STATUS
      },
      rememberToken: rememberToken
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Auto-login with remember token
router.post('/remember-login', async (req, res) => {
  const { rememberToken } = req.body;

  if (!rememberToken) {
    return res.status(400).json({ 
      success: false, 
      message: 'Remember token is required' 
    });
  }

  try {
    const query = `
      SELECT PKKEY, USERCODE, NAME, TYPE, STATUS 
      FROM user 
      WHERE REMEMBER_TOKEN = ? AND STATUS = 1
    `;

    const [results] = await pool.execute(query, [rememberToken]);

    if (results.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired remember token' 
      });
    }

    const user = results[0];
    
    res.json({
      success: true,
      message: 'Auto-login successful',
      user: {
        pkkey: user.PKKEY,
        usercode: user.USERCODE,
        name: user.NAME,
        type: user.TYPE,
        status: user.STATUS
      }
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Logout API endpoint (clears remember token)
router.post('/logout', async (req, res) => {
  const { pkkey } = req.body;

  if (!pkkey) {
    return res.status(400).json({ 
      success: false, 
      message: 'User ID is required' 
    });
  }

  try {
    const query = `
      UPDATE user 
      SET REMEMBER_TOKEN = NULL 
      WHERE PKKEY = ?
    `;

    await pool.execute(query, [pkkey]);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (err) {
    console.error('Error clearing remember token:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;