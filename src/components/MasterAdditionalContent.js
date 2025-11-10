import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/Master.css';

const MasterAdditionalContent = () => {
  const [user, setUser] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
    
    // Load content and files when component mounts
    loadAdditionalContent();
    loadFiles();
  }, []);

  const loadAdditionalContent = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/additionalContent/additional-content/1');
      const data = await response.json();
      
      if (data.success) {
        setAdditionalContent(data.additionalContent || '');
      } else {
        setError('Failed to load additional content');
      }
    } catch (err) {
      setError('Error loading additional content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/additionalContent');
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files);
      } else {
        setError('Failed to load files');
      }
    } catch (err) {
      setError('Error loading files: ' + err.message);
    }
  };

  const handleViewFile = (fileId, originalName) => {
    // Open file in new tab using the new endpoint
    window.open(`/api/additionalContent/file/${fileId}`, '_blank');
  };

	const handleDownloadFile = async (fileId, originalName) => {
	  try {
		setError(''); // Clear any previous errors
		
		console.log('Downloading file:', fileId, originalName);
		
		const response = await fetch(`/api/additionalContent/file/${fileId}`, {
		  method: 'GET',
		  headers: {
			'Accept': 'application/octet-stream'
		  }
		});
		
		console.log('Download response status:', response.status);
		
		if (!response.ok) {
		  const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
		  throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
		}
		
		// Get the file as blob
		const blob = await response.blob();
		console.log('File blob size:', blob.size);
		
		if (blob.size === 0) {
		  throw new Error('Downloaded file is empty');
		}
		
		// Create download link
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = originalName;
		link.style.display = 'none';
		
		// Trigger download
		document.body.appendChild(link);
		link.click();
		
		// Cleanup
		setTimeout(() => {
		  document.body.removeChild(link);
		  window.URL.revokeObjectURL(url);
		}, 100);
		
		console.log('Download completed successfully');
		
	  } catch (err) {
		console.error('Download error:', err);
		setError('Error downloading file: ' + err.message);
	  }
	};

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file types - now includes Excel files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', // Excel .xls files
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // Excel .xlsx files
    ];
    
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      setError(`Invalid file types detected. Only PDF, Word documents, and Excel files are allowed.`);
      return;
    }
    
    setSelectedFiles(validFiles);
    setError('');
  };

	const handleFileUpload = async () => {
	  if (selectedFiles.length === 0) {
		setError('Please select files to upload');
		return;
	  }

	  try {
		setUploading(true);
		setError('');

		const formData = new FormData();
		selectedFiles.forEach(file => {
		  formData.append('files', file);
		});

		const response = await fetch('/api/additionalContent/upload', {
		  method: 'POST',
		  body: formData
		});

		const data = await response.json();

		if (data.success) {
		  // Enhanced success message with GitHub status
		  let successMessage = data.message;
		  if (data.githubStats) {
			successMessage += ` (GitHub: ${data.githubStats.successful} uploaded, ${data.githubStats.failed} failed)`;
		  }
		  
		  setSuccess(successMessage);
		  console.log('Upload result:', data);
		  
		  setSelectedFiles([]);
		  // Clear file input
		  const fileInput = document.getElementById('fileInput');
		  if (fileInput) fileInput.value = '';
		  // Reload files list
		  loadFiles();
		  setTimeout(() => {
			setSuccess('');
		  }, 3000);
		} else {
		  setError(data.message);
		}
	  } catch (err) {
		setError('Error uploading files: ' + err.message);
	  } finally {
		setUploading(false);
	  }
	};

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await fetch(`/api/additionalContent/${fileId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('File deleted successfully');
        loadFiles(); // Reload files list
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error deleting file: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // First upload any selected files
      if (selectedFiles.length > 0) {
        await handleFileUpload();
      }

      // Then save the textarea content
      const response = await fetch('/api/additionalContent/additional-content/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ additionalContent })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Additional content and files saved successfully');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error saving content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (e) => {
    setAdditionalContent(e.target.value);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') {
      return '📄';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return '📝';
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return '📊'; // Excel file icon
    }
    return '📄';
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Content Configuration Settings</h1>
        </div>
        
        {/* Settings Section */}
        <div className="settings-section">
          {loading && <div className="loading-message">Loading...</div>}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <div className="form-group">
            <label className="form-label">
              Additional Content
            </label>
            <textarea
              value={additionalContent}
              onChange={handleTextareaChange}
              className="form-textarea"
              rows="10"
              placeholder="Enter Additional Content here..."
              disabled={loading}
            />
          </div>
          
          {/* Uploaded Files List */}
          {files.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                📂 Uploaded Files ({files.length})
              </label>
              <div className="files-list">
                {files.map(file => (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <span className="file-icon">{getFileIcon(file.mime_type)}</span>
                      <div className="file-details">
                        <div className="file-name">{file.original_name}</div>
                        <div className="file-meta">
                          {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="file-actions">
                      {/* 
                      <button
                        onClick={() => handleViewFile(file.id, file.original_name)}
                        className="view-button"
                        title="View file in browser"
                      >
                        View
                      </button>
                      */}
                      <button
                        onClick={() => handleDownloadFile(file.id, file.original_name)}
                        className="download-button"
                        title="Download file"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="delete-button"
                        title="Delete file"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* File Upload Section */}
          <div className="form-group">
            <label className="form-label">
              📎 Upload Files (PDF, Word documents, and Excel files)
            </label>
            <div className="file-upload-container">
              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="fileInput"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileSelect}
                  className="file-input"
                  disabled={uploading}
                />
              </div>
              
            </div>
            
            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <div style={{ display:"flex", justifyContent:"flex-start" }}>
                  <h4>Selected Files:</h4>
                  {selectedFiles.length > 0 && (
                    <button
                      style={{ marginLeft:"10px"}}
                      type="button"
                      //onClick={handleFileUpload}
                      disabled={uploading}
                      className={`upload-button ${uploading ? 'uploading' : ''}`}
                    >
                      {uploading ? 'Uploading...' : `Select ${selectedFiles.length} file(s)`}
                    </button>
                  )}
                </div>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="selected-file-item">
                    <span className="file-icon">{getFileIcon(file.type)}</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({formatFileSize(file.size)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              onClick={handleSave}
              className="submit-button"
              disabled={loading || uploading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MasterAdditionalContent;
