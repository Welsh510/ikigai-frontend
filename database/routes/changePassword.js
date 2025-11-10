const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config');

// ===== HELPER FUNCTIONS =====
// SHA1 encryption function
const sha1Hash = (password) => {
  return crypto.createHash('sha1').update(password).digest('hex');
};

// ===== AUTHENTICATION ROUTES =====

// Change Password API endpoint
router.post('/changepassword', async (req, res) => {
  const { pkkey, currentPassword, newPassword } = req.body;

  if (!pkkey || !currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'User ID, current password, and new password are required' 
    });
  }

  // Validate new password length
  if (newPassword.length < 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be at least 3 characters long' 
    });
  }

  // Hash the current password to verify
  const hashedCurrentPassword = sha1Hash(currentPassword);

  try {
    // First, verify the current password
    const verifyQuery = `
      SELECT PKKEY FROM user 
      WHERE PKKEY = ? AND PASSWORD = ? AND STATUS = 1
    `;

    const [verifyResults] = await pool.execute(verifyQuery, [pkkey, hashedCurrentPassword]);

    if (verifyResults.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash the new password
    const hashedNewPassword = sha1Hash(newPassword);

    // Update the password and clear remember token for security
    const updateQuery = `
      UPDATE user 
      SET PASSWORD = ?, REMEMBER_TOKEN = NULL 
      WHERE PKKEY = ? AND STATUS = 1
    `;

    const [updateResults] = await pool.execute(updateQuery, [hashedNewPassword, pkkey]);

    if (updateResults.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found or inactive' 
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;