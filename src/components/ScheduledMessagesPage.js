import React, { useEffect, useState, useCallback } from 'react';
import Layout from './Layout';
import './css/ScheduledMessages.css';

// ===== DATE/TIME FORMAT ENFORCEMENT UTILITY FUNCTIONS =====

// Force YYYY-MM-DD format for date inputs
const enforceDateFormat = (dateInput) => {
  if (!dateInput) return;
  
  // Set attributes to enforce format
  dateInput.setAttribute('lang', 'sv-SE'); // Swedish locale for YYYY-MM-DD
  dateInput.setAttribute('pattern', '\\d{4}-\\d{2}-\\d{2}');
  dateInput.setAttribute('placeholder', 'YYYY-MM-DD');
  dateInput.setAttribute('title', 'Format: YYYY-MM-DD (e.g., 2025-08-20)');
  dateInput.setAttribute('data-format', 'YYYY-MM-DD');
  
  // Validation event listeners
  const validateDate = (e) => {
    const value = e.target.value;
    console.log('Date input value:', value);
    
    // Validate YYYY-MM-DD format
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      e.target.setCustomValidity('Date must be in YYYY-MM-DD format');
      e.target.classList.add('invalid');
      e.target.classList.remove('valid');
    } else {
      e.target.setCustomValidity('');
      e.target.classList.remove('invalid');
      if (value) e.target.classList.add('valid');
    }
  };
  
  dateInput.addEventListener('input', validateDate);
  dateInput.addEventListener('change', validateDate);
};

// Force 24-hour format for time inputs
const enforceTimeFormat = (timeInput) => {
  if (!timeInput) return;
  
  // Set attributes to enforce 24-hour format
  timeInput.setAttribute('lang', 'en-GB'); // UK locale for 24-hour
  timeInput.setAttribute('pattern', '[0-9]{2}:[0-9]{2}');
  timeInput.setAttribute('placeholder', 'HH:MM');
  timeInput.setAttribute('title', 'Format: HH:MM (24-hour, e.g., 14:30)');
  timeInput.setAttribute('step', '60'); // Only allow hour/minute selection
  timeInput.setAttribute('data-format', 'HH:MM (24h)');
  
  // Validation event listeners
  const validateTime = (e) => {
    const value = e.target.value;
    console.log('Time input value:', value);
    
    // Validate HH:MM 24-hour format
    if (value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      e.target.setCustomValidity('Time must be in HH:MM format (24-hour)');
      e.target.classList.add('invalid');
      e.target.classList.remove('valid');
    } else {
      e.target.setCustomValidity('');
      e.target.classList.remove('invalid');
      if (value) e.target.classList.add('valid');
    }
  };
  
  timeInput.addEventListener('input', validateTime);
  timeInput.addEventListener('change', (e) => {
    validateTime(e);
    // Ensure 24-hour format
    let value = e.target.value;
    if (value) {
      // Convert to 24-hour if somehow in 12-hour format got through
      const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        let [, hours, minutes, period] = match;
        hours = parseInt(hours);
        
        if (period) {
          if (period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
        }
        
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
        e.target.value = formattedTime;
        console.log('Converted time to 24-hour:', formattedTime);
      }
    }
  });
};

// Format utilities for React state management
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  
  try {
    // Handle various input formats and convert to YYYY-MM-DD
    let normalizedDate = dateString.toString().trim();
    
    // If already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return normalizedDate;
    }
    
    // If in DD/MM/YYYY format (current issue)
    const ddmmyyyyMatch = normalizedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${year}-${month}-${day}`;
    }
    
    // If in MM/DD/YYYY format
    const mmddyyyyMatch = normalizedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try parsing as Date object (fallback)
    const date = new Date(normalizedDate);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    console.error('Could not format date:', dateString);
    return '';
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

const formatTimeForInput = (timeString) => {
  if (!timeString) return '';
  
  try {
    let normalizedTime = timeString.toString().trim();
    
    // If already in HH:MM format (24-hour)
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(normalizedTime)) {
      // Ensure leading zero for hours
      const [hours, minutes] = normalizedTime.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    
    // If in 12-hour format with AM/PM
    const ampmMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let [, hours, minutes, period] = ampmMatch;
      hours = parseInt(hours);
      
      if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    console.error('Could not format time:', timeString);
    return '';
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
};

// Apply format enforcement to all date/time inputs
const initializeDateTimeFormats = () => {
  console.log('🕐 Initializing date/time format enforcement...');
  
  // Apply to existing inputs
  document.querySelectorAll('input[type="date"]').forEach(enforceDateFormat);
  document.querySelectorAll('input[type="time"]').forEach(enforceTimeFormat);
  
  console.log('✅ Date/time format enforcement initialized');
};

// ===== MAIN REACT COMPONENT =====

const ScheduledMessagesPage = () => {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [openingData, setOpeningData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragError, setDragError] = useState(''); 
  
  // Expanded categories state for accordion
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  
  // Category states
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  
  // Drag and drop states - Enhanced for category-specific dragging
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSequenceUpdating, setIsSequenceUpdating] = useState(false);
  const [preventFormSubmission, setPreventFormSubmission] = useState(false);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Edit states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  
  // UPDATED: Form states with scheduler date and time
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    schedulerDate: '',
    schedulerTime: ''
  });
  
  const [editCategoryForm, setEditCategoryForm] = useState({
    title: '',
    schedulerDate: '',
    schedulerTime: ''
  });
  
  const [editForm, setEditForm] = useState({
    textContent: '',
    mediaName: '',
    categoryId: null,
    image: null,
    video: null
  });
  
  const [textForm, setTextForm] = useState({
    textContent: '',
    categoryId: null
  });
  
  const [imageForm, setImageForm] = useState({
    categoryId: null,
    image: null
  });
  
  const [videoForm, setVideoForm] = useState({
    categoryId: null,
    video: null
  });

  // Preview states
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editVideoPreview, setEditVideoPreview] = useState(null);
  const [videoLoadingStates, setVideoLoadingStates] = useState({});
  
  // UPDATED: Helper functions for date/time formatting with proper timezone handling
  const parseDateTime = (datetimeString) => {
    if (!datetimeString) return { date: '', time: '' };
    
    console.log('Parsing datetime:', datetimeString); // Debug log
    
    try {
      let normalizedDateTime = datetimeString.toString().trim();
      
      // Case 1: Already in correct format "yyyy-mm-dd HH:mm:ss" or "yyyy-mm-dd HH:mm"
      // Parse directly without Date object to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalizedDateTime)) {
        const [datePart, timePart] = normalizedDateTime.split(' ');
        const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
        if (timeMatch) {
          return {
            date: datePart,
            time: `${timeMatch[1]}:${timeMatch[2]}`
          };
        }
      }
      
      // Case 2: Date only format "yyyy-mm-dd"
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateTime)) {
        return {
          date: normalizedDateTime,
          time: '12:00'
        };
      }
      
      // Case 3: ISO format - manually parse to avoid timezone conversion
      if (normalizedDateTime.includes('T')) {
        const isoMatch = normalizedDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (isoMatch) {
          const [, year, month, day, hours, minutes] = isoMatch;
          return {
            date: `${year}-${month}-${day}`,
            time: `${hours}:${minutes}`
          };
        }
      }
      
      // Case 4: Fallback - return current date/time for invalid formats
      console.error('Could not parse datetime format:', datetimeString);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
      
    } catch (error) {
      console.error('Error parsing datetime:', error, 'for value:', datetimeString);
      // Return current date/time as fallback
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
    }
  };

  const formatDateTimeForSubmission = (date, time) => {
    if (!date || !time) return null;
    
    // Combine date and time into datetime string
    return `${date} ${time}:00`; // yyyy-mm-dd HH:mm:ss
  };
  
  const validateDateTime = (date, time) => {
    if (!date || !time) {
      return { valid: false, message: 'Both date and time are required' };
    }
    
    try {
      const dateTimeString = `${date} ${time}:00`;
      const dateObj = new Date(dateTimeString);
      
      if (isNaN(dateObj.getTime())) {
        return { valid: false, message: 'Invalid date or time format' };
      }
      
      // Check if the date is not in the past (optional)
      const now = new Date();
      if (dateObj < now) {
        return { 
          valid: true, // Allow past dates but warn
          message: 'Warning: Selected date/time is in the past',
          warning: true 
        };
      }
      
      return { valid: true, message: 'Valid date and time' };
    } catch (error) {
      return { valid: false, message: 'Error validating date/time' };
    }
  };

  // ENHANCED: Add safe default function
  const getSafeDefaultDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Set to noon
    
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: '12:00'
    };
  };

  const formatDateTimeForDisplay = (datetimeString) => {
    if (!datetimeString) return 'Not set';
    
    console.log('Formatting datetime for display:', datetimeString); // Debug log
    
    try {
      let normalizedDateTime = datetimeString.toString().trim();
      
      // Case 1: Already in correct format "yyyy-mm-dd HH:mm:ss" or "yyyy-mm-dd HH:mm"
      // IMPORTANT: Parse directly without creating Date object to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalizedDateTime)) {
        const parts = normalizedDateTime.split(' ');
        const [datePart, timePart] = parts;
        const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
        if (timeMatch) {
          const [, hours, minutes] = timeMatch;
          return `${datePart} ${hours}:${minutes}`;
        }
      }
      
      // Case 2: Date only format "yyyy-mm-dd"
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateTime)) {
        return `${normalizedDateTime} 12:00`;
      }
      
      // Case 3: Handle other formats WITHOUT using Date constructor to avoid timezone conversion
      // For ISO format "2024-01-01T12:00:00.000Z" or similar, manually parse
      if (normalizedDateTime.includes('T')) {
        const isoMatch = normalizedDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (isoMatch) {
          const [, year, month, day, hours, minutes] = isoMatch;
          return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
      }
      
      // Case 4: Try timestamp conversion only as last resort
      if (!isNaN(normalizedDateTime) && normalizedDateTime.length > 10) {
        // For timestamps, we need to be careful about timezone
        const timestamp = parseInt(normalizedDateTime);
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          // Use getUTCXXX methods to avoid local timezone conversion
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
      }
      
      // If all parsing attempts fail, return the original string if it looks like a valid format
      const simpleMatch = normalizedDateTime.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/);
      if (simpleMatch) {
        const [, datePart, hoursPart, minutesPart] = simpleMatch;
        const hours = hoursPart.padStart(2, '0');
        return `${datePart} ${hours}:${minutesPart}`;
      }
      
      console.error('Unable to parse datetime:', datetimeString);
      return 'Invalid date format';
      
    } catch (error) {
      console.error('DateTime formatting error:', error, 'for value:', datetimeString);
      return 'Date format error';
    }
  };

  // Helper function to get today's date in yyyy-mm-dd format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Helper function to get current time in HH:mm format (24-hour)
  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  // Helper function to get type label
  const getTypeLabel = (type) => {
    switch(type) {
      case 1: return 'Text';
      case 2: return 'Image';
      case 3: return 'Video';
      default: return 'Unknown';
    }
  };
  
  // FIXED: Updated GitHub URL function with proper error handling
  const getGitHubUrl = (filename) => {
    if (!filename) return null;
    return `/api/scheduler/media/${filename}`;
  };

  // Enhanced media URL getter
  const getCurrentMediaUrl = (item) => {
    if (item.TYPE === 2 || item.TYPE === 3) {
      if (item.MEDIANAME) {
        const githubUrl = getGitHubUrl(item.MEDIANAME);
        console.log('Generated GitHub URL:', githubUrl);
        return githubUrl;
      }
    }
    return null;
  };

  // FIXED: Image/Video error handler for broken links
  const handleMediaError = async (e, filename) => {
    console.error('Media load error for file:', filename);
    
    const isVideo = e.target.tagName === 'VIDEO';
    const isImage = e.target.tagName === 'IMG';
    
    e.target.style.display = 'none';
    
    if (e.target.parentNode.querySelector('.media-error-container')) {
      return;
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'media-error-container';
    errorDiv.style.cssText = `
      padding: 15px; 
      text-align: center; 
      color: #666; 
      border: 2px dashed #dc3545; 
      border-radius: 8px; 
      background: linear-gradient(135deg, #fff5f5, #fed7d7);
      margin: 10px 0;
      font-family: Arial, sans-serif;
      min-height: ${isVideo ? '150px' : '100px'};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `;
    
    try {
      const response = await fetch(`/api/scheduler/media/${filename}`);
      
      if (response.ok) {
        setTimeout(() => {
          e.target.style.display = 'block';
          e.target.src = `/api/scheduler/media/${filename}?t=${Date.now()}`;
          
          if (isVideo) {
            e.target.load();
          }
        }, 1000);
        
        errorDiv.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 8px; color: #007bff;">🔄</div>
          <div style="font-weight: bold; margin-bottom: 6px; color: #155724;">Retrying...</div>
          <div style="font-size: 12px; color: #975a16; margin-bottom: 8px;">${filename}</div>
        `;
        
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.remove();
          }
        }, 3000);
        
      } else {
        errorDiv.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 8px; color: #dc3545;">
            ${isVideo ? '🎥' : '⚠️'}
          </div>
          <div style="font-weight: bold; margin-bottom: 6px; color: #721c24;">
            ${isVideo ? 'Video' : 'Image'} Loading Failed
          </div>
          <div style="font-size: 12px; color: #975a16; margin-bottom: 8px;">${filename}</div>
        `;
      }
    } catch (fetchError) {
      errorDiv.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 8px; color: #dc3545;">🔌</div>
        <div style="font-weight: bold; margin-bottom: 6px; color: #721c24;">Connection Error</div>
        <div style="font-size: 12px; color: #975a16; margin-bottom: 8px;">${filename}</div>
      `;
    }
    
    e.target.parentNode.appendChild(errorDiv);
  };
  
  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/scheduler/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data.message || 'Failed to load categories');
        setCategories([]);
      }
    } catch (err) {
      setError('Error loading categories: ' + err.message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Delete handlers
  const handleDelete = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/scheduler/${deletingItem.PKKEY}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Entry deleted successfully');
        loadOpeningData();
        setTimeout(() => {
          setShowDeleteModal(false);
          setDeletingItem(null);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to delete entry');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
    setError('');
  };

  // Enhanced Drag and Drop handlers for category-specific items
  const handleDragStart = (e, categoryId, itemIndex, item) => {
    console.log('=== DRAG START ===', { categoryId, itemIndex, item: item.PKKEY });
    setDraggedItem(itemIndex);
    setDraggedCategoryId(categoryId);
    setIsDragging(true);
    setPreventFormSubmission(true);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
    
    // Store item data for cross-reference
    e.dataTransfer.setData('text/plain', JSON.stringify({
      categoryId: categoryId,
      itemIndex: itemIndex,
      itemId: item.PKKEY
    }));
    
    // Clear errors
    setError('');
    setDragError('');
  };

  const handleDragEnd = (e) => {
    console.log('=== DRAG END ===');
    e.target.style.opacity = '1';
    setDraggedItem(null);
    setDraggedCategoryId(null);
    setDragOverIndex(null);
    setIsDragging(false);
    
    // Wait a bit before allowing form submissions again
    setTimeout(() => {
      setPreventFormSubmission(false);
    }, 500);
  };

  const handleDragOver = (e, categoryId, itemIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only allow drop within same category
    if (draggedCategoryId === categoryId) {
      setDragOverIndex(itemIndex);
      e.target.closest('tr').style.borderTop = '3px solid #007bff';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = (e) => {
    e.target.closest('tr').style.borderTop = '';
    setDragOverIndex(null);
  };

  const handleDrop = async (e, categoryId, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear drag styling
    const allRows = document.querySelectorAll('.table-row');
    allRows.forEach(row => row.style.borderTop = '');
    
    console.log('=== DROP START ===', { draggedCategoryId, categoryId, draggedItem, dropIndex });
    
    if (draggedItem === null || draggedItem === dropIndex || draggedCategoryId !== categoryId) {
      console.log('Invalid drop - same position, different category, or no dragged item');
      setDragOverIndex(null);
      setIsDragging(false);
      return;
    }

    const categoryItems = getItemsForCategory(categoryId);
    
    if (!Array.isArray(categoryItems) || categoryItems.length === 0) {
      console.error('Cannot reorder: category items not available');
      setDragError('Cannot reorder: No items available in this category');
      setDragOverIndex(null);
      setIsDragging(false);
      return;
    }

    try {
      setLoading(true);
      setDragError('');
      setError('');
      setSuccess('');
      
      // Create new array with reordered items for this category only
      const newCategoryItems = [...categoryItems];
      const draggedItemData = newCategoryItems[draggedItem];
      
      // Remove and reinsert
      newCategoryItems.splice(draggedItem, 1);
      newCategoryItems.splice(dropIndex, 0, draggedItemData);
      
      // ** IMPORTANT: Update sequence numbers in the reordered items **
      const updatedCategoryItems = newCategoryItems.map((item, index) => ({
        ...item,
        SEQUENCE: index + 1  // Update sequence to match new position
      }));
      
      // Update the main openingData array with the new sequences
      const otherItems = openingData.filter(item => item.CATEGORY_ID !== categoryId);
      const updatedOpeningData = [...otherItems, ...updatedCategoryItems];
      
      // Sort by category sequence, then item sequence
      updatedOpeningData.sort((a, b) => {
        const catA = categories.find(cat => cat.PKKEY === a.CATEGORY_ID);
        const catB = categories.find(cat => cat.PKKEY === b.CATEGORY_ID);
        
        if (catA?.SEQUENCE !== catB?.SEQUENCE) {
          return (catA?.SEQUENCE || 0) - (catB?.SEQUENCE || 0);
        }
        return a.SEQUENCE - b.SEQUENCE;
      });
      
      // ** Update the state immediately with the new sequence numbers **
      setOpeningData(updatedOpeningData);
      
      // Prepare sequence updates for the backend
      const sequenceUpdates = updatedCategoryItems.map((item, index) => {
        const update = {
          pkkey: item.PKKEY,
          sequence: index + 1
        };
        
        if (!update.pkkey) {
          throw new Error(`Missing PKKEY for item at index ${index}`);
        }
        if (typeof update.sequence !== 'number' || update.sequence < 1) {
          throw new Error(`Invalid sequence for item at index ${index}: ${update.sequence}`);
        }
        
        return update;
      });
      
      const requestData = { updates: sequenceUpdates };
      const requestBody = JSON.stringify(requestData);
      
      console.log('Sending category sequence update request:', requestData);
      
      const response = await fetch('/api/scheduler/update-sequence', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: requestBody
      });

      const responseText = await response.text();
      console.log('Server response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}...`);
      }
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.success) {
        setSuccess('Items reordered successfully');
        setTimeout(() => setSuccess(''), 3000);
        console.log('✅ Frontend state updated immediately, backend sync completed');
      } else {
        throw new Error(data.message || 'Operation failed without specific error message');
      }
      
    } catch (err) {
      console.error('Sequence update error:', err);
      setDragError(`Reorder failed: ${err.message}`);
      
      // Reload to restore original order only if backend update failed
      console.log('⏳ Reloading data due to backend sync failure');
      await loadOpeningData();
    } finally {
      setLoading(false);
      setDragOverIndex(null);
      setIsDragging(false);
    }
  };

  const loadOpeningData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/scheduler');
      const data = await response.json();

      if (data.success) {
        const responseData = Array.isArray(data.data) ? data.data : [];
        setOpeningData(responseData);
      } else {
        setError(data.message || 'Failed to load opening data');
        setOpeningData([]);
      }
    } catch (err) {
      setError('Error loading opening data: ' + err.message);
      setOpeningData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // UPDATED: Handle category input changes including date and time
  const handleCategoryInputChange = (e) => {
    const { name, value } = e.target;
    
    // Enhanced date/time format conversion
    let processedValue = value;
    if (name === 'schedulerDate') {
      processedValue = formatDateForInput(value);
      console.log('📅 Date input processed:', value, '→', processedValue);
    } else if (name === 'schedulerTime') {
      processedValue = formatTimeForInput(value);
      console.log('🕐 Time input processed:', value, '→', processedValue);
    }
    
    setCategoryForm(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };
  
  // UPDATED: Handle category submission with new date/time format
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.title || categoryForm.title.trim() === '') {
      setError('Title is required');
      return;
    }

    if (!categoryForm.schedulerDate) {
      setError('Scheduler date is required');
      return;
    }

    if (!categoryForm.schedulerTime) {
      setError('Scheduler time is required');
      return;
    }

    // Validate date/time format
    const validation = validateDateTime(categoryForm.schedulerDate, categoryForm.schedulerTime);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const schedulerDateTime = formatDateTimeForSubmission(categoryForm.schedulerDate, categoryForm.schedulerTime);

      const response = await fetch('/api/scheduler/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: categoryForm.title.trim(),
          schedulerDateTime: schedulerDateTime
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Category added successfully');
        loadCategories();
        setTimeout(() => {
          setShowCategoryModal(false);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to add category');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Handle edit category with improved date/time parsing
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    const dateTimeData = parseDateTime(category.SCHEDULER_DATETIME || '');
    setEditCategoryForm({
      title: category.TITLE || '',
      schedulerDate: dateTimeData.date,
      schedulerTime: dateTimeData.time
    });
    setShowEditCategoryModal(true);
  };
  
  // UPDATED: Handle edit category input changes
  const handleEditCategoryInputChange = (e) => {
    const { name, value } = e.target;
    
    // Enhanced date/time format conversion
    let processedValue = value;
    if (name === 'schedulerDate') {
      processedValue = formatDateForInput(value);
      console.log('📅 Edit date input processed:', value, '→', processedValue);
    } else if (name === 'schedulerTime') {
      processedValue = formatTimeForInput(value);
      console.log('🕐 Edit time input processed:', value, '→', processedValue);
    }
    
    setEditCategoryForm(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // UPDATED: Handle edit category submission with new date/time format
  const handleEditCategorySubmit = async (e) => {
    e.preventDefault();
    
    if (!editCategoryForm.title || editCategoryForm.title.trim() === '') {
      setError('Title is required');
      return;
    }

    if (!editCategoryForm.schedulerDate) {
      setError('Scheduler date is required');
      return;
    }

    if (!editCategoryForm.schedulerTime) {
      setError('Scheduler time is required');
      return;
    }

    // Validate date/time format
    const validation = validateDateTime(editCategoryForm.schedulerDate, editCategoryForm.schedulerTime);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const schedulerDateTime = formatDateTimeForSubmission(editCategoryForm.schedulerDate, editCategoryForm.schedulerTime);

      const response = await fetch(`/api/scheduler/categories/${editingCategory.PKKEY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editCategoryForm.title.trim(),
          schedulerDateTime: schedulerDateTime
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Category updated successfully');
        loadCategories();
        setTimeout(() => {
          setShowEditCategoryModal(false);
          setEditingCategory(null);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to update category');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Category delete handlers
  const handleDeleteCategory = (category) => {
    setDeletingCategory(category);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/scheduler/categories/${deletingCategory.PKKEY}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Category deleted successfully');
        loadCategories();
        loadOpeningData(); // Reload items as they might be affected
        setTimeout(() => {
          setShowDeleteCategoryModal(false);
          setDeletingCategory(null);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to delete category');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Accordion functionality
  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getItemsForCategory = (categoryId) => {
    return openingData
      .filter(item => item.CATEGORY_ID === categoryId)
      .sort((a, b) => a.SEQUENCE - b.SEQUENCE);
  };
  
  const handleVideoLoadStart = (filename) => {
    console.log('🎥 Video load started:', filename);
    setVideoLoadingStates(prev => ({
      ...prev,
      [filename]: 'loading'
    }));
  };

  const handleVideoLoadedData = (filename) => {
    console.log('✅ Video loaded successfully:', filename);
    setVideoLoadingStates(prev => ({
      ...prev,
      [filename]: 'loaded'
    }));
  };

  const handleVideoError = (e, filename) => {
    console.error('❌ Video error details:', {
      filename,
      error: e.target.error,
      errorCode: e.target.error?.code,
      errorMessage: e.target.error?.message,
      src: e.target.src,
      readyState: e.target.readyState,
      networkState: e.target.networkState
    });
    
    setVideoLoadingStates(prev => ({
      ...prev,
      [filename]: 'error'
    }));

    // Don't call handleMediaError immediately, give it a chance to recover
    setTimeout(() => {
      if (e.target.error) {
        handleMediaError(e, filename);
      }
    }, 1000);
  };

  const handleVideoCanPlay = (filename) => {
    console.log('▶️ Video can play:', filename);
    setVideoLoadingStates(prev => ({
      ...prev,
      [filename]: 'ready'
    }));
  };
  
  const renderVideoWithLoading = (videoUrl, filename, style = {}) => {
    const loadingState = videoLoadingStates[filename] || 'idle';
    const showOverlay = loadingState === 'loading' || loadingState === 'idle';
    
    return (
      <div className="video-wrapper" data-state={loadingState} data-loading={showOverlay} style={{ position: 'relative', ...style }}>
        {showOverlay && (
          <div className="video-loading-overlay">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
              <div>Loading video...</div>
            </div>
          </div>
        )}
        
        <video
          src={videoUrl}
          controls
          preload="metadata"
          playsInline
          onLoadStart={() => setVideoLoadingStates(prev => ({ ...prev, [filename]: 'loading' }))}
          onLoadedData={() => setVideoLoadingStates(prev => ({ ...prev, [filename]: 'loaded' }))}
          onCanPlay={() => setVideoLoadingStates(prev => ({ ...prev, [filename]: 'ready' }))}
          onError={(e) => {
            setVideoLoadingStates(prev => ({ ...prev, [filename]: 'error' }));
            setTimeout(() => {
              if (e.target.error) {
                handleMediaError(e, filename);
              }
            }, 1000);
          }}
          style={{
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            minHeight: '150px',
            border: '2px solid #007bff',
            borderRadius: '4px',
            display: 'block',
            backgroundColor: '#000',
            objectFit: 'contain',
            ...style
          }}
        />
      </div>
    );
  };

  // FIXED: Enhanced edit handler with proper preview setup
  const handleEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      textContent: item.TEXT_CONTENT || '',
      mediaName: item.MEDIANAME || '',
      categoryId: item.CATEGORY_ID,
      image: null,
      video: null
    });
    
    if (item.TYPE === 2 && item.MEDIANAME) {
      const githubImageUrl = getGitHubUrl(item.MEDIANAME);
      setEditImagePreview(githubImageUrl);
      setEditVideoPreview(null);
    } else if (item.TYPE === 3 && item.MEDIANAME) {
      const githubVideoUrl = getGitHubUrl(item.MEDIANAME) + `?t=${Date.now()}`;
      setEditVideoPreview(githubVideoUrl);
      setEditImagePreview(null);
    } else {
      setEditImagePreview(null);
      setEditVideoPreview(null);
    }
    
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value, files } = e.target;
    
    if (files && files[0]) {
      const file = files[0];
      setEditForm(prev => ({
        ...prev,
        [name]: file
      }));
      
      const fileUrl = URL.createObjectURL(file);
      if (name === 'image') {
        setEditImagePreview(fileUrl);
      } else if (name === 'video') {
        setEditVideoPreview(fileUrl);
      }
    } else {
      setEditForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!editForm.categoryId) {
      setError('Category is required');
      return;
    }

    if (editingItem.TYPE === 1 && !editForm.textContent) {
      setError('Text content is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('categoryId', editForm.categoryId);
      
      if (editingItem.TYPE === 1) {
        formData.append('textContent', editForm.textContent);
      } else if (editingItem.TYPE === 2 && editForm.image) {
        formData.append('image', editForm.image);
      } else if (editingItem.TYPE === 3 && editForm.video) {
        formData.append('video', editForm.video);
      }

      const response = await fetch(`/api/scheduler/${editingItem.PKKEY}`, {
        method: 'PUT',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Entry updated successfully');
        setEditingItem(null);
        loadOpeningData();
        setTimeout(() => {
          setShowEditModal(false);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to update entry');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Text form handlers
  const handleTextInputChange = (e) => {
    const { name, value } = e.target;
    setTextForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    
    if (!textForm.textContent || !textForm.categoryId) {
      setError('Please fill in all fields including category');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/scheduler/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textForm)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Text entry added successfully');
        loadOpeningData();
        setTimeout(() => {
          setShowTextModal(false);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to add text entry');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Image form handlers
  const handleImageInputChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'image' && files && files[0]) {
      const file = files[0];
      setImageForm(prev => ({
        ...prev,
        [name]: file
      }));
      
      const fileUrl = URL.createObjectURL(file);
      setImagePreview(fileUrl);
    } else {
      setImageForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    
    if (!imageForm.image || !imageForm.categoryId) {
      setError('Please fill in all fields including category');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('categoryId', imageForm.categoryId);
      formData.append('image', imageForm.image);

      const response = await fetch('/api/scheduler/image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Image entry added successfully');
        loadOpeningData();
        setTimeout(() => {
          setShowImageModal(false);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to add image entry');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Video form handlers
  const handleVideoInputChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'video' && files && files[0]) {
      const file = files[0];
      setVideoForm(prev => ({
        ...prev,
        [name]: file
      }));
      
      const fileUrl = URL.createObjectURL(file);
      setVideoPreview(fileUrl);
    } else {
      setVideoForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoForm.video || !videoForm.categoryId) {
      setError('Please fill in all fields including category');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('categoryId', videoForm.categoryId);
      formData.append('video', videoForm.video);

      const response = await fetch('/api/scheduler/video', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Video entry added successfully');
        loadOpeningData();
        setTimeout(() => {
          setShowVideoModal(false);
          setSuccess('');
        }, 700);
      } else {
        setError(data.message || 'Failed to add video entry');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setShowCategoryModal(false);
    setShowTextModal(false);
    setShowImageModal(false);
    setShowVideoModal(false);
    setShowEditCategoryModal(false);
    setShowEditModal(false);
    setShowDeleteCategoryModal(false);
    setShowDeleteModal(false);
    
    setError('');
    setSuccess('');
    
    // UPDATED: Reset forms with new structure
    setCategoryForm({ title: '', schedulerDate: '', schedulerTime: '' });
    setEditCategoryForm({ title: '', schedulerDate: '', schedulerTime: '' });
    setTextForm({ textContent: '', categoryId: null });
    setImageForm({ categoryId: null, image: null });
    setVideoForm({ categoryId: null, video: null });
    setEditForm({ textContent: '', categoryId: null, image: null, video: null });
    
    setEditingCategory(null);
    setEditingItem(null);
    setDeletingCategory(null);
    setDeletingItem(null);
    
    // Clear previews
    setImagePreview(null);
    setVideoPreview(null);
    setEditImagePreview(null);
    setEditVideoPreview(null);
  };

  // Enhanced useEffect with date/time format enforcement
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('user');
      }
    }
    
    // Initialize date/time format enforcement
    initializeDateTimeFormats();
    
    loadCategories();
    loadOpeningData();
  }, []);

  // Additional useEffect for modal format enforcement
  useEffect(() => {
    // Re-apply format enforcement when modals open
    const applyFormatsToModals = () => {
      setTimeout(() => {
        document.querySelectorAll('input[type="date"]').forEach(enforceDateFormat);
        document.querySelectorAll('input[type="time"]').forEach(enforceTimeFormat);
      }, 100);
    };
    
    applyFormatsToModals();
  }, [showCategoryModal, showEditCategoryModal]);

  if (!user) {
    return (
      <Layout>
        <div className="homepage-container">
          <div className="loading-message">Please log in to access this page</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Scheduler Control</h1>
        </div>
        
        {/* Action Buttons */}
        <div className="filter-section">
          <div>
            <small style={{ color: '#666', fontStyle: 'italic' }}>
              💡 Create categories with titles and scheduling date/time first, then add content under each category
            </small>
          </div>
          <div className="action-buttons">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="new-button category-button"
              style={{ marginRight: '10px' }}
              disabled={loading}
            >
              Add Category
            </button>
            <button
              onClick={() => setShowTextModal(true)}
              className="new-button"
              style={{ marginRight: '10px' }}
              disabled={loading || categories.length === 0}
            >
              Add Text
            </button>
            <button
              onClick={() => setShowImageModal(true)}
              className="new-button"
              style={{ marginRight: '10px' }}
              disabled={loading || categories.length === 0}
            >
              Add Image
            </button>
            <button
              onClick={() => setShowVideoModal(true)}
              className="new-button"
              disabled={loading || categories.length === 0}
            >
              Add Video
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {loading && <div className="loading-message">Loading...</div>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        {dragError && <div className="error-message">{dragError}</div>}

        {/* Categories and Content */}
        <div className="categories-container">
          {Array.isArray(categories) && categories.length > 0 ? (
            categories.map((category) => (
              <div key={category.PKKEY} className="category-section">
                <div className="category-header" onClick={() => toggleCategory(category.PKKEY)}>
                  <div className="category-info">
                    <h3 className="category-title">
                      <span className="expand-icon">
                        {expandedCategories.has(category.PKKEY) ? '▼' : '▶'}
                      </span>
                      {category.TITLE}
                    </h3>
                    <div className="category-meta">
                      <span className="category-time category-datetime-display">
                        {formatDateTimeForDisplay(category.SCHEDULER_DATETIME)}
                      </span>
                    </div>
                  </div>
                  <div className="category-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCategory(category);
                      }}
                      className="edit-button"
                      style={{ marginRight: '5px' }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(category);
                      }}
                      className="delete-button"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {expandedCategories.has(category.PKKEY) && (
                  <div className="category-content">
                    <div className="items-table-container">
                      {getItemsForCategory(category.PKKEY).length > 0 ? (
                        <>
                          {/* Drag & Drop Instructions */}
                          <div className="drag-instructions">
                            <small style={{ color: '#666', fontStyle: 'italic', display: 'block', marginBottom: '10px' }}>
                              📄 Drag and drop rows to reorder items within this category
                            </small>
                          </div>
                          
                          <table className="items-table">
                            <thead>
                              <tr className="table-header">
                                <th style={{ width: '60px' }}>No.</th>
                                <th style={{ width: '100px' }}>Type</th>
                                <th>Content</th>
                                <th style={{ width: '180px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getItemsForCategory(category.PKKEY).map((item, index) => (
                                <tr 
                                  key={item.PKKEY} 
                                  className={`table-row draggable-row ${isDragging && draggedCategoryId === category.PKKEY && draggedItem === index ? 'dragging' : ''}`}
                                  draggable="true"
                                  onDragStart={(e) => handleDragStart(e, category.PKKEY, index, item)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(e, category.PKKEY, index)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, category.PKKEY, index)}
                                  style={{
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <td className="table-cell drag-handle">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <span style={{ marginRight: '8px', color: '#999', fontSize: '12px' }}>⋮⋮</span>
                                      {index + 1}.
                                    </div>
                                  </td>
                                  <td className="table-cell">{getTypeLabel(item.TYPE)}</td>
                                  <td className="table-cell" style={{ fontWeight: '500' }}>
                                    {item.TYPE === 1 && item.TEXT_CONTENT ? (
                                      <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.TEXT_CONTENT}
                                      </div>
                                    ) : item.TYPE === 2 || item.TYPE === 3 ? (
                                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                                        {item.MEDIANAME || 'Media file'}
                                      </div>
                                    ) : (
                                      'No content'
                                    )}
                                  </td>
                                  <td className="table-cell">
                                    <div className="action-buttons-inline">
                                      <button
                                        onClick={() => handleEdit(item)}
                                        className="edit-button-sm"
                                        disabled={loading}
                                        title="Edit item"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDelete(item)}
                                        className="delete-button-sm"
                                        disabled={loading}
                                        title="Delete item"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : (
                        <div className="no-items-message">
                          No content items in this category yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            !loading && (
              <div className="no-categories-message">
                No categories found. Create a category first to organize your content.
              </div>
            )
          )}
        </div>

        {/* UPDATED: Category Modal with Enhanced Date/Time Fields */}
        {showCategoryModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Add New Category</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleCategorySubmit}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={categoryForm.title}
                    onChange={handleCategoryInputChange}
                    className="form-input"
                    required
                    autoComplete="off"
                    disabled={loading}
                    placeholder="Enter category title"
                  />
                </div>

                <div className="datetime-input-group">
                  <div className="form-group">
                    <label className="form-label" htmlFor="schedulerDate">
					  📅 Scheduler Date *
					</label>
					<input
					  id="schedulerDate"
					  type="date"
					  name="schedulerDate"
					  value={categoryForm.schedulerDate}
					  onChange={handleCategoryInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					  min={getTodayDate()}
					  
					  // ENHANCED FORMAT ENFORCEMENT ATTRIBUTES FOR yyyy/mm/dd
					  lang="ja-JP"
					  pattern="\d{4}/\d{2}/\d{2}"
					  placeholder="yyyy/mm/dd"
					  title="Format: yyyy/mm/dd (e.g., 2025/08/20)"
					  data-format="yyyy/mm/dd"
					  data-locale="ja-JP"
					  
					  // Additional validation
					  onFocus={(e) => {
						console.log('📅 Date input focused, current value:', e.target.value);
						enforceDateFormat(e.target);
					  }}
					  onBlur={(e) => {
						console.log('📅 Date input blurred, final value:', e.target.value);
						if (e.target.value && !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
						  console.error('❌ Date format is incorrect!');
						  setError('Date must be in yyyy/mm/dd format');
						}
					  }}
					  
					  style={{
						fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
						letterSpacing: '1px',
						fontWeight: '600',
						fontSize: '0.875rem'
					  }}
					/>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="schedulerTime">
                      🕐 Scheduler Time *
                    </label>
                    <input
					  id="schedulerTime"
					  type="time"
					  name="schedulerTime"
					  value={categoryForm.schedulerTime}
					  onChange={handleCategoryInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					  
					  // ENHANCED FORMAT ENFORCEMENT ATTRIBUTES FOR 24-HOUR
					  lang="en-GB"
					  step="60"
					  pattern="[0-9]{2}:[0-9]{2}"
					  placeholder="HH:MM"
					  title="Format: HH:MM (24-hour, e.g., 14:30)"
					  data-format="HH:MM (24h)"
					  data-locale="en-GB"
					  
					  // Additional validation
					  onFocus={(e) => {
						console.log('🕐 Time input focused, current value:', e.target.value);
						enforceTimeFormat(e.target);
					  }}
					  onBlur={(e) => {
						console.log('🕐 Time input blurred, final value:', e.target.value);
						if (e.target.value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(e.target.value)) {
						  console.error('❌ Time format is incorrect!');
						  setError('Time must be in HH:MM format (24-hour)');
						}
					  }}
					  
					  style={{
						fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
						letterSpacing: '1px',
						fontWeight: '600',
						fontSize: '0.875rem'
					  }}
					/>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* UPDATED: Edit Category Modal with Enhanced Date/Time Fields */}
        {showEditCategoryModal && editingCategory && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Edit Category</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleEditCategorySubmit}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={editCategoryForm.title}
                    onChange={handleEditCategoryInputChange}
                    className="form-input"
                    required
                    autoComplete="off"
                    disabled={loading}
                    placeholder="Enter category title"
                  />
                </div>

                <div className="datetime-input-group">
                  <div className="form-group">
                    <label className="form-label" htmlFor="editSchedulerDate">
                      📅 Scheduler Date *
                    </label>
                    <input
					  id="editSchedulerDate"
					  type="date"
					  name="schedulerDate"
					  value={editCategoryForm.schedulerDate}
					  onChange={handleEditCategoryInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					  min={getTodayDate()}
					  
					  // ENHANCED FORMAT ENFORCEMENT ATTRIBUTES FOR yyyy/mm/dd
					  lang="ja-JP"
					  pattern="\d{4}/\d{2}/\d{2}"
					  placeholder="yyyy/mm/dd"
					  title="Format: yyyy/mm/dd (e.g., 2025/08/20)"
					  data-format="yyyy/mm/dd"
					  data-locale="ja-JP"
					  
					  onFocus={(e) => {
						console.log('📅 Edit date input focused, current value:', e.target.value);
						enforceDateFormat(e.target);
					  }}
					  onBlur={(e) => {
						console.log('📅 Edit date input blurred, final value:', e.target.value);
						if (e.target.value && !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
						  console.error('❌ Date format is incorrect!');
						  setError('Date must be in yyyy/mm/dd format');
						}
					  }}
					  
					  style={{
						fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
						letterSpacing: '1px',
						fontWeight: '600',
						fontSize: '0.875rem'
					  }}
					/>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="editSchedulerTime">
                      🕐 Scheduler Time *
                    </label>
                    <input
					  id="editSchedulerTime"
					  type="time"
					  name="schedulerTime"
					  value={editCategoryForm.schedulerTime}
					  onChange={handleEditCategoryInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					  
					  // ENHANCED FORMAT ENFORCEMENT ATTRIBUTES FOR 24-HOUR
					  lang="en-GB"
					  step="60"
					  pattern="[0-9]{2}:[0-9]{2}"
					  placeholder="HH:MM"
					  title="Format: HH:MM (24-hour, e.g., 14:30)"
					  data-format="HH:MM (24h)"
					  data-locale="en-GB"
					  
					  onFocus={(e) => {
						console.log('🕐 Edit time input focused, current value:', e.target.value);
						enforceTimeFormat(e.target);
					  }}
					  onBlur={(e) => {
						console.log('🕐 Edit time input blurred, final value:', e.target.value);
						if (e.target.value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(e.target.value)) {
						  console.error('❌ Time format is incorrect!');
						  setError('Time must be in HH:MM format (24-hour)');
						}
					  }}
					  
					  style={{
						fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
						letterSpacing: '1px',
						fontWeight: '600',
						fontSize: '0.875rem'
					  }}
					/>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Category Modal */}
        {showDeleteCategoryModal && deletingCategory && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <h2 className="modal-title">Confirm Delete Category</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <div style={{ marginBottom: '20px' }}>
                <p>Are you sure you want to delete the category 
                  <span style={{ fontWeight: 'bold', color: '#333' }}> "{deletingCategory.TITLE}"</span>?</p>
                <p style={{ color: '#dc3545', fontSize: '14px', marginTop: '10px' }}>
                  ⚠️ This will also delete all content items in this category!
                </p>
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteCategoryModal(false);
                    setDeletingCategory(null);
                  }}
                  className="cancel-button"
                  disabled={loading}
                  style={{ marginRight: '10px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  className="submit-button"
                  disabled={loading}
                  style={{
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545'
                  }}
                >
                  {loading ? 'Deleting...' : 'Delete Category'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Text Modal */}
        {showTextModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Add Text Entry</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleTextSubmit}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    name="categoryId"
                    value={textForm.categoryId || ''}
                    onChange={handleTextInputChange}
                    className="form-input"
                    required
                    disabled={loading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.PKKEY} value={category.PKKEY}>
                        {category.TITLE} - {formatDateTimeForDisplay(category.SCHEDULER_DATETIME)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Text Content *</label>
                  <textarea
                    name="textContent"
                    value={textForm.textContent}
                    onChange={handleTextInputChange}
                    className="form-textarea"
                    rows="5"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Text'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Image Modal */}
        {showImageModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Add Image Entry</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleImageSubmit}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    name="categoryId"
                    value={imageForm.categoryId || ''}
                    onChange={handleImageInputChange}
                    className="form-input"
                    required
                    disabled={loading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.PKKEY} value={category.PKKEY}>
                        {category.TITLE} - {formatDateTimeForDisplay(category.SCHEDULER_DATETIME)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Image File *</label>
					<input
					  type="file"
					  name="image"
					  accept="image/jpeg,image/jpg,image/png,image/gif"
					  // Remove image/webp from accept attribute
					  onChange={handleImageInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					/>
                  <small className="form-hint">
                    Accepted formats: JPEG, PNG, GIF
                  </small>
                  
                  {imagePreview && (
                    <div className="preview-container" style={{ marginTop: '10px' }}>
                      <label className="form-label">Preview:</label>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          objectFit: 'contain',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          display: 'block'
                        }} 
                      />
                    </div>
                  )}
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Uploading...' : 'Add Image'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Video Modal */}
        {showVideoModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Add Video Entry</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleVideoSubmit}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    name="categoryId"
                    value={videoForm.categoryId || ''}
                    onChange={handleVideoInputChange}
                    className="form-input"
                    required
                    disabled={loading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.PKKEY} value={category.PKKEY}>
                        {category.TITLE} - {formatDateTimeForDisplay(category.SCHEDULER_DATETIME)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Video File *</label>
					<input
					  type="file"
					  name="video"
					  accept="video/mp4"
					  // Replace with only MP4 support
					  onChange={handleVideoInputChange}
					  className="form-input"
					  required
					  disabled={loading}
					/>
                  <small className="form-hint">
                    Accepted formats: MP4 only (Max: 50MB)
                  </small>
                  
                  {videoPreview && (
                    <div className="preview-container" style={{ marginTop: '10px' }}>
                      <label className="form-label">Preview:</label>
                      {renderVideoWithLoading(videoPreview, 'new-video-preview', { maxWidth: '300px', maxHeight: '200px' })}
                    </div>
                  )}
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Uploading...' : 'Add Video'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingItem && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Edit {getTypeLabel(editingItem.TYPE)} Entry</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <form onSubmit={handleEditSubmit}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    name="categoryId"
                    value={editForm.categoryId || ''}
                    onChange={handleEditInputChange}
                    className="form-input"
                    required
                    disabled={loading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.PKKEY} value={category.PKKEY}>
                        {category.TITLE} - {formatDateTimeForDisplay(category.SCHEDULER_DATETIME)}
                      </option>
                    ))}
                  </select>
                </div>

                {editingItem.TYPE === 1 && (
                  <div className="form-group">
                    <label className="form-label">Text Content *</label>
                    <textarea
                      name="textContent"
                      value={editForm.textContent}
                      onChange={handleEditInputChange}
                      className="form-textarea"
                      rows="5"
                      required
                      disabled={loading}
                    />
                  </div>
                )}
                
                {editingItem.TYPE === 2 && (
                  <div className="form-group">
                    <label className="form-label">Replace Image (Optional)</label>
                    <input
					  type="file"
					  name="image"
					  accept="image/jpeg,image/jpg,image/png,image/gif"
					  onChange={handleEditInputChange}
					  className="form-input"
					  disabled={loading}
					/>
                    <small className="form-hint">
                      Leave empty to keep current image
                    </small>
                    
                    {editImagePreview && (
                      <div className="preview-container" style={{ marginTop: '10px' }}>
                        <label className="form-label">Current/Preview Image:</label>
                        <img 
                          src={editImagePreview} 
                          alt="Preview" 
                          onError={(e) => handleMediaError(e, editingItem.MEDIANAME)}
                          style={{ 
                            maxWidth: '200px', 
                            maxHeight: '200px', 
                            objectFit: 'contain',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            display: 'block'
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {editingItem.TYPE === 3 && (
                  <div className="form-group">
                    <label className="form-label">Replace Video (Optional)</label>
                    <input
					  type="file"
					  name="video"
					  accept="video/mp4"
					  onChange={handleEditInputChange}
					  className="form-input"
					  disabled={loading}
					/>
                    <small className="form-hint">
                      Leave empty to keep current video
                    </small>
                    
                    {editVideoPreview && (
                      <div className="preview-container" style={{ marginTop: '10px' }}>
                        <label className="form-label">Current/Preview Video:</label>
                        {renderVideoWithLoading(editVideoPreview, editingItem.MEDIANAME || 'edit-preview', { maxWidth: '300px', maxHeight: '200px' })}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="cancel-button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Updating..' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Item Modal */}
        {showDeleteModal && deletingItem && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <h2 className="modal-title">Confirm Delete</h2>
              
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}
              
              <div style={{ marginBottom: '20px' }}>
                <p>Are you sure you want to delete this 
                  {getTypeLabel(deletingItem.TYPE).toLowerCase()} entry?</p>
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingItem(null);
                  }}
                  className="cancel-button"
                  disabled={loading}
                  style={{ marginRight: '10px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="submit-button"
                  disabled={loading}
                  style={{
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545'
                  }}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ScheduledMessagesPage;