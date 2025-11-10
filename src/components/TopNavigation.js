import React, { useState } from 'react';
import { Menu, User, Lock, LogOut } from 'lucide-react';
import './css/TopNavigation.css';

const TopNavigation = ({ user, onToggleSidebar, onLogout, onChangePassword }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Helper function to get user type label
  const getUserTypeLabel = (type) => {
    switch(type) {
      case 1: return 'Administrator';
      case 2: return 'Supervisor';
      case 3: return 'Nurse';
      default: return 'Unknown';
    }
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  return (
    <div className="top-nav">
      <div className="top-nav-left">
        <button 
          onClick={onToggleSidebar}
          className="top-nav-menu-button"
        >
          <Menu size={20} />
        </button>
      </div>
      
      <div className="top-nav-right">
        <button 
          onClick={toggleUserMenu}
          className="top-nav-user-button"
        >
          <span className="top-nav-user-name">
            {user.name ? user.name.toUpperCase() : user.usercode.toUpperCase()}
          </span>
          <div className="top-nav-user-avatar">
            <User size={16} />
          </div>
        </button>
        
        {/* User Dropdown Menu */}
        {userMenuOpen && (
          <div className="top-nav-dropdown">
            <div className="top-nav-dropdown-header">
              <p className="top-nav-dropdown-name">
                {user.name || user.usercode}
              </p>
              <p className="top-nav-dropdown-role">
                {getUserTypeLabel(user.type)}
              </p>
            </div>
            <button 
              onClick={() => {
                onChangePassword();
                setUserMenuOpen(false);
              }}
              className="top-nav-dropdown-item"
            >
              <Lock size={16} />
              <span>Change Password</span>
            </button>
            <button 
              onClick={() => {
                onLogout();
                setUserMenuOpen(false);
              }}
              className="top-nav-dropdown-item"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopNavigation;