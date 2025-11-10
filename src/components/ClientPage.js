import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './css/ClientPage.css';

const ClientPage = () => {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ic: '',
    dob: '',
    phonenumber: '',
    email: '',
    status: 1
  });

  // Date state for DatePicker
  const [selectedDate, setSelectedDate] = useState(null);

  // Pagination calculations
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);
  
	const handlePhoneNumberChange = (e) => {
	  const { value } = e.target;
	  // Remove any non-numeric characters
	  const numericValue = value.replace(/\D/g, '');
	  
	  setFormData(prev => ({
		...prev,
		phonenumber: numericValue
	  }));
	};

  // Get page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
    
    // Load clients when component mounts
    loadClients();
  }, []);

  // Filter clients when filterText changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => 
        client.NAME.toLowerCase().includes(filterText.toLowerCase()) ||
        client.PHONENUMBER.toLowerCase().includes(filterText.toLowerCase())
      );
      setFilteredClients(filtered);
    }
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filterText, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clients');
      const data = await response.json();
      
      if (data.success) {
        setClients(data.clients);
        setFilteredClients(data.clients);
      } else {
        setError('Failed to load clients');
      }
    } catch (err) {
      setError('Error loading clients: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    // Filter is handled automatically in useEffect
  };

  const handleReset = () => {
    setFilterText('');
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      ic: '',
      dob: '',
      phonenumber: '',
      email: '',
      status: 1
    });
    setSelectedDate(null);
    setSelectedClient(null);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  // Helper function to convert date string to Date object
  const stringToDate = (dateString) => {
    if (!dateString) return null;
    
    // Handle yyyy-mm-dd format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return new Date(dateString + 'T00:00:00');
    }
    
    // Handle yyyy/mm/dd format
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('/');
      return new Date(year, month - 1, day);
    }
    
    // Handle dd/mm/yyyy format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split('/');
      return new Date(year, month - 1, day);
    }
    
    // Try parsing as-is
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  const openEditModal = (client) => {
    setModalMode('edit');
    
    const dobDate = stringToDate(client.DOB);
    
    setFormData({
      name: client.NAME || '',
      ic: client.IC || '',
      dob: dobDate ? dobDate.toISOString().split('T')[0] : '',
      phonenumber: client.PHONENUMBER || '',
      email: client.EMAIL || '',
      status: client.STATUS
    });
    
    setSelectedDate(dobDate);
    setSelectedClient(client);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedClient(null);
    setSelectedDate(null);
    setFormData({
      name: '',
      ic: '',
      dob: '',
      phonenumber: '',
      email: '',
      status: 1
    });
    setError('');
    setSuccess('');
  };

  // Delete functionality
  const openDeleteModal = (client, e) => {
    e.stopPropagation(); // Prevent row click event
    setClientToDelete(client);
    setShowDeleteModal(true);
    setError('');
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setClientToDelete(null);
    setError('');
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/clients/${clientToDelete.PKKEY}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Client deleted successfully');
        loadClients(); // Reload the clients list
        closeDeleteModal();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error deleting client: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (client) => {
    openEditModal(client);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'status' ? parseInt(value) : value
    }));
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (date) {
      // Format date as yyyy-mm-dd for storage
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setFormData(prev => ({
        ...prev,
        dob: `${year}-${month}-${day}`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        dob: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.phonenumber) {
      setError('Name and Phone Number are required fields');
      return;
    }

    // Prepare the data to send
    const submitData = {
      name: formData.name,
      ic: formData.ic,
      dob: formData.dob, // Already in yyyy-mm-dd format
      phonenumber: formData.phonenumber,
      email: formData.email,
      status: formData.status
    };

    try {
      setLoading(true);
      setError('');

      const url = modalMode === 'add' 
        ? '/api/clients/newclient' 
        : `/api/clients/saveclient/${selectedClient.PKKEY}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        loadClients(); // Reload the clients list
        setTimeout(() => {
          closeModal();
        }, 1000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    const date = stringToDate(dateString);
    
    // Return formatted date or dash
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    }
    return '-';
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Client Management</h1>
        </div>
        
        {/* Success Message */}
        {success && !showModal && !showDeleteModal && (
          <div className="success-message">{success}</div>
        )}
        
        {/* Filter Section */}
        <div className="filter-section">
          <div className="filter-controls">
            <div>
              <input
                id="filterInput"
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="filter-input"
                placeholder="Enter Name or Phone Number to filter..."
              />
            </div>
            <button
              onClick={handleReset}
              className="reset-button"
            >
              Reset
            </button>
          </div>

          <div>
            <button
              onClick={openAddModal}
              className="new-button"
            >
              + New Client
            </button>
          </div>
        </div>

        {/* Clients Table */}
        <div>
          {loading && <div className="loading-message">Loading...</div>}
          {error && !showModal && !showDeleteModal && <div className="error-message">{error}</div>}
          
          <table className="users-table">
            <thead>
              <tr className="table-header">
                <th>No.</th>
                <th>Name</th>
                <th>IC</th>
                <th>DOB</th>
                <th>Phone Number</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentClients.map((client, index) => (
                <tr 
                  key={client.PKKEY}
                  onClick={() => handleRowClick(client)}
                  className="table-row"
                >
                  <td className="table-cell">{startIndex + index + 1}.</td>
                  <td className="table-cell">{client.NAME}</td>
                  <td className="table-cell">{client.IC || '-'}</td>
                  <td className="table-cell">{formatDate(client.DOB)}</td>
                  <td className="table-cell">{client.PHONENUMBER}</td>
                  <td className="table-cell">{client.EMAIL || '-'}</td>
                  <td className="table-cell">
                    <span className={client.STATUS === 1 ? 'status-active' : 'status-inactive'}>
                      {client.STATUS === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      className="delete-button"
                      onClick={(e) => openDeleteModal(client, e)}
                      disabled={loading}
                      title="Delete Client"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredClients.length === 0 && !loading && (
            <div className="no-data-message">
              No clients found
            </div>
          )}

          {/* Pagination */}
          {filteredClients.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredClients.length)} of {filteredClients.length} entries
              </div>
              
              <div className="pagination-controls">
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                
                {getPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === '...' ? (
                      <span className="pagination-ellipsis">...</span>
                    ) : (
                      <button
                        className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    )}
                  </React.Fragment>
                ))}
                
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">
                {modalMode === 'add' ? 'Add New Client' : 'Edit Client'}
              </h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleSubmit}>
                
                <div className="form-group">
                  <label className="form-label">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                    autoComplete='off'
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    IC Number
                  </label>
                  <input
                    type="text"
                    name="ic"
                    value={formData.ic}
                    onChange={handleInputChange}
                    className="form-input"
                    autoComplete='off'
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Date of Birth
                  </label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    dateFormat="yyyy/MM/dd"
                    className="form-input"
                    placeholderText="Select date"
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                    maxDate={new Date()}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Phone Number *
                  </label>
                  <input
					type="text"
					name="phonenumber"
					value={formData.phonenumber}
					onChange={handlePhoneNumberChange} 
					className="form-input"
					required
					autoComplete='off'
					placeholder="Enter numbers only"
					inputMode="numeric"
					pattern="[0-9]*"
				  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="form-input"
                    autoComplete='off'
                  />
                </div>
                
                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                )}
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (modalMode === 'add' ? 'Add Client' : 'Save Client')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Confirm Delete</h2>
              
              {error && <div className="modal-error">{error}</div>}
              
              <div className="delete-confirmation">
                <p>Are you sure you want to delete this client?</p>
                <div className="client-details">
                  <strong>Name:</strong> {clientToDelete?.NAME}<br />
                  <strong>Phone:</strong> {clientToDelete?.PHONENUMBER}
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="cancel-button"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="delete-confirm-button"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClientPage;