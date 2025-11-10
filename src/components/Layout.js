import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNavigation from './TopNavigation';
import ChangePasswordModal from './ChangePasswordModal';
import './css/Layout.css';

const Layout = ({ children }) => {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Check if screen is mobile size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-hide sidebar on mobile, show on desktop
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Check on initial load
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (userData) {
      setUser(userData);
    } else {
      window.location.href = '/LoginPage';
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
  };

  const handleCloseChangePasswordModal = () => {
    setShowChangePasswordModal(false);
  };

  // Close sidebar when clicking on overlay (mobile only)
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  if (!user) {
    return (
      <div className="layout-loading">
        <div className="layout-loading-content">
          <div className="layout-spinner"></div>
          <p className="layout-loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-container">
      {/* Sidebar Component */}
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content */}
      <div className="layout-main">
        {/* Top Navigation Component */}
        <TopNavigation 
          user={user}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
          onChangePassword={handleChangePassword}
        />

        {/* Page Content */}
        <div className="layout-content">
          {children}
        </div>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      <div 
        className={`layout-overlay ${sidebarOpen && isMobile ? 'show' : ''}`}
        onClick={handleOverlayClick}
      ></div>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={showChangePasswordModal}
        onClose={handleCloseChangePasswordModal}
        user={user}
      />
    </div>
  );
};

export default Layout;