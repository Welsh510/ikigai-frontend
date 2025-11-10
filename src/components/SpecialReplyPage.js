import React, { useEffect, useState, useCallback } from 'react';
import Layout from './Layout';
import './css/SpecialReply.css';

const SpecialReplyPage = () => {
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
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({
    keywords: ''
  });
  
  const [editCategoryForm, setEditCategoryForm] = useState({
    keywords: ''
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
		return `/api/specialReply/media/${filename}`;
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
		  const response = await fetch(`/api/specialReply/media/${filename}`);
		  
		  if (response.ok) {
			setTimeout(() => {
			  e.target.style.display = 'block';
			  e.target.src = `/api/specialReply/media/${filename}?t=${Date.now()}`;
			  
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
		
		const response = await fetch('/api/specialReply/categories');
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

		  const response = await fetch(`/api/specialReply/${deletingItem.PKKEY}`, {
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

	const validateImageFile = (file) => {
	  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
	  const maxSize = 50 * 1024 * 1024; // 50MB
	  
	  if (!allowedTypes.includes(file.type)) {
		return 'Invalid file type. Only JPG, JPEG, PNG, and GIF images are allowed.';
	  }
	  
	  if (file.size > maxSize) {
		return 'File size too large. Maximum size is 50MB.';
	  }
	  
	  return null; // Valid file
	};

	const validateVideoFile = (file) => {
	  const allowedTypes = ['video/mp4'];
	  const maxSize = 50 * 1024 * 1024; // 50MB
	  
	  if (!allowedTypes.includes(file.type)) {
		return 'Invalid file type. Only MP4 videos are allowed.';
	  }
	  
	  if (file.size > maxSize) {
		return 'File size too large. Maximum size is 50MB.';
	  }
	  
	  return null; // Valid file
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
		
		const response = await fetch('/api/specialReply/update-sequence', {
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
		console.log('❌ Reloading data due to backend sync failure');
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
		  
		  const response = await fetch('/api/specialReply');
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
	
	const handleCategoryInputChange = (e) => {
		const { name, value } = e.target;
		setCategoryForm(prev => ({
		  ...prev,
		  [name]: value
		}));
	};
	
	const handleCategorySubmit = async (e) => {
	  e.preventDefault();
	  
	  if (!categoryForm.keywords || categoryForm.keywords.trim() === '') {
		setError('Keywords are required');
		return;
	  }

	  try {
		setLoading(true);
		setError('');

		const response = await fetch('/api/specialReply/categories', {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
		  },
		  body: JSON.stringify({
			keywords: categoryForm.keywords.trim()
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

	const handleEditCategory = (category) => {
		setEditingCategory(category);
		setEditCategoryForm({
		  keywords: category.KEYWORDS || ''
		});
		setShowEditCategoryModal(true);
	};
	
	const handleEditCategoryInputChange = (e) => {
		const { name, value } = e.target;
		setEditCategoryForm(prev => ({
		  ...prev,
		  [name]: value
		}));
	};

	const handleEditCategorySubmit = async (e) => {
	  e.preventDefault();
	  
	  if (!editCategoryForm.keywords || editCategoryForm.keywords.trim() === '') {
		setError('Keywords are required');
		return;
	  }

	  try {
		setLoading(true);
		setError('');

		const response = await fetch(`/api/specialReply/categories/${editingCategory.PKKEY}`, {
		  method: 'PUT',
		  headers: {
			'Content-Type': 'application/json',
		  },
		  body: JSON.stringify({
			keywords: editCategoryForm.keywords.trim()
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

		const response = await fetch(`/api/specialReply/categories/${deletingCategory.PKKEY}`, {
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
		
		// Validate file based on type
		let validationError = null;
		if (name === 'image') {
		  validationError = validateImageFile(file);
		} else if (name === 'video') {
		  validationError = validateVideoFile(file);
		}
		
		if (validationError) {
		  setError(validationError);
		  e.target.value = ''; // Clear the input
		  if (name === 'image') {
			setEditImagePreview(null);
		  } else if (name === 'video') {
			setEditVideoPreview(null);
		  }
		  return;
		}
		
		setError(''); // Clear any previous errors
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

		  const response = await fetch(`/api/specialReply/${editingItem.PKKEY}`, {
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

      const response = await fetch('/api/specialReply/text', {
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
		
		// Validate file
		const validationError = validateImageFile(file);
		if (validationError) {
		  setError(validationError);
		  e.target.value = ''; // Clear the input
		  setImagePreview(null);
		  return;
		}
		
		setError(''); // Clear any previous errors
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

      const response = await fetch('/api/specialReply/image', {
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
		
		// Validate file
		const validationError = validateVideoFile(file);
		if (validationError) {
		  setError(validationError);
		  e.target.value = ''; // Clear the input
		  setVideoPreview(null);
		  return;
		}
		
		setError(''); // Clear any previous errors
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

      const response = await fetch('/api/specialReply/video', {
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
    
    // Reset forms
    setCategoryForm({ keywords: '' });
    setEditCategoryForm({ keywords: '' });
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
		
		loadCategories();
		loadOpeningData();
	}, []);

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
			  <h1 className="homepage-title">Keyword-triggered Reply</h1>
			</div>
			
			{/* Action Buttons */}
			<div className="filter-section">
			  <div>
				<small style={{ color: '#666', fontStyle: 'italic' }}>
				  💡 Create categories with keywords first, then add content under each category
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
						  {category.KEYWORDS}
						</h3>
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
								  🔄 Drag and drop rows to reorder items within this category
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

			{/* Category Modal */}
			{showCategoryModal && (
			  <div className="modal-overlay">
				<div className="modal-content">
				  <h2 className="modal-title">Add New Category</h2>
				  
				  {error && <div className="modal-error">{error}</div>}
				  {success && <div className="modal-success">{success}</div>}
				  
				  <form onSubmit={handleCategorySubmit}>
					<div className="form-group">
					  <label className="form-label">Keywords *</label>
					  <input
						type="text"
						name="keywords"
						value={categoryForm.keywords}
						onChange={handleCategoryInputChange}
						className="form-input"
						required
						autoComplete="off"
						disabled={loading}
						placeholder="Enter keywords to identify this category"
					  />
					  <small className="form-hint">
						Required: Keywords help identify and organize this category
					  </small>
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

			{/* Edit Category Modal */}
			{showEditCategoryModal && editingCategory && (
			  <div className="modal-overlay">
				<div className="modal-content">
				  <h2 className="modal-title">Edit Category</h2>
				  
				  {error && <div className="modal-error">{error}</div>}
				  {success && <div className="modal-success">{success}</div>}
				  
				  <form onSubmit={handleEditCategorySubmit}>
					<div className="form-group">
					  <label className="form-label">Keywords *</label>
					  <input
						type="text"
						name="keywords"
						value={editCategoryForm.keywords}
						onChange={handleEditCategoryInputChange}
						className="form-input"
						required
						autoComplete="off"
						disabled={loading}
						placeholder="Enter keywords to identify this category"
					  />
					  <small className="form-hint">
						Required: Keywords help identify and organize this category
					  </small>
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
					  <span style={{ fontWeight: 'bold', color: '#333' }}> "{deletingCategory.KEYWORDS}"</span>?</p>
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
							{category.KEYWORDS}
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
							{category.KEYWORDS}
						  </option>
						))}
					  </select>
					</div>
					
					<div className="form-group">
					  <label className="form-label">Image File *</label>
						<input
						  type="file"
						  name="image"
						  accept="image/jpeg,image/jpg,image/png,image/gif"  // Updated accept attribute
						  onChange={handleImageInputChange}
						  className="form-input"
						  required
						  disabled={loading}
						/>
						<small className="form-hint">
						  Accepted formats: JPG, JPEG, PNG, GIF only  // Updated hint text
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
							{category.KEYWORDS}
						  </option>
						))}
					  </select>
					</div>
					
					<div className="form-group">
					  <label className="form-label">Video File *</label>
						<input
						  type="file"
						  name="video"
						  accept="video/mp4"  // Updated to MP4 only
						  onChange={handleVideoInputChange}
						  className="form-input"
						  required
						  disabled={loading}
						/>
						<small className="form-hint">
						  Accepted formats: MP4 only (Max: 50MB)  // Updated hint text
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
							{category.KEYWORDS}
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
						  accept="image/jpeg,image/jpg,image/png,image/gif"  // Updated accept attribute
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
						  accept="video/mp4"  // Updated to MP4 only
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

export default SpecialReplyPage;
