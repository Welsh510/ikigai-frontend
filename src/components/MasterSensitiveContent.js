import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/Master.css';

const MasterSensitiveContent = () => {
  const [user, setUser] = useState(null);
  const [sensitiveContent, setSensitiveContent] = useState({
    content: '',
    reply: '',
    appointmentReply: '',
    humanServiceReply: '',
    birthdayGreetings: '',
    attachMediaReply: ''
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
    loadSensitiveContent();
  }, []);

  const loadSensitiveContent = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sensitiveContent/sensitive-content/1');
      const data = await response.json();
      
      if (data.success) {
        setSensitiveContent({
          content: data.content.sensitiveContent || '',
          reply: data.content.sensitiveReply || '',
          appointmentReply: data.content.appointmentReply || '',
          humanServiceReply: data.content.humanServiceReply || '',
          birthdayGreetings: data.content.birthdayGreetings || '',
          attachMediaReply: data.content.attachMediaReply || ''
        });
      } else {
        setError('Failed to load sensitive content');
      }
    } catch (err) {
      setError('Error loading sensitive content: ' + err.message);
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

      const response = await fetch('/api/sensitiveContent/sensitive-content/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sensitiveContent: sensitiveContent.content,
          sensitiveReply: sensitiveContent.reply,
          appointmentReply: sensitiveContent.appointmentReply,
          humanServiceReply: sensitiveContent.humanServiceReply,
          birthdayGreetings: sensitiveContent.birthdayGreetings,
          attachMediaReply: sensitiveContent.attachMediaReply
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Sensitive content updated successfully');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error updating sensitive content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (field, value) => {
    setSensitiveContent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Preset Reply Setting</h1>
        </div>
        
        {/* Settings Section */}
        <div className="settings-section">
          {loading && <div className="loading-message">Loading...</div>}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          

          <form onSubmit={handleSubmit} className="project-content-form" style={{marginTop:'20px'}}>
            <div className="form-group">
              <label className="form-label" htmlFor="content-sensitive" style={{fontWeight:'bold', fontSize:'16px'}}>
                Sensitive Content
                <br/>
                <span 
                  style={{color:'red', fontWeight:'bold', fontSize:'12px'}}>
                    Need to add commas between every keyword
                </span>
              </label>
              
              <textarea
                style={{marginBottom:'10px'}}
                id="content-sensitive"
                name="sensitiveContent"
                value={sensitiveContent.content}
                onChange={(e) => handleTextareaChange('content', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Sensitive Content here..."
                disabled={loading}
                required
              />

              <label className="form-label" htmlFor="reply-sensitive" style={{fontWeight:'bold', fontSize:'16px'}}>
                Sensitive Reply
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="reply-sensitive"
                name="sensitiveReply"
                value={sensitiveContent.reply}
                onChange={(e) => handleTextareaChange('reply', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Sensitive Reply here..."
                disabled={loading}
                required
              />
			  
			  <label className="form-label" htmlFor="reply-appointment" style={{fontWeight:'bold', fontSize:'16px'}}>
                Appointment Reply
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="reply-appointment"
                name="appointmentReply"
                value={sensitiveContent.appointmentReply}
                onChange={(e) => handleTextareaChange('appointmentReply', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Appointment Reply here..."
                disabled={loading}
                required
              />
			  
			  <label className="form-label" htmlFor="reply-human-service" style={{fontWeight:'bold', fontSize:'16px'}}>
                Human Service Reply
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="reply-human-service"
                name="humanServiceReply"
                value={sensitiveContent.humanServiceReply}
                onChange={(e) => handleTextareaChange('humanServiceReply', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Human Service Reply here..."
                disabled={loading}
                required
              />
			  
			  <label className="form-label" htmlFor="reply-attach-media" style={{fontWeight:'bold', fontSize:'16px'}}>
                Attach Media Reply
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="reply-attach-media"
                name="attachMediaReply"
                value={sensitiveContent.attachMediaReply}
                onChange={(e) => handleTextareaChange('attachMediaReply', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Attach Media Reply here..."
                disabled={loading}
                required
              />
			  
			  <label className="form-label" htmlFor="greetings-birthday" style={{fontWeight:'bold', fontSize:'16px'}}>
                Birthday Greetings
              </label>
              <textarea
                style={{marginBottom:'10px'}}
                id="greetings-birthday"
                name="birthdayGreetings"
                value={sensitiveContent.birthdayGreetings}
                onChange={(e) => handleTextareaChange('birthdayGreetings', e.target.value)}
                className="form-textarea"
                rows="3"
                placeholder="Enter Birthday Greetings here..."
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

export default MasterSensitiveContent;