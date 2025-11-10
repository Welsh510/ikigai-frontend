import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/DoctorPage.css';

const DoctorPage = () => {
  const [user, setUser] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    phone: ''
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDoctors = filteredDoctors.slice(startIndex, endIndex);

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
    
    // Load doctors when component mounts
    loadDoctors();
  }, []);

  // Filter doctors when filterText changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredDoctors(doctors);
    } else {
      const filtered = doctors.filter(doctor => 
        doctor.NAME.toLowerCase().includes(filterText.toLowerCase()) ||
        (doctor.POSITION && doctor.POSITION.toLowerCase().includes(filterText.toLowerCase())) ||
        (doctor.phone && doctor.phone.toLowerCase().includes(filterText.toLowerCase()))
      );
      setFilteredDoctors(filtered);
    }
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filterText, doctors]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/doctors');
      const data = await response.json();
      
      if (data.success) {
        setDoctors(data.doctors);
        setFilteredDoctors(data.doctors);
      } else {
        setError('Failed to load doctors');
      }
    } catch (err) {
      setError('Error loading doctors: ' + err.message);
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
      position: '',
      phone: ''
    });
    setSelectedDoctor(null);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const openEditModal = (doctor) => {
    setModalMode('edit');
    
    setFormData({
      name: doctor.NAME || '',
      position: doctor.POSITION || '',
      phone: doctor.phone || ''
    });
    
    setSelectedDoctor(doctor);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDoctor(null);
    setFormData({
      name: '',
      position: '',
      phone: ''
    });
    setError('');
    setSuccess('');
  };

  // Delete functionality
  const openDeleteModal = (doctor, e) => {
    e.stopPropagation(); // Prevent row click event
    setDoctorToDelete(doctor);
    setShowDeleteModal(true);
    setError('');
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDoctorToDelete(null);
    setError('');
  };

  const handleDelete = async () => {
    if (!doctorToDelete) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/doctors/${doctorToDelete.pkkey}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Doctor deleted successfully');
        loadDoctors(); // Reload the doctors list
        closeDeleteModal();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error deleting doctor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (doctor) => {
    openEditModal(doctor);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name) {
      setError('Name is required');
      return;
    }

    // Prepare the data to send
    const submitData = {
      name: formData.name,
      position: formData.position,
      phone: formData.phone
    };

    try {
      setLoading(true);
      setError('');

      const url = modalMode === 'add' 
        ? '/api/doctors/newdoctor' 
        : `/api/doctors/savedoctor/${selectedDoctor.pkkey}`;
      
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
        loadDoctors(); // Reload the doctors list
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

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Doctor Management</h1>
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
                placeholder="Enter Name, Position, or Phone Number to filter..."
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
              + New Doctor
            </button>
          </div>
        </div>

        {/* Doctors Table */}
        <div>
          {loading && <div className="loading-message">Loading...</div>}
          {error && !showModal && !showDeleteModal && <div className="error-message">{error}</div>}
          
          <table className="users-table">
            <thead>
              <tr className="table-header">
                <th>No.</th>
                <th>Name</th>
                <th>Position</th>
                <th>Phone Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentDoctors.map((doctor, index) => (
                <tr 
                  key={doctor.pkkey}
                  onClick={() => handleRowClick(doctor)}
                  className="table-row"
                >
                  <td className="table-cell">{startIndex + index + 1}.</td>
                  <td className="table-cell">{doctor.NAME}</td>
                  <td className="table-cell">{doctor.POSITION || '-'}</td>
                  <td className="table-cell">{doctor.phone || '-'}</td>
                  <td className="table-cell">
                    <button
                      className="delete-button"
                      onClick={(e) => openDeleteModal(doctor, e)}
                      disabled={loading}
                      title="Delete Doctor"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredDoctors.length === 0 && !loading && (
            <div className="no-data-message">
              No doctors found
            </div>
          )}

          {/* Pagination */}
          {filteredDoctors.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDoctors.length)} of {filteredDoctors.length} entries
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
                {modalMode === 'add' ? 'Add New Doctor' : 'Edit Doctor'}
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
                    Position
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    className="form-input"
                    autoComplete='off'
                    placeholder="e.g., Cardiologist, General Practitioner"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="form-input"
                    autoComplete='off'
                  />
                </div>
                
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
                    {loading ? 'Saving...' : (modalMode === 'add' ? 'Add Doctor' : 'Save Doctor')}
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
                <p>Are you sure you want to delete this doctor?</p>
                <div className="client-details">
                  <strong>Name:</strong> {doctorToDelete?.NAME}<br />
                  <strong>Position:</strong> {doctorToDelete?.POSITION || 'N/A'}<br />
                  <strong>Phone:</strong> {doctorToDelete?.phone || 'N/A'}
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

export default DoctorPage;