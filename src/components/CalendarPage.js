import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/CalendarPage.css';

const CalendarPage = () => {
  // State management
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState({});
  const [clients, setClients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    description: '',
    start_time: '',
    duration_minutes: 30,
    client_id: '',
    doctor_id: '',
    appointment_date: ''
  });
  const [viewMode, setViewMode] = useState('month');
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);

  // Initialize component
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      loadAppointments(parsedUser.pkkey);
      loadClients();
      loadDoctors();
    }
  }, []);

  // Reload appointments when date changes
  useEffect(() => {
    if (user) {
      loadAppointments(user.pkkey);
    }
  }, [currentDate, user]);

  // Data loading functions
  const loadAppointments = async (userKey) => {
    try {
      setLoading(true);
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      const response = await fetch(`/api/calendarContent/appointments/${userKey}?month=${month}&year=${year}`);
      const data = await response.json();
      
      if (data.success) {
        setAppointments(data.data);
      } else {
        console.error('Failed to load appointments:', data.message);
        showNotification('Failed to load appointments', 'error');
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
      showNotification('Error loading appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/calendarContent/clients');
      const data = await response.json();
      
      if (data.success) {
        setClients(data.data);
      } else {
        console.error('Failed to load clients:', data.message);
        showNotification('Failed to load clients', 'error');
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      showNotification('Error loading clients', 'error');
    }
  };

  const loadDoctors = async () => {
    try {
      const response = await fetch('/api/calendarContent/doctors');
      const data = await response.json();
      
      if (data.success) {
        setDoctors(data.data);
      } else {
        console.error('Failed to load doctors:', data.message);
        showNotification('Failed to load doctors', 'error');
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      showNotification('Error loading doctors', 'error');
    }
  };
  
	const formatDateToString = (date) => {
	  const year = date.getFullYear();
	  const month = String(date.getMonth() + 1).padStart(2, '0');
	  const day = String(date.getDate()).padStart(2, '0');
	  return `${year}-${month}-${day}`;
	};

	const loadAvailableSlots = async (date, doctorId) => {
	  if (!doctorId) {
		setAvailableSlots([]);
		return;
	  }
	  
	  try {
		// Use local timezone formatting instead of toISOString()
		const dateString = formatDateToString(date);
		const response = await fetch(`/api/calendarContent/available-slots/${doctorId}/${dateString}`);
		const data = await response.json();
		
		if (data.success) {
		  setAvailableSlots(data.data.availableSlots);
		} else {
		  console.error('Failed to load available slots:', data.message);
		  setAvailableSlots([]);
		}
	  } catch (error) {
		console.error('Error loading available slots:', error);
		setAvailableSlots([]);
	  }
	};

  // Utility functions
  const showNotification = (message, type = 'info') => {
    // Simple alert for now - can be replaced with a proper notification system
    if (type === 'error') {
      alert(`Error: ${message}`);
    } else {
      console.log(`${type}: ${message}`);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

	const formatDateKey = (date) => {
	  // Ensure we're working with local timezone - no UTC conversion
	  const year = date.getFullYear();
	  const month = String(date.getMonth() + 1).padStart(2, '0');
	  const day = String(date.getDate()).padStart(2, '0');
	  return `${year}-${month}-${day}`;
	};

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day) => {
    if (!day) return false;
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasAppointments = (day) => {
    if (!day) return false;
    const dateKey = formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    return appointments[dateKey] && appointments[dateKey].length > 0;
  };

  const formatTimeDisplay = (timeString) => {
    if (!timeString) return '';
    if (typeof timeString === 'string' && timeString.length >= 5) {
      return timeString.substring(0, 5);
    }
    return timeString;
  };

  const formatTimeRange = (startTime, endTime) => {
    const start = formatTimeDisplay(startTime);
    const end = formatTimeDisplay(endTime);
    return end ? `${start} - ${end}` : start;
  };

  const getDurationText = (minutes) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Event handlers
  const handleDateClick = (day) => {
    if (!day) return;
    const newSelectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(newSelectedDate);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddAppointment = () => {
    const dateString = formatDateKey(selectedDate);
    setNewAppointment({
      title: '',
      description: '',
      start_time: '',
      duration_minutes: 30,
      client_id: '',
      doctor_id: '',
      appointment_date: dateString
    });
    setAvailableSlots([]);
    setShowAppointmentModal(true);
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setNewAppointment({
      title: appointment.title,
      description: appointment.description || '',
      start_time: appointment.start_time ? formatTimeDisplay(appointment.start_time) : '',
      duration_minutes: appointment.duration_minutes || 30,
      client_id: appointment.client.id,
      doctor_id: appointment.doctor ? appointment.doctor.id : '',
      appointment_date: formatDateKey(selectedDate)
    });
    
    if (appointment.doctor && appointment.doctor.id) {
      loadAvailableSlots(selectedDate, appointment.doctor.id);
    }
    setShowEditModal(true);
  };

	const handleDoctorChange = (doctorId) => {
	  // Don't reset start_time when editing
	  if (showEditModal) {
		setNewAppointment({...newAppointment, doctor_id: doctorId});
	  } else {
		setNewAppointment({...newAppointment, doctor_id: doctorId, start_time: ''});
	  }
	  
	  if (doctorId) {
		// Parse the date string properly without timezone conversion
		const dateParts = newAppointment.appointment_date.split('-');
		const year = parseInt(dateParts[0]);
		const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
		const day = parseInt(dateParts[2]);
		const appointmentDate = new Date(year, month, day);
		loadAvailableSlots(appointmentDate, doctorId);
	  } else {
		setAvailableSlots([]);
	  }
	};

	const handleDateChange = (dateString) => {
	  // Don't reset start_time when editing
	  if (showEditModal) {
		setNewAppointment({...newAppointment, appointment_date: dateString});
	  } else {
		setNewAppointment({...newAppointment, appointment_date: dateString, start_time: ''});
	  }
	  
	  if (newAppointment.doctor_id) {
		// Parse the date string properly without timezone conversion
		const dateParts = dateString.split('-');
		const year = parseInt(dateParts[0]);
		const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
		const day = parseInt(dateParts[2]);
		const appointmentDate = new Date(year, month, day);
		loadAvailableSlots(appointmentDate, newAppointment.doctor_id);
	  }
	};

  const handleSaveAppointment = async () => {
    // Validation
    if (!newAppointment.title.trim()) {
      showNotification('Please enter an appointment title', 'error');
      return;
    }
    if (!newAppointment.client_id) {
      showNotification('Please select a client', 'error');
      return;
    }
    if (!newAppointment.doctor_id) {
      showNotification('Please select a doctor', 'error');
      return;
    }
    if (!newAppointment.start_time) {
      showNotification('Please select a start time', 'error');
      return;
    }

    try {
      setLoading(true);
      const appointmentData = {
        ...newAppointment,
        user_id: user.pkkey
      };

      const response = await fetch('/api/calendarContent/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });

      const data = await response.json();

      if (data.success) {
        await loadAppointments(user.pkkey);
        resetAppointmentForm();
        setShowAppointmentModal(false);
        showNotification('Appointment created successfully', 'success');
      } else {
        // Handle conflict errors specifically
        if (response.status === 409) {
          showNotification(data.message, 'error');
        } else {
          showNotification(data.message || 'Failed to create appointment', 'error');
        }
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      showNotification('Failed to create appointment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppointment = async () => {
    // Validation
    if (!newAppointment.title.trim()) {
      showNotification('Please enter an appointment title', 'error');
      return;
    }
    if (!newAppointment.client_id) {
      showNotification('Please select a client', 'error');
      return;
    }
    if (!newAppointment.doctor_id) {
      showNotification('Please select a doctor', 'error');
      return;
    }
    if (!newAppointment.start_time) {
      showNotification('Please select a start time', 'error');
      return;
    }

    try {
      setLoading(true);
      const updateData = {
        title: newAppointment.title,
        description: newAppointment.description,
        client_id: newAppointment.client_id,
        doctor_id: newAppointment.doctor_id,
        start_time: newAppointment.start_time,
        duration_minutes: newAppointment.duration_minutes,
        appointment_date: newAppointment.appointment_date
      };

      const response = await fetch(`/api/calendarContent/appointments/${editingAppointment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        await loadAppointments(user.pkkey);
        setShowEditModal(false);
        setEditingAppointment(null);
        showNotification('Appointment updated successfully', 'success');
      } else {
        // Handle conflict errors specifically
        if (response.status === 409) {
          showNotification(data.message, 'error');
        } else {
          showNotification(data.message || 'Failed to update appointment', 'error');
        }
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      showNotification('Failed to update appointment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/calendarContent/appointments/${appointmentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await loadAppointments(user.pkkey);
        showNotification('Appointment deleted successfully', 'success');
      } else {
        showNotification(data.message || 'Failed to delete appointment', 'error');
      }
    } catch (error) {
      console.error('Error deleting appointment:', error);
      showNotification('Failed to delete appointment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetAppointmentForm = () => {
    setNewAppointment({
      title: '',
      description: '',
      start_time: '',
      duration_minutes: 30,
      client_id: '',
      doctor_id: '',
      appointment_date: ''
    });
    setAvailableSlots([]);
  };

  const getSelectedDateAppointments = () => {
    const dateKey = formatDateKey(selectedDate);
    return appointments[dateKey] || [];
  };

  // Constants
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const durationOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 45, label: '45 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' }
  ];

  if (!user) return null;

  return (
    <Layout>
      <div className="calendar-page">
        {/* Header */}
        <div className="calendar-header">
          <h1 className="calendar-title">Appointment Calendar</h1>
          <div className="calendar-controls">
			{/*
            <div className="view-mode-selector">
              <button 
                className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
            </div>
			*/}
            <button className="add-event-btn" onClick={handleAddAppointment}>
              + Add Appointment
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="calendar-content">
          <div className="calendar-main">
            <div className="calendar-navigation">
              <button className="nav-btn" onClick={handlePrevMonth}>
                &#8249;
              </button>
              <h2 className="current-month">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button className="nav-btn" onClick={handleNextMonth}>
                &#8250;
              </button>
            </div>

            <div className="calendar-grid">
              <div className="calendar-days-header">
                {dayNames.map(day => (
                  <div key={day} className="day-header">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-days">
                {getDaysInMonth(currentDate).map((day, index) => (
                  <div
                    key={index}
                    className={`calendar-day ${
                      day ? 'has-day' : 'empty-day'
                    } ${
                      isToday(day) ? 'today' : ''
                    } ${
                      isSelected(day) ? 'selected' : ''
                    } ${
                      hasAppointments(day) ? 'has-events' : ''
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    {day && (
                      <>
                        <span className="day-number">{day}</span>
                        {hasAppointments(day) && (
                          <div className="event-indicators">
                            {appointments[formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))]
                              .slice(0, 3).map((appointment, i) => (
                              <div key={i} className="event-dot appointment"></div>
                            ))}
                            {appointments[formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))].length > 3 && (
                              <div className="event-more">+{appointments[formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))].length - 3}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="calendar-sidebar">
            <div className="selected-date-info">
              <h3 className="calendar-sidebar-title">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
            </div>

            <div className="events-list">
              <h4 className="events-title">Appointments ({getSelectedDateAppointments().length})</h4>
              {loading ? (
                <p className="loading">Loading...</p>
              ) : getSelectedDateAppointments().length === 0 ? (
                <p className="no-events">No appointments scheduled</p>
              ) : (
                <div className="events">
                  {getSelectedDateAppointments().map(appointment => (
                    <div key={appointment.id} className="event-item appointment">
                      <div className="event-header">
                        <h5 className="event-title">{appointment.title}</h5>
                        <div className="appointment-controls">
                          <button 
                            className="edit-appointment-btn"
                            onClick={() => handleEditAppointment(appointment)}
                            title="Edit appointment"
                          >
                            ✏️
                          </button>
                          <button 
                            className="delete-event-btn"
                            onClick={() => handleDeleteAppointment(appointment.id)}
                            title="Delete appointment"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      <p className="event-time">
                        {formatTimeRange(appointment.start_time || appointment.time, appointment.end_time)}
                        {appointment.duration_minutes && (
                          <span className="duration"> ({getDurationText(appointment.duration_minutes)})</span>
                        )}
                      </p>
                      
                      <div className="client-info">
                        <p className="client-name">
                          <strong>Client:</strong> {appointment.client.name}
                        </p>
                        <p className="client-phone">
                          <strong>Phone:</strong> {appointment.client.phone}
                        </p>
                      </div>
                      
                      {appointment.doctor && (
                        <div className="doctor-info">
                          <p className="doctor-name">
                            <strong>Doctor:</strong> {appointment.doctor.name}
                          </p>
                          {appointment.doctor.position && (
                            <p className="doctor-position">
                              <strong>Position:</strong> {appointment.doctor.position}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {appointment.description && (
                        <p className="event-description">{appointment.description}</p>
                      )}
                      {/*
                      <div className="appointment-status">
                        <span className={`status-badge ${appointment.status}`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                      </div>
					  */}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Appointment Modal */}
        {showAppointmentModal && (
          <div className="modal-overlay">
            <div className="event-modal">
              <div className="modal-header">
                <h3>Add New Appointment</h3>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowAppointmentModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
			  
                <div className="form-group">
                  <label htmlFor="title">Appointment Title *</label>
                  <input
                    id="title"
                    type="text"
                    value={newAppointment.title}
                    onChange={(e) => setNewAppointment({...newAppointment, title: e.target.value})}
                    placeholder="Enter appointment title"
                  />
                </div>
                
				<div className="form-group">
					<label htmlFor="appointment-date">Date *</label>
					<input
					  id="appointment-date"
					  type="date"
					  value={newAppointment.appointment_date}
					  onChange={(e) => handleDateChange(e.target.value)}
					/>
				</div>
              
				<div className="form-group">
					<label htmlFor="client">Client *</label>
					<select
					  id="client"
					  value={newAppointment.client_id}
					  onChange={(e) => setNewAppointment({...newAppointment, client_id: e.target.value})}
					>
					  <option value="">Select a client</option>
					  {clients.map(client => (
						<option key={client.id} value={client.id}>
						  {client.name} - {client.phone}
						</option>
					  ))}
					</select>
				</div>
				
				<div className="form-group">
					<label htmlFor="doctor">Doctor *</label>
					<select
					  id="doctor"
					  value={newAppointment.doctor_id}
					  onChange={(e) => handleDoctorChange(e.target.value)}
					>
					  <option value="">Select a doctor</option>
					  {doctors.map(doctor => (
						<option key={doctor.id} value={doctor.id}>
						  {doctor.name} - {doctor.position}
						</option>
					  ))}
					</select>
				</div>
                
                <div className="form-group">
                  <label htmlFor="start_time">Start Time *</label>
                  <select
                    id="start_time"
                    value={newAppointment.start_time}
                    onChange={(e) => setNewAppointment({...newAppointment, start_time: e.target.value})}
                    disabled={!newAppointment.doctor_id}
                  >
                    <option value="">Select time</option>
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  {!newAppointment.doctor_id && (
                    <small className="form-help">Please select a doctor first</small>
                  )}
                </div>

				<div className="form-group">
					<label htmlFor="duration">Duration</label>
					<select
					  id="duration"
					  value={newAppointment.duration_minutes}
					  onChange={(e) => setNewAppointment({...newAppointment, duration_minutes: parseInt(e.target.value)})}
					>
					  {durationOptions.map(option => (
						<option key={option.value} value={option.value}>
						  {option.label}
						</option>
					  ))}
					</select>
				</div>
                
                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={newAppointment.description}
                    onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})}
                    placeholder="Enter appointment description"
                    rows="3"
                  />
                </div>
                
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowAppointmentModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={handleSaveAppointment}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Appointment Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="event-modal">
              <div className="modal-header">
                <h3>Edit Appointment</h3>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="edit-title">Appointment Title *</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={newAppointment.title}
                    onChange={(e) => setNewAppointment({...newAppointment, title: e.target.value})}
                    placeholder="Enter appointment title"
                  />
                </div>
                
				<div className="form-group">
                    <label htmlFor="edit-date">Date *</label>
                    <input
                      id="edit-date"
                      type="date"
                      value={newAppointment.appointment_date}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
				</div>
                
				<div className="form-group">
                    <label htmlFor="edit-client">Client *</label>
                    <select
                      id="edit-client"
                      value={newAppointment.client_id}
                      onChange={(e) => setNewAppointment({...newAppointment, client_id: e.target.value})}
                    >
                      <option value="">Select a client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.phone}
                        </option>
                      ))}
                    </select>
				</div>
				
				<div className="form-group">
                    <label htmlFor="edit-doctor">Doctor *</label>
                    <select
                      id="edit-doctor"
                      value={newAppointment.doctor_id}
                      onChange={(e) => handleDoctorChange(e.target.value)}
                    >
                      <option value="">Select a doctor</option>
                      {doctors.map(doctor => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} - {doctor.position}
                        </option>
                      ))}
                    </select>
				</div>
                
				<div className="form-group">
                  <label htmlFor="edit-start-time">Start Time *</label>
                  <select
                    id="edit-start-time"
                    value={newAppointment.start_time}
                    onChange={(e) => setNewAppointment({...newAppointment, start_time: e.target.value})}
                    disabled={!newAppointment.doctor_id}
                  >
                    <option value="">Select time</option>
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                    {/* Include current appointment time even if it's not in available slots */}
                    {editingAppointment && editingAppointment.start_time && 
                     !availableSlots.includes(formatTimeDisplay(editingAppointment.start_time)) && (
                      <option value={formatTimeDisplay(editingAppointment.start_time)}>
                        {formatTimeDisplay(editingAppointment.start_time)} (Current)
                      </option>
                    )}
                  </select>
                  {!newAppointment.doctor_id && (
                    <small className="form-help">Please select a doctor first</small>
                  )}
                </div>
                
				<div className="form-group">
                    <label htmlFor="edit-duration">Duration</label>
                    <select
                      id="edit-duration"
                      value={newAppointment.duration_minutes}
                      onChange={(e) => setNewAppointment({...newAppointment, duration_minutes: parseInt(e.target.value)})}
                    >
                      {durationOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
				</div>
				
                <div className="form-group">
                  <label htmlFor="edit-description">Description</label>
                  <textarea
                    id="edit-description"
                    value={newAppointment.description}
                    onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})}
                    placeholder="Enter appointment description"
                    rows="3"
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={handleUpdateAppointment}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Appointment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CalendarPage;