const express = require('express');
const router = express.Router();
const db = require('../config');
const { getMalaysiaDateString, formatMalaysiaDateTime } = require('./utils/dateUtils');

// ===== HELPER FUNCTIONS =====

const validateTime = (time) => {
  const timeRegexHHMM = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const timeRegexHHMMSS = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return timeRegexHHMM.test(time) || timeRegexHHMMSS.test(time);
};

const formatTimeToSQL = (time) => {
  if (!time) return null;
  if (time.length === 5) {
    return time + ':00';
  }
  return time;
};

const formatTimeForDisplay = (time) => {
  if (!time) return '';
  if (typeof time === 'string' && time.length >= 5) {
    return time.substring(0, 5);
  }
  return time;
};

const calculateEndTime = (startTime, durationMinutes = 30) => {
  if (!startTime) return null;
  
  const timeStr = formatTimeToSQL(startTime);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMins = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
};

const validateDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date) && !isNaN(Date.parse(date));
};

// ===== ROUTES =====

// Get all doctors
router.get('/doctors', async (req, res) => {
  try {
    console.log('🔍 Fetching doctors...');
    
    const query = `
      SELECT 
        pkkey as id, 
        NAME as name, 
        POSITION as position, 
        phone
      FROM doctor 
      ORDER BY NAME ASC
    `;
    
    const [results] = await db.execute(query);
    
    console.log(`✅ Found ${results.length} doctors`);
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
});

// Get all clients
router.get('/clients', async (req, res) => {
  try {
    console.log('🔍 Fetching clients...');
    
    const query = `
      SELECT 
        PKKEY as id, 
        NAME as name, 
        PHONENUMBER as phone, 
        EMAIL as email, 
        IC as ic
      FROM client 
      WHERE STATUS = 1
      ORDER BY NAME ASC
    `;
    
    const [results] = await db.execute(query);
    
    console.log(`✅ Found ${results.length} active clients`);
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('❌ Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
});

// Get appointments
router.get('/appointments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    
    console.log(`🔍 Fetching appointments for user ${userId}, month: ${month}, year: ${year}`);

    let query = `
	  SELECT 
		a.pkkey,
		a.client_id,
		a.doctor_id,
		a.user_id,
		DATE_FORMAT(a.appointment_date, '%Y-%m-%d') as appointment_date,
		a.appointment_time,
		a.start_time,
		a.end_time,
		a.duration_minutes,
		a.title,
		a.description,
		a.status,
		a.created_at,
		a.updated_at,
		c.NAME as client_name,
		c.PHONENUMBER as client_phone,
		c.EMAIL as client_email,
		c.IC as client_ic,
		d.NAME as doctor_name,
		d.POSITION as doctor_position,
		d.phone as doctor_phone
	  FROM appointments a
	  LEFT JOIN client c ON a.client_id = c.PKKEY
	  LEFT JOIN doctor d ON a.doctor_id = d.pkkey
	  WHERE a.user_id = ?
	`;
    
    let params = [userId];

    if (month && year) {
      query += ' AND MONTH(a.appointment_date) = ? AND YEAR(a.appointment_date) = ?';
      params.push(month, year);
    }

    query += ' ORDER BY a.appointment_date ASC, a.start_time ASC';

    const [results] = await db.execute(query, params);
    
    console.log(`✅ Found ${results.length} appointments`);
    
    // Group appointments by date
    const appointmentsByDate = {};
	results.forEach(appointment => {
	  // Use the formatted date string directly from MySQL
	  const dateKey = appointment.appointment_date;
	  
	  if (!appointmentsByDate[dateKey]) {
		appointmentsByDate[dateKey] = [];
	  }
	  
	  appointmentsByDate[dateKey].push({
		id: appointment.pkkey,
		title: appointment.title,
		description: appointment.description,
		time: appointment.start_time || appointment.appointment_time,
		start_time: appointment.start_time,
		end_time: appointment.end_time,
		duration_minutes: appointment.duration_minutes,
		status: appointment.status,
		client: {
		  id: appointment.client_id,
		  name: appointment.client_name,
		  phone: appointment.client_phone,
		  email: appointment.client_email,
		  ic: appointment.client_ic
		},
		doctor: {
		  id: appointment.doctor_id,
		  name: appointment.doctor_name,
		  position: appointment.doctor_position,
		  phone: appointment.doctor_phone
		},
		created_at: appointment.created_at,
		updated_at: appointment.updated_at
	  });
	});

    res.json({
      success: true,
      data: appointmentsByDate,
      count: results.length
    });

  } catch (error) {
    console.error('❌ Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
});

// Create appointment
router.post('/appointments', async (req, res) => {
  try {
    console.log('🔍 Creating appointment with data:', req.body);
    
    const {
      client_id,
      doctor_id,
      user_id,
      appointment_date,
      start_time,
      duration_minutes = 30,
      title,
      description
    } = req.body;

    // Validation
    if (!client_id || !doctor_id || !user_id || !appointment_date || !start_time || !title) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: client_id, doctor_id, user_id, appointment_date, start_time, title'
      });
    }

    if (!validateDate(appointment_date)) {
      console.log('❌ Invalid date format');
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (!validateTime(start_time)) {
      console.log('❌ Invalid time format');
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM (24-hour format)'
      });
    }

    const formattedStartTime = formatTimeToSQL(start_time);
    const formattedEndTime = calculateEndTime(formattedStartTime, duration_minutes);

    console.log(`✅ Formatted times - Start: ${formattedStartTime}, End: ${formattedEndTime}`);

    // Verify client exists
    const [clientCheck] = await db.execute(
      'SELECT PKKEY FROM client WHERE PKKEY = ? AND STATUS = 1', 
      [client_id]
    );
    if (clientCheck.length === 0) {
      console.log('❌ Client not found');
      return res.status(404).json({
        success: false,
        message: 'Client not found or inactive'
      });
    }

    // Verify doctor exists
    const [doctorCheck] = await db.execute(
      'SELECT pkkey FROM doctor WHERE pkkey = ?', 
      [doctor_id]
    );
    if (doctorCheck.length === 0) {
      console.log('❌ Doctor not found');
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('✅ Client and doctor verified');

    // Debug information
    console.log('🔍 Checking conflicts for:', {
      client_id,
      doctor_id,
      appointment_date,
      formattedStartTime,
      formattedEndTime,
      duration_minutes
    });

    // Check for client time conflict (same client, same date, overlapping time)
    console.log('🔍 Checking client conflicts...');
    const [clientConflict] = await db.execute(`
      SELECT a.pkkey, a.title, a.start_time, a.end_time, c.NAME as client_name
      FROM appointments a
      LEFT JOIN client c ON a.client_id = c.PKKEY
      WHERE a.client_id = ? 
        AND a.appointment_date = ? 
        AND NOT (a.end_time <= ? OR a.start_time >= ?)
    `, [
      client_id, 
      appointment_date, 
      formattedStartTime,  // existing appointment ends before new one starts
      formattedEndTime     // existing appointment starts after new one ends
    ]);

    console.log('🔍 Client conflict query result:', clientConflict);

    if (clientConflict.length > 0) {
      console.log('❌ Client time conflict detected:', clientConflict[0]);
      return res.status(409).json({
        success: false,
        message: `Client "${clientConflict[0].client_name}" already has an appointment at ${formatTimeForDisplay(clientConflict[0].start_time)} on this date. Please choose a different time.`
      });
    }

    // Check for doctor time conflict (same doctor, same date, overlapping time)
    console.log('🔍 Checking doctor conflicts...');
    const [doctorConflict] = await db.execute(`
      SELECT a.pkkey, a.title, a.start_time, a.end_time, d.NAME as doctor_name
      FROM appointments a
      LEFT JOIN doctor d ON a.doctor_id = d.pkkey
      WHERE a.doctor_id = ? 
        AND a.appointment_date = ? 
        AND NOT (a.end_time <= ? OR a.start_time >= ?)
    `, [
      doctor_id, 
      appointment_date, 
      formattedStartTime,  // existing appointment ends before new one starts
      formattedEndTime     // existing appointment starts after new one ends
    ]);

    console.log('🔍 Doctor conflict query result:', doctorConflict);

    if (doctorConflict.length > 0) {
      console.log('❌ Doctor time conflict detected:', doctorConflict[0]);
      return res.status(409).json({
        success: false,
        message: `Doctor "${doctorConflict[0].doctor_name}" already has an appointment at ${formatTimeForDisplay(doctorConflict[0].start_time)} on this date. Please choose a different time.`
      });
    }

    console.log('✅ No scheduling conflicts detected');

    // Insert appointment
    const insertQuery = `
	  INSERT INTO appointments (
		client_id, 
		doctor_id, 
		user_id, 
		appointment_date, 
		appointment_time,
		start_time, 
		end_time, 
		duration_minutes, 
		title, 
		description, 
		status,
		created_at,
		updated_at
	  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
	`;
    
	const malaysiaTime = getMalaysiaDateString();
	
    const [result] = await db.execute(insertQuery, [
	  client_id,
	  doctor_id,
	  user_id,
	  appointment_date,
	  formattedStartTime,
	  formattedStartTime,
	  formattedEndTime,
	  duration_minutes,
	  title,
	  description || null,
	  malaysiaTime, // created_at
	  malaysiaTime  // updated_at
	]);

    console.log(`✅ Appointment created with ID: ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: {
        id: result.insertId,
        title: title,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        duration_minutes: duration_minutes,
        date: appointment_date,
        status: 'scheduled'
      }
    });

  } catch (error) {
    console.error('❌ Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
});

// Update appointment (NEW ROUTE)
router.put('/appointments/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    console.log('🔍 Updating appointment with ID:', appointmentId);
    console.log('🔍 Update data:', req.body);
    
    const {
      client_id,
      doctor_id,
      appointment_date,
      start_time,
      duration_minutes = 30,
      title,
      description
    } = req.body;

    // Validation
    if (!client_id || !doctor_id || !appointment_date || !start_time || !title) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: client_id, doctor_id, appointment_date, start_time, title'
      });
    }

    if (!validateDate(appointment_date)) {
      console.log('❌ Invalid date format');
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (!validateTime(start_time)) {
      console.log('❌ Invalid time format');
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM (24-hour format)'
      });
    }

    // Check if appointment exists
    const [existingAppointment] = await db.execute(
      'SELECT * FROM appointments WHERE pkkey = ?',
      [appointmentId]
    );

    if (existingAppointment.length === 0) {
      console.log('❌ Appointment not found');
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const formattedStartTime = formatTimeToSQL(start_time);
    const formattedEndTime = calculateEndTime(formattedStartTime, duration_minutes);

    console.log(`✅ Formatted times - Start: ${formattedStartTime}, End: ${formattedEndTime}`);

    // Verify client exists
    const [clientCheck] = await db.execute(
      'SELECT PKKEY FROM client WHERE PKKEY = ? AND STATUS = 1', 
      [client_id]
    );
    if (clientCheck.length === 0) {
      console.log('❌ Client not found');
      return res.status(404).json({
        success: false,
        message: 'Client not found or inactive'
      });
    }

    // Verify doctor exists
    const [doctorCheck] = await db.execute(
      'SELECT pkkey FROM doctor WHERE pkkey = ?', 
      [doctor_id]
    );
    if (doctorCheck.length === 0) {
      console.log('❌ Doctor not found');
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('✅ Client and doctor verified');

    // Debug information
    console.log('🔍 Checking conflicts for UPDATE:', {
      appointmentId,
      client_id,
      doctor_id,
      appointment_date,
      formattedStartTime,
      formattedEndTime,
      duration_minutes
    });

    // Check for client time conflict (same client, same date, overlapping time) - exclude current appointment
    console.log('🔍 Checking client conflicts for update...');
    const [clientConflict] = await db.execute(`
      SELECT a.pkkey, a.title, a.start_time, a.end_time, c.NAME as client_name
      FROM appointments a
      LEFT JOIN client c ON a.client_id = c.PKKEY
      WHERE a.client_id = ? 
        AND a.appointment_date = ? 
        AND a.pkkey != ?
        AND NOT (a.end_time <= ? OR a.start_time >= ?)
    `, [
      client_id, 
      appointment_date, 
      appointmentId,
      formattedStartTime,  // existing appointment ends before new one starts
      formattedEndTime     // existing appointment starts after new one ends
    ]);

    console.log('🔍 Client conflict query result for update:', clientConflict);

    if (clientConflict.length > 0) {
      console.log('❌ Client time conflict detected:', clientConflict[0]);
      return res.status(409).json({
        success: false,
        message: `Client "${clientConflict[0].client_name}" already has an appointment at ${formatTimeForDisplay(clientConflict[0].start_time)} on this date. Please choose a different time.`
      });
    }

    // Check for doctor time conflict (same doctor, same date, overlapping time) - exclude current appointment
    console.log('🔍 Checking doctor conflicts for update...');
    const [doctorConflict] = await db.execute(`
      SELECT a.pkkey, a.title, a.start_time, a.end_time, d.NAME as doctor_name
      FROM appointments a
      LEFT JOIN doctor d ON a.doctor_id = d.pkkey
      WHERE a.doctor_id = ? 
        AND a.appointment_date = ? 
        AND a.pkkey != ?
        AND NOT (a.end_time <= ? OR a.start_time >= ?)
    `, [
      doctor_id, 
      appointment_date, 
      appointmentId,
      formattedStartTime,  // existing appointment ends before new one starts
      formattedEndTime     // existing appointment starts after new one ends
    ]);

    console.log('🔍 Doctor conflict query result for update:', doctorConflict);

    if (doctorConflict.length > 0) {
      console.log('❌ Doctor time conflict detected:', doctorConflict[0]);
      return res.status(409).json({
        success: false,
        message: `Doctor "${doctorConflict[0].doctor_name}" already has an appointment at ${formatTimeForDisplay(doctorConflict[0].start_time)} on this date. Please choose a different time.`
      });
    }

    console.log('✅ No scheduling conflicts detected');

    // Update appointment
    const updateQuery = `
	  UPDATE appointments SET
		client_id = ?, 
		doctor_id = ?, 
		appointment_date = ?, 
		appointment_time = ?,
		start_time = ?, 
		end_time = ?, 
		duration_minutes = ?, 
		title = ?, 
		description = ?,
		updated_at = ?
	  WHERE pkkey = ?
	`;
    
	const malaysiaTime = getMalaysiaDateString();
	
    const [result] = await db.execute(updateQuery, [
	  client_id,
	  doctor_id,
	  appointment_date,
	  formattedStartTime,
	  formattedStartTime,
	  formattedEndTime,
	  duration_minutes,
	  title,
	  description || null,
	  malaysiaTime, // updated_at
	  appointmentId
	]);

    if (result.affectedRows === 0) {
      console.log('❌ No rows affected during update');
      return res.status(400).json({
        success: false,
        message: 'Failed to update appointment'
      });
    }

    console.log(`✅ Appointment updated with ID: ${appointmentId}`);

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: {
        id: appointmentId,
        title: title,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        duration_minutes: duration_minutes,
        date: appointment_date,
        status: existingAppointment[0].status
      }
    });

  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
});

// Get available slots
router.get('/available-slots/:doctorId/:date', async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    
    console.log(`🔍 Getting available slots for doctor ${doctorId} on ${date}`);

    if (!validateDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Verify doctor exists
    const [doctorCheck] = await db.execute(
      'SELECT pkkey, NAME FROM doctor WHERE pkkey = ?', 
      [doctorId]
    );
    if (doctorCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get booked slots (since we delete appointments, no need to check for cancelled status)
    const [bookedSlots] = await db.execute(`
      SELECT start_time, end_time, title 
      FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ?
      ORDER BY start_time ASC
    `, [doctorId, date]);

    // Generate available slots (9 AM to 6 PM, 30-minute intervals)
    const allSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        allSlots.push(timeString);
      }
    }

    // Filter out booked slots
    const availableSlots = allSlots.filter(slot => {
      const slotTime = slot + ':00';
      return !bookedSlots.some(booked => {
        return slotTime >= booked.start_time && slotTime < booked.end_time;
      });
    });

    console.log(`✅ Found ${availableSlots.length} available slots`);

    res.json({
      success: true,
      data: {
        date: date,
        doctorId: doctorId,
        doctorName: doctorCheck[0].NAME,
        availableSlots: availableSlots,
        bookedSlots: bookedSlots.map(slot => ({
          start_time: formatTimeForDisplay(slot.start_time),
          end_time: formatTimeForDisplay(slot.end_time),
          title: slot.title
        })),
        totalAvailable: availableSlots.length,
        totalBooked: bookedSlots.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching available slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots',
      error: error.message
    });
  }
});

// Get statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (month && year) {
      whereClause += ' AND MONTH(appointment_date) = ? AND YEAR(appointment_date) = ?';
      params.push(month, year);
    }

    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show
      FROM appointments 
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('❌ Error fetching appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statistics',
      error: error.message
    });
  }
});

// Delete appointment
router.delete('/appointments/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    console.log('🔍 Deleting appointment with ID:', appointmentId);

    const [existingAppointment] = await db.execute(
      'SELECT * FROM appointments WHERE pkkey = ?',
      [appointmentId]
    );

    if (existingAppointment.length === 0) {
      console.log('❌ Appointment not found');
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Actually delete the appointment from database
    const [result] = await db.execute(
      'DELETE FROM appointments WHERE pkkey = ?',
      [appointmentId]
    );

    if (result.affectedRows === 0) {
      console.log('❌ Failed to delete appointment');
      return res.status(400).json({
        success: false,
        message: 'Failed to delete appointment'
      });
    }

    console.log(`✅ Appointment deleted successfully with ID: ${appointmentId}`);

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message
    });
  }
});

module.exports = router;