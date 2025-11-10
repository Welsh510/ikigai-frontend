import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';

import HomePage from './components/HomePage';

import ChatboxPage from './components/ChatboxPage';

import ClientPage from './components/ClientPage';
import DoctorPage from './components/DoctorPage';

import CalendarPage from './components/CalendarPage';

import MasterCharacter from './components/MasterCharacter';
import MasterOpening from './components/MasterOpening';
import MasterSensitiveContent from './components/MasterSensitiveContent';
import MasterAdditionalContent from './components/MasterAdditionalContent';
import SpecialReplyPage from './components/SpecialReplyPage';

import FollowUpPage from './components/FollowUpPage';
import ScheduledMessagesPage from './components/ScheduledMessagesPage';

import UserPage from './components/UserPage';

import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, userType }) => {
  const userData = localStorage.getItem('user');
  
  if (!userData) {
    return <Navigate to="/LoginPage" replace />;
  }
  
  const user = JSON.parse(userData);
  
  // Check if user type matches required type
  
  if (userType && user.type !== userType) {
    // Redirect to appropriate home page based on user type
    /*
    if (user.type === 1) {
      return <Navigate to="/AdminHomePage" replace />;
    } else if (user.type === 2) {
      return <Navigate to="/HomePage" replace />;
    }
    */
    return <Navigate to="/HomePage" replace />;
  }
  
  return children;
};

// Public Route Component (for login page)
const PublicRoute = ({ children }) => {
  const userData = localStorage.getItem('user');
  
  if (userData) {
    const user = JSON.parse(userData);
    // Redirect to appropriate home page if already logged in
    /*
    if (user.type === 1) {
      return <Navigate to="/AdminHomePage" replace />;
    } else if (user.type === 2) {
      return <Navigate to="/HomePage" replace />;
    }*/
    return <Navigate to="/HomePage" replace />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/LoginPage" element={<PublicRoute><LoginPage /></PublicRoute>} />

          <Route path="/HomePage" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

          <Route path="/ChatboxPage" element={<ProtectedRoute><ChatboxPage /></ProtectedRoute>} />

          <Route path="/ClientPage" element={<ProtectedRoute><ClientPage /></ProtectedRoute>} />
	  	  <Route path="/DoctorPage" element={<ProtectedRoute><DoctorPage /></ProtectedRoute>} />
	  
		  <Route path="/CalendarPage" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />

          <Route path="/MasterCharacter" element={<ProtectedRoute><MasterCharacter /></ProtectedRoute>} />
          <Route path="/MasterOpening" element={<ProtectedRoute><MasterOpening /></ProtectedRoute>} />
          <Route path="/MasterSensitiveContent" element={<ProtectedRoute><MasterSensitiveContent /></ProtectedRoute>} />
          <Route path="/MasterAdditionalContent" element={<ProtectedRoute><MasterAdditionalContent /></ProtectedRoute>} />
	      <Route path="/SpecialReplyPage" element={<ProtectedRoute><SpecialReplyPage /></ProtectedRoute>} />
		
		  <Route path="/FollowUpPage" element={<ProtectedRoute><FollowUpPage /></ProtectedRoute>} />
          <Route path="/ScheduledMessagesPage" element={<ProtectedRoute><ScheduledMessagesPage /></ProtectedRoute>} />
	  
          <Route path="/UserPage" element={<ProtectedRoute><UserPage /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/LoginPage" replace />} />
          <Route path="*" element={<Navigate to="/LoginPage" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
