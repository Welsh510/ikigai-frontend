import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/Master.css';

const MasterIndustryContent = () => {
  const [user, setUser] = useState(null);
  const [projectContent, setProjectContent] = useState({
    en: '',
    cn: '',
    my: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
    
    // Load project content when component mounts
    loadProjectContent();
  }, []);

  const loadProjectContent = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/project-content/1');
      const data = await response.json();
      
      if (data.success) {
        setProjectContent({
          en: data.content.projectContentEn || '',
          cn: data.content.projectContentCn || '',
          my: data.content.projectContentMy || ''
        });
      } else {
        setError('Failed to load project content');
      }
    } catch (err) {
      setError('Error loading project content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    
    try {      
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/project-content/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectContentEn: projectContent.en,
          projectContentCn: projectContent.cn,
          projectContentMy: projectContent.my
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Project content updated successfully');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error updating project content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (language, value) => {
    setProjectContent(prev => ({
      ...prev,
      [language]: value
    }));
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Master Industry Content Settings</h1>
        </div>
        
        {/* Settings Section */}
        <div className="settings-section">
          {loading && <div className="loading-message">Loading...</div>}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <span 
            style={{color:'red', fontWeight:'bold'}}>
              Need to add commas between every keyword
          </span>

          <form onSubmit={handleSubmit} className="project-content-form" style={{marginTop:'20px'}}>
            <div className="form-group">
              <label className="form-label" htmlFor="content-en">
                Industry Content (English)
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="content-en"
                name="projectContentEn"
                value={projectContent.en}
                onChange={(e) => handleTextareaChange('en', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter English content here..."
                disabled={loading}
                required
              />

              <label className="form-label" htmlFor="content-my">
                Industry Content (Melayu)
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="content-my"
                name="projectContentMy"
                value={projectContent.my}
                onChange={(e) => handleTextareaChange('my', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Malay content here..."
                disabled={loading}
                required
              />

              <label className="form-label" htmlFor="content-cn">
                Industry Content (Mandarin)
              </label>
              <textarea
                id="content-cn"
                name="projectContentCn"
                value={projectContent.cn}
                onChange={(e) => handleTextareaChange('cn', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Chinese content here..."
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default MasterIndustryContent;