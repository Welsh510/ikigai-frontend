import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import './css/HomePage.css';

const HomePage = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
  }, []);

  if (!user) return null; // Layout component will handle loading state

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Dashboard</h1>
        </div>
        
        <div className="user-info-card">
          <h3 className="user-info-welcome">Welcome, {user.name || user.usercode}!</h3>
          <div className="user-info-grid">

            {/* user info items */}
            <div>
              <span className="font-medium text-gray-600">User Type:</span>
              <span className="ml-2">
                {user.type === 1 ? 'Admin User' : user.type === 2 ? 'Type 2 User' : `Type ${user.type} User`}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-600">User ID:</span>
              <span className="ml-2">{user.pkkey}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Status:</span>
              <span className="ml-2 text-green-600">
                {user.status === 1 ? 'Active' : 'Inactive'}
              </span>
            </div>
            
          </div>
        </div>
        
        <div className="features-card">
          {/* features content */}

          <h3 className="text-lg font-semibold mb-4">
            {user.type === 1 ? 'Admin Features' : `Type ${user.type} Features`}
          </h3>
          <div className="space-y-2">
            {user.type === 1 ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>User Management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>System Configuration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Reports & Analytics</span>
                </div>
              </>
            ) : user.type === 2 ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Feature 1 for Type 2 users</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Feature 2 for Type 2 users</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Feature 3 for Type 2 users</span>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span>Standard user features</span>
              </div>
            )}
          </div>

        </div>
      </div>
      
    </Layout>
  );
};

export default HomePage;