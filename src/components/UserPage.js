import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/UserPage.css';

const UserPage = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    usercode: '',
    name: '',
    password: '',
    type: 2, // Default to Supervisor
    status: 1
  });

  // Updated helper function to get user type label
  const getUserTypeLabel = (type) => {
    switch(type) {
      case 1: return 'Administrator';
      case 2: return 'Supervisor';
      case 3: return 'Nurse';
      default: return 'Unknown';
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

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
    
    // Load users when component mounts
    loadUsers();
  }, []);

  // Filter users when filterText changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.USERCODE.toLowerCase().includes(filterText.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filterText, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
        setFilteredUsers(data.users);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('Error loading users: ' + err.message);
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
    // Set default type: Supervisors can only create Supervisor/Nurse, so default to Supervisor
    // Administrators can create any type, so default to Supervisor as well for consistency
    setFormData({
      usercode: '',
      name: '',
      password: '',
      type: 2, // Default to Supervisor
      status: 1
    });
    setSelectedUser(null);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const openEditModal = (user_to_edit) => {
    // Prevent supervisors from editing administrator users
    if (user?.type === 2 && user_to_edit.TYPE === 1) {
      setError('You do not have permission to edit administrator users');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setModalMode('edit');
    setFormData({
      usercode: user_to_edit.USERCODE,
      name: user_to_edit.NAME,
      password: '',
      type: user_to_edit.TYPE,
      status: user_to_edit.STATUS
    });
    setSelectedUser(user_to_edit);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData({
      usercode: '',
      name: '',
      password: '',
      type: 2, // Default to Supervisor
      status: 1
    });
    setError('');
    setSuccess('');
  };

  // Delete functionality
  const openDeleteModal = (user_to_delete, e) => {
    e.stopPropagation(); // Prevent row click event
    
    // Prevent supervisors from deleting administrator users
    if (user?.type === 2 && user_to_delete.TYPE === 1) {
      setError('You do not have permission to delete administrator users');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setUserToDelete(user_to_delete);
    setShowDeleteModal(true);
    setError('');
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setError('');
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/users/${userToDelete.PKKEY}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('User deleted successfully');
        loadUsers(); // Reload the users list
        closeDeleteModal();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error deleting user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (user) => {
    openEditModal(user);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'status' || name === 'type') ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (modalMode === 'add') {
      if (!formData.usercode || !formData.name || !formData.password) {
        setError('Please fill in all required fields');
        return;
      }
    } else {
      if (!formData.name) {
        setError('Please fill in the name field');
        return;
      }
    }

    // Prevent supervisors from creating or editing administrator users
    if (user?.type === 2 && formData.type === 1) {
      setError('You do not have permission to create or assign administrator privileges');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const url = modalMode === 'add' 
        ? '/api/users/newusers' 
        : `/api/users/saveusers/${selectedUser.PKKEY}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const payload = modalMode === 'add' 
        ? formData 
        : { name: formData.name, type: formData.type, status: formData.status };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        loadUsers(); // Reload the users list
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
          <h1 className="homepage-title">User Control</h1>
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
                placeholder="Enter Login User Code to filter..."
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
              + New
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div>
          {loading && <div className="loading-message">Loading...</div>}
          {error && !showModal && !showDeleteModal && <div className="error-message">{error}</div>}
          
          <table className="users-table">
            <thead>
              <tr className="table-header">
                <th>No.</th>
                <th>Login User Code</th>
                <th>Short Name</th>
                <th>User Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user_row, index) => (
                <tr 
                  key={user_row.PKKEY}
                  onClick={() => handleRowClick(user_row)}
                  className={`table-row ${user?.type === 2 && user_row.TYPE === 1 ? 'restricted-row' : ''}`}
                  style={{
                    cursor: user?.type === 2 && user_row.TYPE === 1 ? 'not-allowed' : 'pointer',
                    opacity: user?.type === 2 && user_row.TYPE === 1 ? 0.6 : 1
                  }}
                  title={user?.type === 2 && user_row.TYPE === 1 ? 'You cannot edit administrator users' : 'Click to edit'}
                >
                  <td className="table-cell">{startIndex + index + 1}.</td>
                  <td className="table-cell">{user_row.USERCODE}</td>
                  <td className="table-cell">{user_row.NAME}</td>
                  <td className="table-cell">{getUserTypeLabel(user_row.TYPE)}</td>
                  <td className="table-cell">
                    <span className={user_row.STATUS === 1 ? 'status-active' : 'status-inactive'}>
                      {user_row.STATUS === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      className="delete-button"
                      onClick={(e) => openDeleteModal(user_row, e)}
                      disabled={loading || (user?.type === 2 && user_row.TYPE === 1)}
                      title={user?.type === 2 && user_row.TYPE === 1 ? "Cannot delete administrator users" : "Delete User"}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && !loading && (
            <div className="no-data-message">
              No users found
            </div>
          )}

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} entries
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
                {modalMode === 'add' ? 'Add New User' : 'Edit User'}
              </h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleSubmit}>
                
                {modalMode === 'add' && (
                  <div className="form-group">
                    <label className="form-label">
                      Login User Code *
                    </label>
                    <input
                      type="text"
                      name="usercode"
                      value={formData.usercode}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      autoComplete='off'
                    />
                  </div>
                )}

                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label className="form-label">
                      Login User Code *
                    </label>
                    <input
                      type="text"
                      name="usercode"
                      value={formData.usercode}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      autoComplete='off'
                      disabled
                    />
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label">
                    User Name *
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
                
                {modalMode === 'add' && (
                  <div className="form-group">
                    <label className="form-label">
                      User Type *
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="form-select"
                      required
                    >
                      {user?.type === 1 && <option value={1}>Administrator</option>}
                      <option value={2}>Supervisor</option>
                      <option value={3}>Nurse</option>
                    </select>
                  </div>
                )}

                {modalMode === 'add' && (
                  <div className="form-group">
                    <label className="form-label">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>
                )}
                
                {modalMode === 'edit' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        User Type
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="form-select"
                      >
                        {user?.type === 1 && <option value={1}>Administrator</option>}
                        <option value={2}>Supervisor</option>
                        <option value={3}>Nurse</option>
                      </select>
                    </div>
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
                  </>
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
                    {loading ? 'Saving...' : (modalMode === 'add' ? 'Add User' : 'Save User')}
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
                <p>Are you sure you want to delete this user?</p>
                <div className="client-details">
                  <strong>User Code:</strong> {userToDelete?.USERCODE}<br />
                  <strong>Name:</strong> {userToDelete?.NAME}<br />
                  <strong>Type:</strong> {getUserTypeLabel(userToDelete?.TYPE)}
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

export default UserPage;