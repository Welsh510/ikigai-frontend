const express = require('express');
const router = express.Router();
const pool = require('../config'); // Updated to use pool

// ===== DOCTOR MANAGEMENT ROUTES =====

// Get all doctors for Doctor Management page
router.get('/', async (req, res) => {
  console.log('GET / - Fetching all doctors');
  
  const query = `
    SELECT pkkey, NAME, POSITION, phone 
    FROM doctor 
    ORDER BY NAME
  `;

  try {
    const [results] = await pool.execute(query);
    console.log(`Found ${results.length} doctors`);
    
    res.json({
      success: true,
      doctors: results
    });
  } catch (err) {
    console.error('Database query error in GET /:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error: ' + err.message
    });
  }
});

// Add new doctor
router.post('/newdoctor', async (req, res) => {
  console.log('POST /newdoctor called');
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
  
  const { name, position, phone } = req.body;
  
  console.log('Extracted values:', { name, position, phone });

  // Validate required fields
  if (!name) {
    console.error('Missing required fields:', { 
      name: !!name
    });
    return res.status(400).json({ 
      success: false, 
      message: 'Name is required' 
    });
  }
  
  console.log('Starting database operations...');

  try {
    // Check if phone number already exists (if phone is provided)
    if (phone && phone.trim() !== '') {
      const checkQuery = `SELECT pkkey FROM doctor WHERE phone = ?`;
      console.log('Executing check query:', checkQuery, 'with phone number:', phone);

      const [checkResults] = await pool.execute(checkQuery, [phone]);
      console.log('Check query results:', checkResults);

      if (checkResults.length > 0) {
        console.log('Phone number already exists');
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number already exists' 
        });
      }
    }

    // Insert new doctor
    const insertQuery = `
      INSERT INTO doctor (NAME, POSITION, phone) 
      VALUES (?, ?, ?)
    `;
    
    const insertValues = [
      name, 
      position || null, 
      phone || null
    ];
    
    console.log('Executing insert query:', insertQuery);
    console.log('Insert values:', insertValues);

    const [insertResults] = await pool.execute(insertQuery, insertValues);
    
    console.log('Doctor created successfully:', insertResults);
    res.json({
      success: true,
      message: 'Doctor created successfully',
      doctorId: insertResults.insertId
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

// Update doctor (edit)
router.put('/savedoctor/:pkkey', async (req, res) => {
  console.log('PUT /savedoctor/:pkkey called');
  console.log('PKKEY:', req.params.pkkey);
  console.log('Request body:', req.body);
  
  const { pkkey } = req.params;
  const { name, position, phone } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name is required' 
    });
  }

  try {
    // Check if phone number already exists for other doctors (if phone is provided)
    if (phone && phone.trim() !== '') {
      const checkQuery = `SELECT pkkey FROM doctor WHERE phone = ? AND pkkey != ?`;
      const [checkResults] = await pool.execute(checkQuery, [phone, pkkey]);

      if (checkResults.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number already exists for another doctor' 
        });
      }
    }

    // Update doctor
    const updateQuery = `
      UPDATE doctor 
      SET NAME = ?, POSITION = ?, phone = ?
      WHERE pkkey = ?
    `;

    const updateValues = [
      name,
      position || null,
      phone || null,
      pkkey
    ];

    const [updateResults] = await pool.execute(updateQuery, updateValues);

    if (updateResults.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    console.log('Doctor updated successfully');
    res.json({
      success: true,
      message: 'Doctor updated successfully'
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update doctor: ' + err.message
    });
  }
});

// API endpoint to get specific doctor info
router.get('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('GET /:pkkey called with pkkey:', pkkey);

  const query = `
    SELECT pkkey, NAME, POSITION, phone 
    FROM doctor 
    WHERE pkkey = ?
  `;

  try {
    const [results] = await pool.execute(query, [pkkey]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    const doctor = results[0];
    
    res.json({
      success: true,
      doctor: {
        pkkey: doctor.pkkey,
        name: doctor.NAME,
        position: doctor.POSITION,
        phone: doctor.phone
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

// Delete doctor (optional - if you want to add delete functionality)
router.delete('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('DELETE /:pkkey called with pkkey:', pkkey);

  const deleteQuery = `DELETE FROM doctor WHERE pkkey = ?`;

  try {
    const [results] = await pool.execute(deleteQuery, [pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    console.log('Doctor deleted successfully');
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });

  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete doctor: ' + err.message
    });
  }
});

module.exports = router;