import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/Master.css';

const MasterCharacter = () => {
  const [user, setUser] = useState(null);
  const [frameContent, setFrameContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
    
    // Load frame content when component mounts
    loadFrameContent();
  }, []);

  const loadFrameContent = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/masterCharacter/chatbox-frame/1');
      const data = await response.json();
      
      if (data.success) {
        setFrameContent(data.frameContent || '');
      } else {
        setError('Failed to load frame content');
      }
    } catch (err) {
      setError('Error loading frame content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/masterCharacter/chatbox-frame/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frameContent })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Frame content updated successfully');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error updating frame content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (e) => {
    setFrameContent(e.target.value);
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Master AI Character Settings</h1>
        </div>
        
        {/* Settings Section */}
        <div className="settings-section">
          {loading && <div className="loading-message">Loading...</div>}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <div className="form-group">
            <label className="form-label">
              Frame Content
            </label>
            <textarea
              value={frameContent}
              onChange={handleTextareaChange}
              className="form-textarea"
              rows="10"
              placeholder="Enter frame content here..."
              disabled={loading}
            />
          </div>
          
          <div className="form-actions">
            <button
              onClick={handleSave}
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MasterCharacter;