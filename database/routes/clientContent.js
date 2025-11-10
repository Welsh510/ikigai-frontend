const express = require('express');
const router = express.Router();
const pool = require('../config'); // Updated to use pool

// ===== CLIENT MANAGEMENT ROUTES =====

// Get all clients for Client Management page
router.get('/', async (req, res) => {
  console.log('GET / - Fetching all clients');
  
  const query = `
    SELECT PKKEY, NAME, IC, DOB, PHONENUMBER, EMAIL, STATUS 
    FROM client 
    ORDER BY NAME
  `;

  try {
    const [results] = await pool.execute(query);
    console.log(`Found ${results.length} clients`);
    
    res.json({
      success: true,
      clients: results
    });
  } catch (err) {
    console.error('Database query error in GET /:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error: ' + err.message
    });
  }
});

// Add new client
router.post('/newclient', async (req, res) => {
  console.log('POST /newclient called');
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
  
  const { name, ic, dob, phonenumber, email, status = 1 } = req.body;
  
  console.log('Extracted values:', { name, ic, dob, phonenumber, email, status });

  // Validate required fields
  if (!name || !phonenumber) {
    console.error('Missing required fields:', { 
      name: !!name, 
      phonenumber: !!phonenumber 
    });
    return res.status(400).json({ 
      success: false, 
      message: 'Name and Phone Number are required' 
    });
  }

  // Format DOB to MySQL date format (YYYY-MM-DD) if provided
  let formattedDob = null;
  if (dob && dob.trim() !== '') {
    // If dob is already in YYYY-MM-DD format (from date input), use it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      formattedDob = dob;
    } else {
      // Otherwise, try to parse and format it
      const dobDate = new Date(dob);
      if (!isNaN(dobDate.getTime())) {
        formattedDob = dobDate.toISOString().split('T')[0];
      }
    }
  }

  // Validate and set defaults for status
  const numericStatus = status ? parseInt(status) : 1;
  
  console.log('Starting database operations...');

  try {
    // Check if phone number already exists
    const checkQuery = `SELECT PKKEY FROM client WHERE PHONENUMBER = ?`;
    console.log('Executing check query:', checkQuery, 'with phone number:', phonenumber);

    const [checkResults] = await pool.execute(checkQuery, [phonenumber]);
    console.log('Check query results:', checkResults);

    if (checkResults.length > 0) {
      console.log('Phone number already exists');
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already exists' 
      });
    }

    // Insert new client
    const insertQuery = `
      INSERT INTO client (NAME, IC, DOB, PHONENUMBER, EMAIL, STATUS) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const insertValues = [
      name, 
      ic || null, 
      formattedDob, 
      phonenumber, 
      email || null, 
      numericStatus
    ];
    
    console.log('Executing insert query:', insertQuery);
    console.log('Insert values:', insertValues);

    const [insertResults] = await pool.execute(insertQuery, insertValues);
    
    console.log('Client created successfully:', insertResults);
    res.json({
      success: true,
      message: 'Client created successfully',
      clientId: insertResults.insertId
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

// Update client (edit)
router.put('/saveclient/:pkkey', async (req, res) => {
  console.log('PUT /saveclient/:pkkey called');
  console.log('PKKEY:', req.params.pkkey);
  console.log('Request body:', req.body);
  
  const { pkkey } = req.params;
  const { name, ic, dob, phonenumber, email, status } = req.body;

  // Validate required fields
  if (!name || !phonenumber) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name and Phone Number are required' 
    });
  }

  // Format DOB to MySQL date format (YYYY-MM-DD) if provided
  let formattedDob = null;
  if (dob && dob.trim() !== '') {
    // If dob is already in YYYY-MM-DD format (from date input), use it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      formattedDob = dob;
    } else {
      // Otherwise, try to parse and format it
      const dobDate = new Date(dob);
      if (!isNaN(dobDate.getTime())) {
        formattedDob = dobDate.toISOString().split('T')[0];
      }
    }
  }

  try {
    // Check if phone number already exists for other clients
    const checkQuery = `SELECT PKKEY FROM client WHERE PHONENUMBER = ? AND PKKEY != ?`;
    const [checkResults] = await pool.execute(checkQuery, [phonenumber, pkkey]);

    if (checkResults.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already exists for another client' 
      });
    }

    // Update client
    const updateQuery = `
      UPDATE client 
      SET NAME = ?, IC = ?, DOB = ?, PHONENUMBER = ?, EMAIL = ?, STATUS = ?
      WHERE PKKEY = ?
    `;

    const updateValues = [
      name,
      ic || null,
      formattedDob,
      phonenumber,
      email || null,
      parseInt(status),
      pkkey
    ];

    const [updateResults] = await pool.execute(updateQuery, updateValues);

    if (updateResults.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    console.log('Client updated successfully');
    res.json({
      success: true,
      message: 'Client updated successfully'
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update client: ' + err.message
    });
  }
});

// API endpoint to get specific client info
router.get('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('GET /:pkkey called with pkkey:', pkkey);

  const query = `
    SELECT PKKEY, NAME, IC, DOB, PHONENUMBER, EMAIL, STATUS 
    FROM client 
    WHERE PKKEY = ?
  `;

  try {
    const [results] = await pool.execute(query, [pkkey]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    const client = results[0];
    
    res.json({
      success: true,
      client: {
        pkkey: client.PKKEY,
        name: client.NAME,
        ic: client.IC,
        dob: client.DOB,
        phonenumber: client.PHONENUMBER,
        email: client.EMAIL,
        status: client.STATUS
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

// Delete client (optional - if you want to add delete functionality)
router.delete('/:pkkey', async (req, res) => {
  const { pkkey } = req.params;
  console.log('DELETE /:pkkey called with pkkey:', pkkey);

  const deleteQuery = `DELETE FROM client WHERE PKKEY = ?`;

  try {
    const [results] = await pool.execute(deleteQuery, [pkkey]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    console.log('Client deleted successfully');
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete client: ' + err.message
    });
  }
});

module.exports = router;