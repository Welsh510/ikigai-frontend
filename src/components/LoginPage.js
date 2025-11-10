import React, { useState, useEffect } from 'react';
import './css/LoginPage.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    usercode: '',
    password: '',
    rememberMe: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for remember token on component mount
  useEffect(() => {
    const checkRememberToken = async () => {
      const rememberToken = localStorage.getItem('rememberToken');
      
      if (rememberToken) {
        setLoading(true);
        try {
          const response = await fetch('/api/login/remember-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rememberToken })
          });

          const data = await response.json();

          if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/HomePage';
          } else {
            // Remove invalid remember token
            localStorage.removeItem('rememberToken');
          }
        } catch (err) {
          console.error('Auto-login error:', err);
          localStorage.removeItem('rememberToken');
        } finally {
          setLoading(false);
        }
      }
    };

    checkRememberToken();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Store remember token if provided
        if (data.rememberToken) {
          localStorage.setItem('rememberToken', data.rememberToken);
        } else {
          // Remove remember token if not remembering
          localStorage.removeItem('rememberToken');
        }
        
        // Redirect based on user type
        /*
        if (data.user.type === 1) {
          window.location.href = '/AdminHomePage';
        } else if (data.user.type === 2) {
          window.location.href = '/HomePage';
        } else {
          setError('Invalid user type');
        }
        */
        window.location.href = '/HomePage';

      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Login System</h2>
          <p>Please sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="usercode">User Code</label>
            <input
              type="text"
              id="usercode"
              name="usercode"
              value={formData.usercode}
              onChange={handleChange}
              required
              autoComplete="off"
              placeholder="Enter your user code"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label" htmlFor="rememberMe">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="checkbox-input"
              />
              <span className="checkbox-text">Remember Me</span>
            </label>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;