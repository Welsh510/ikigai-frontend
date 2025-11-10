import React, { useState, useEffect } from 'react';
import './css/Sidebar.css';

const Sidebar = ({ isOpen, onToggle }) => {
  const [user, setUser] = useState(null);
  const [masterSubmenuOpen, setMasterSubmenuOpen] = useState(false);

  // Get user data from localStorage
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (userData) {
      setUser(userData);
    }
  }, []);

  const handleNavigation = (path) => {
    // In a real app, you would use your routing solution here
    window.location.href = path;
  };

  const handleMasterToggle = () => {
    setMasterSubmenuOpen(!masterSubmenuOpen);
  };

  const handleLogout = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    try {
        // Call logout API to clear remember token from database
        await fetch('/api/login/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pkkey: user.pkkey })
        });
    } catch (error) {
        console.error('Logout API error:', error);
    } finally {
        // Clear local storage regardless of API success/failure
        localStorage.removeItem('user');
        localStorage.removeItem('rememberToken');
        window.location.href = '/LoginPage';
    }
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">Backend System</h2>
      </div>
      <nav className="sidebar-nav">

        {/* A - Dashboard: Available for all user types (1, 2, 3) */}
        <button className="sidebar-nav-item" onClick={() => handleNavigation('/HomePage')}>
          A - Dashboard
        </button>

        {/* B - WhatsApp Content: Available for all user types (1, 2, 3) */}
        <button className="sidebar-nav-item" onClick={() => handleNavigation('/ChatboxPage')}>
          B - WhatsApp Content
        </button>

        {/* C - Client: Available for user types 1 and 2 only */}
        {user && (user.type === 1 || user.type === 2) && (
          <button className="sidebar-nav-item" onClick={() => handleNavigation('/ClientPage')}>
            C - Client
          </button>
        )}

        {/* D - Doctor: Available for user types 1 and 2 only */}
        {user && (user.type === 1 || user.type === 2) && (
          <button className="sidebar-nav-item" onClick={() => handleNavigation('/DoctorPage')}>
            D - Doctor
          </button>
        )}
		  
        {/* E - Calendar: Available for user types 1 and 2 only */}
        {user && (user.type === 1 || user.type === 2) && (
          <button className="sidebar-nav-item" onClick={() => handleNavigation('/CalendarPage')}>
            E - Calendar
          </button>
        )}
		
        {/* Master menu with submenu: Available for user types 1 and 2 only */}
        {user && (user.type === 1 || user.type === 2) && (
          <div className="sidebar-nav-item-container">
            <button className={`sidebar-nav-item ${masterSubmenuOpen ? 'active' : ''}`} 
              onClick={handleMasterToggle}
            >
              <span>X - Master</span>
              <span className={`submenu-arrow ${masterSubmenuOpen ? 'open' : ''}`}>▼</span>
            </button>
            
            {/* Master Submenu */}
            <div className={`sidebar-submenu ${masterSubmenuOpen ? 'open' : ''}`}>
              {/* X1 Master 1 - Only visible for user type 1 (Admin) */}
              {user && user.type === 1 && (
                <button className="sidebar-submenu-item" onClick={() => handleNavigation('/MasterCharacter')}>
                  X1 - AI Character
                </button>
              )}
              
              {/* X2 Master 2 - Available for user types 1 and 2 */}
              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/MasterAdditionalContent')}>
                X2 - Content Configuration
              </button>
                  
              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/MasterOpening')}>
                X3 - First Message Control
              </button>

              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/MasterSensitiveContent')}>
                X4 - Preset Reply Setting
              </button>
                  
              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/SpecialReplyPage')}>
                X5 - Keyword-triggered Reply
              </button>

              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/FollowUpPage')}>
                X6 - Follow Up Control
              </button>
              
              <button className="sidebar-submenu-item" onClick={() => handleNavigation('/ScheduledMessagesPage')}>
                X7 - Scheduled Messages
              </button>
            </div>
          </div>
        )}
		
        {/* Y - User Control: Available for user types 1 and 2 only */}
        {user && (user.type === 1 || user.type === 2) && (
          <button className="sidebar-nav-item" onClick={() => handleNavigation('/UserPage')}>
            Y - User Control
          </button>
        )}

        {/* Z - Logout: Available for all user types (1, 2, 3) */}
        <button className="sidebar-nav-item" onClick={handleLogout}>
          Z - Logout
        </button>
      </nav>
      
      {/* Additional Menu Section */}
      {/*
      <div className="sidebar-quick-actions">
        <h3 className="sidebar-quick-actions-title">
          Quick Actions
        </h3>
        <button 
          className="sidebar-quick-action"
          onClick={() => handleNavigation('/profile')}
        >
          Profile Settings
        </button>
        <button 
          className="sidebar-quick-action"
          onClick={() => handleNavigation('/help')}
        >
          Help & Support
        </button>
      </div>
      */}

    </div>
  );
};

export default Sidebar;