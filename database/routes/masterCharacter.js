const express = require('express');
const router = express.Router();
const pool = require('../config');

// Get chatbox frame content by PKKEY
router.get('/chatbox-frame/:pkkey', async (req, res) => {
  const { pkkey } = req.params;

  const query = `
    SELECT FRAME_CONTENT 
    FROM chatbox_frame 
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(query, [pkkey]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Frame content not found' 
      });
    }

    res.json({
      success: true,
      frameContent: results[0].FRAME_CONTENT
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update chatbox frame content by PKKEY
router.put('/chatbox-frame/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  const { frameContent } = req.body;

  if (frameContent === undefined || frameContent === null) {
    return res.status(400).json({ 
      success: false, 
      message: 'Frame content is required' 
    });
  }

  const updateQuery = `
    UPDATE chatbox_frame 
    SET FRAME_CONTENT = ?
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(updateQuery, [frameContent, pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Frame content not found' 
      });
    }

    res.json({
      success: true,
      message: 'Frame content updated successfully'
    });

  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update frame content' 
    });
  }
});

module.exports = router;