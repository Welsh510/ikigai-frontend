const express = require('express');
const router = express.Router();
const pool = require('../config');

// Get SENSITIVE content by ID
router.get('/sensitive-content/:id', async (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT PKKEY, SENSITIVE_CONTENT, SENSITIVE_REPLY, APPOINTMENT_REPLY, HUMAN_SERVICE_REPLY, BIRTHDAY_GREETINGS, ATTACH_MEDIA_REPLY
    FROM chatbox_frame
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Sensitive content not found' 
      });
    }

    const content = results[0];
    
    res.json({
      success: true,
      content: {
        pkkey: content.PKKEY,
        sensitiveContent: content.SENSITIVE_CONTENT || '',
        sensitiveReply: content.SENSITIVE_REPLY || '',
        appointmentReply: content.APPOINTMENT_REPLY || '',
        humanServiceReply: content.HUMAN_SERVICE_REPLY || '',
        birthdayGreetings: content.BIRTHDAY_GREETINGS || '',
        attachMediaReply: content.ATTACH_MEDIA_REPLY || ''
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

// Update sensitive content
router.put('/sensitive-content/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    sensitiveContent, 
    sensitiveReply, 
    appointmentReply, 
    humanServiceReply, 
    birthdayGreetings,
    attachMediaReply
  } = req.body;

  const updateQuery = `
    UPDATE chatbox_frame 
    SET SENSITIVE_CONTENT = ?, 
        SENSITIVE_REPLY = ?, 
        APPOINTMENT_REPLY = ?, 
        HUMAN_SERVICE_REPLY = ?, 
        BIRTHDAY_GREETINGS = ?,
        ATTACH_MEDIA_REPLY = ?
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(updateQuery, [
      sensitiveContent, 
      sensitiveReply, 
      appointmentReply, 
      humanServiceReply, 
      birthdayGreetings,
      attachMediaReply,
      id
    ]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Sensitive content not found' 
      });
    }

    res.json({
      success: true,
      message: 'Sensitive content updated successfully'
    });

  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update Sensitive content' 
    });
  }
});

module.exports = router;