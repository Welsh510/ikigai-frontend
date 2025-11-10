import React, { useEffect, useState, useRef } from 'react';
import Layout from './Layout';
import './css/ChatboxPage.css';

const ChatboxPage = () => {
  const [user, setUser] = useState(null);
  const [platform, setPlatform] = useState('whatsapp'); // 'whatsapp' or 'facebook'
  const [whatsappSessions, setWhatsappSessions] = useState([]);
  const [facebookSessions, setFacebookSessions] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeTab, setActiveTab] = useState('appointment');
  const [shouldAutoScrollOnLoad, setShouldAutoScrollOnLoad] = useState(false);
  const [fbNameCache, setFbNameCache] = useState({});
  
  const whatsappPollingRef = useRef(null);
  const facebookPollingRef = useRef(null);

  // Auto-refresh intervals
  const messagesPollingRef = useRef(null);
  const sessionsPollingRef = useRef(null);
  const [lastMessageId, setLastMessageId] = useState(null);
  
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);
  const mediaPlayingRef = useRef(false);
  
  // Reply functionality states
  const [isRecording, setIsRecording] = useState(false);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recorderError, setRecorderError] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const waveAnimationRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const discardingRef = useRef(false);
  const recordMimeRef = useRef('audio/mpeg');
  const recordExtRef = useRef('mp3');
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(null);
  const [replyError, setReplyError] = useState(null);
 
  const [resettingFlags, setResettingFlags] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(null);
  const [resetError, setResetError] = useState(null);
  
  const [voiceEligibility, setVoiceEligibility] = useState(null);
  const [checkingVoiceEligibility, setCheckingVoiceEligibility] = useState(false);

  const [facebookUserName, setFacebookUserName] = useState(null);
  const [loadingFacebookName, setLoadingFacebookName] = useState(false);
  
  // Media upload states
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  // Add ref for messages container to enable auto-scroll
  const messagesListRef = useRef(null);
  
  // File input refs
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);

	// Platform Switch Handler
	const handlePlatformSwitch = (newPlatform) => {
	  if (newPlatform === platform) return;
	  
	  setPlatform(newPlatform);
	  
	  // Update chatSessions to show the selected platform's sessions
	  if (newPlatform === 'whatsapp') {
		setChatSessions(whatsappSessions);
	  } else {
		setChatSessions(facebookSessions);
	  }
	  
	  setSelectedSession(null);
	  setMessages([]);
	  setReplyMessage('');
	  clearMedia();
	  setReplyError(null);
	  setReplySuccess(null);
	  setShowMediaOptions(false);
	  setActiveTab('appointment');
	  
	  // Stop message polling (session polling continues for both)
	  if (messagesPollingRef.current) clearInterval(messagesPollingRef.current);
	};

  const formatPhoneNumberEnhanced = (phoneNumber, clientName = null) => {
    if (!phoneNumber) return 'Unknown';
    
    let formattedPhone = phoneNumber.replace(/^\+/, '');
    
    if (formattedPhone.startsWith('60')) {
      const withoutCountryCode = formattedPhone.substring(2);
      
      if (withoutCountryCode.length >= 9) {
        let formatted;
        
        if (withoutCountryCode.length === 9) {
          formatted = `+60 ${withoutCountryCode.substring(0, 2)}-${withoutCountryCode.substring(2, 5)} ${withoutCountryCode.substring(5)}`;
        } else if (withoutCountryCode.length === 10) {
          formatted = `+60 ${withoutCountryCode.substring(0, 3)}-${withoutCountryCode.substring(3, 6)} ${withoutCountryCode.substring(6)}`;
        } else {
          formatted = `+60 ${withoutCountryCode}`;
        }
        
        if (clientName && clientName.trim()) {
          return `${formatted}`;
        }
        
        return formatted;
      }
    }
    
    if (clientName && clientName.trim()) {
      return `${clientName.trim()} (${formattedPhone})`;
    }
    
    return formattedPhone;
  };

  const formatPhoneNumber = formatPhoneNumberEnhanced;

  // Function to reset new message count for a session
  const resetNewMessageCount = async (sessionId) => {
    try {
      const endpoint = platform === 'whatsapp' 
        ? `/api/chatboxContent/reset-new-message-count/${sessionId}`
        : `/api/chatboxContent/facebook/reset-new-message-count/${sessionId}`;
        
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to reset new message count');
        return;
      }

      setChatSessions(prevSessions => 
        prevSessions.map(session => 
          session.session_id === sessionId 
            ? { ...session, new_message_count: 0 }
            : session
        )
      );
    } catch (error) {
      console.error('Error resetting new message count:', error);
    }
  };

	const renderSessionItem = (session) => {
	  // For WhatsApp keep phone formatting; for Facebook show the resolved name only
	  const displayText = platform === 'whatsapp'
		? formatPhoneNumber(session.phone_number, session.client_name)
		: (fbNameCache[session.user_id] || 'Loading…');

	  const isRegisteredClient = platform === 'whatsapp' && session.client_name && session.client_name.trim();
	  const hasHumanReply = session.human_reply === 1;
	  const hasNewMessages = session.new_message_count > 0;

	  const latestMessageTime = session.latest_message_timestamp || session.last_activity;

	  return (
		<div
		  key={session.session_id}
		  className={`session-item ${selectedSession?.session_id === session.session_id ? 'active' : ''} ${hasHumanReply ? 'human-reply-session' : ''} ${platform}`}
		  onClick={() => handleSessionSelect(session)}
		>
		  <div className="session-header">
			<span className="phone-number">
			  {displayText}
			</span>
			{hasNewMessages && (
			  <span className="new-message-badge">
				{session.new_message_count}
			  </span>
			)}
		  </div>
		  <div className="session-meta">
			<div className="session-badges">
			  {isRegisteredClient && (
				<span className="client-badge" title="Registered Client">
				  👤 {session.client_name}
				</span>
			  )}
			</div>
			<span className="last-activity">
			  {formatDate(latestMessageTime)}
			</span>
		  </div>
		</div>
	  );
	};

  // Auto-refresh messages function
  const startMessagesPolling = () => {
    if (messagesPollingRef.current) {
      clearInterval(messagesPollingRef.current);
    }
    
    messagesPollingRef.current = setInterval(() => {
      if (selectedSession?.session_id) {
        fetchMessagesQuietly(selectedSession.session_id);
      }
    }, 3000);
  };

	const fetchMessagesQuietly = async (sessionId) => {
	  try {
		// Extra guard: if any <video>/<audio> is actively playing, skip update
		// (covers edge cases where mediaPlayingRef might not be set yet)
		const anyDomMediaPlaying = (() => {
		  const medias = document.querySelectorAll('video, audio');
		  for (const m of medias) {
			// HTMLMediaElement.paused === false means it's currently playing
			if (m && typeof m.paused === 'boolean' && !m.paused) return true;
		  }
		  return false;
		})();

		// CRITICAL: Don't update if media is currently playing
		if (mediaPlayingRef.current || anyDomMediaPlaying) {
		  console.log('Media playing → skip polling update');
		  return;
		}

		const endpoint = platform === 'whatsapp'
		  ? `/api/chatboxContent/chat-messages/${sessionId}`
		  : `/api/chatboxContent/facebook/chat-messages/${sessionId}`;

		const response = await fetch(endpoint);
		if (!response.ok) return;

		const newMessages = await response.json();

		if (Array.isArray(newMessages) && newMessages.length > 0) {
		  // SMART UPDATE: Only update if there are actual new messages
		  setMessages(prevMessages => {
			// If no previous messages, just set the new ones
			if (!prevMessages || prevMessages.length === 0) {
			  setLastMessageId(newMessages[newMessages.length - 1]?.message_id);
			  return newMessages;
			}

			// Check if we have new messages by comparing the latest IDs
			const latestNewId = newMessages[newMessages.length - 1]?.message_id;
			const latestOldId = prevMessages[prevMessages.length - 1]?.message_id;

			if (latestNewId !== latestOldId) {
			  console.log('New messages detected, updating list');
			  setLastMessageId(latestNewId);

			  // Preserve existing objects (prevents remounting existing DOM)
			  const existingIds = new Set(prevMessages.map(m => m.message_id));
			  const genuinelyNewMessages = newMessages.filter(m => !existingIds.has(m.message_id));

			  if (genuinelyNewMessages.length > 0) {
				// ✅ FIX: proper array spread to append without touching old nodes
				return [...prevMessages, ...genuinelyNewMessages];
			  }

			  // If counts differ (e.g., deletions), fall back to full replace
			  if (newMessages.length !== prevMessages.length) {
				return newMessages;
			  }
			}

			// No changes → return previous to avoid re-render
			return prevMessages;
		  });
		}
	  } catch (err) {
		console.error('Error fetching messages quietly:', err);
	  }
	};

	// Auto-refresh sessions function
	const startSessionsPolling = () => {
	  // Stop existing polling
	  if (whatsappPollingRef.current) clearInterval(whatsappPollingRef.current);
	  if (facebookPollingRef.current) clearInterval(facebookPollingRef.current);
	  
	  // Poll both platforms every 5 seconds
	  const pollBoth = () => {
		fetchBothPlatformsSessions().then(() => {
		  // Update current display based on active platform
		  if (platform === 'whatsapp') {
			setChatSessions(whatsappSessions);
		  } else {
			setChatSessions(facebookSessions);
		  }
		});
	  };
	  
	  // Start polling
	  whatsappPollingRef.current = setInterval(pollBoth, 5000);
	};

  const fetchSessionsQuietly = async () => {
    try {
      const endpoint = platform === 'whatsapp'
        ? '/api/chatboxContent/chat-sessions'
        : '/api/chatboxContent/facebook/chat-sessions';
        
      const response = await fetch(endpoint);
      
      if (!response.ok) return;
      
      const sessions = await response.json();
      
      if (Array.isArray(sessions)) {
        setChatSessions(sessions);
      }
    } catch (err) {
      console.error('Error fetching sessions quietly:', err);
    }
  };
	
	const fetchFbName = async (psid) => {
	  if (!psid || fbNameCache[psid]) return;
	  try {
		const res = await fetch(`/api/chatboxContent/facebook/user-info/${psid}`);
		if (!res.ok) return;
		const data = await res.json();
		if (data?.success && data?.name) {
		  setFbNameCache(prev => ({ ...prev, [psid]: data.name }));
		} else {
		  // Fallback: keep empty so we don't spam requests
		  setFbNameCache(prev => ({ ...prev, [psid]: 'Facebook user' }));
		}
	  } catch {
		setFbNameCache(prev => ({ ...prev, [psid]: 'Facebook user' }));
	  }
	};

	// Given an array of sessions, queue missing lookups
	const ensureFacebookNames = async (sessions) => {
	  const missing = (sessions || [])
		.map(s => s.user_id)
		.filter(Boolean)
		.filter(psid => !fbNameCache[psid]);

	  // Limit concurrency a little to be nice to the API
	  const MAX_CONCURRENCY = 4;
	  let i = 0;
	  async function worker() {
		while (i < missing.length) {
		  const psid = missing[i++];
		  await fetchFbName(psid);
		}
	  }
	  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, missing.length) }, worker));
	};
	
	useEffect(() => {
	  if (platform === 'facebook' && Array.isArray(facebookSessions) && facebookSessions.length) {
		ensureFacebookNames(facebookSessions);
	  }
	}, [platform, facebookSessions]);

  // Start polling when platform or component mounts
	useEffect(() => {
	  startSessionsPolling();
	  
	  return () => {
		if (whatsappPollingRef.current) clearInterval(whatsappPollingRef.current);
		if (facebookPollingRef.current) clearInterval(facebookPollingRef.current);
	  };
	}, []);

  // Start/stop message polling based on selected session
  useEffect(() => {
    if (selectedSession) {
      startMessagesPolling();
    } else {
      if (messagesPollingRef.current) {
        clearInterval(messagesPollingRef.current);
      }
    }
    
    return () => {
      if (messagesPollingRef.current) {
        clearInterval(messagesPollingRef.current);
      }
    };
  }, [selectedSession, platform]);

	// Add after other useEffect hooks in ChatboxPage.js
	useEffect(() => {
	  const totalNew = getTotalNewMessages();
	  
	  if (totalNew > 0) {
		document.title = `(${totalNew}) Chat Messages - ${platform === 'whatsapp' ? 'WhatsApp' : 'Facebook'}`;
	  } else {
		document.title = `Chat Messages - ${platform === 'whatsapp' ? 'WhatsApp' : 'Facebook'}`;
	  }
	  
	  return () => {
		document.title = 'Chat Messages';
	  };
	}, [chatSessions, platform]);

	useEffect(() => {
		const fetchFacebookUserName = async () => {
		  // Only fetch if platform is Facebook and session is selected
		  if (platform !== 'facebook' || !selectedSession?.user_id) {
			setFacebookUserName(null);
			return;
		  }

		  setLoadingFacebookName(true);
		  
		  try {
			const response = await fetch(`/api/chatboxContent/facebook/user-info/${selectedSession.user_id}`);
			
			if (!response.ok) {
			  console.error('Failed to fetch Facebook user name');
			  setFacebookUserName(null);
			  return;
			}

			const data = await response.json();
			
			if (data.success && data.name) {
			  setFacebookUserName(data.name);
			} else {
			  setFacebookUserName(null);
			}
		  } catch (error) {
			console.error('Error fetching Facebook user name:', error);
			setFacebookUserName(null);
		  } finally {
			setLoadingFacebookName(false);
		  }
		};

	fetchFacebookUserName();
  }, [platform, selectedSession?.user_id]);
	
  // Media handling functions
  const handleMediaSelect = (type) => {
    setShowMediaOptions(false);
    switch (type) {
      case 'image':
        imageInputRef.current?.click();
        break;
      case 'video':
        videoInputRef.current?.click();
        break;
      case 'document':
        documentInputRef.current?.click();
        break;
    }
  };

  const checkVoiceMessageEligibility = async (identifier) => {
    if (!identifier || platform !== 'whatsapp') return null;
    
    try {
      setCheckingVoiceEligibility(true);
      const response = await fetch(`/api/chatboxContent/check-voice-eligibility/${identifier}`);
      const result = await response.json();
      
      setVoiceEligibility(result);
      return result;
    } catch (error) {
      console.error('Voice eligibility check failed:', error);
      setVoiceEligibility({ 
        can_send_voice: false, 
        message: 'Failed to check voice message eligibility',
        error: error.message 
      });
      return null;
    } finally {
      setCheckingVoiceEligibility(false);
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setReplyError('File size must be less than 10MB');
      setTimeout(() => setReplyError(null), 5000);
      return;
    }

    const validTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    };

    if (!validTypes[type].includes(file.type)) {
      setReplyError(`Invalid ${type} format. Please select a valid file.`);
      setTimeout(() => setReplyError(null), 5000);
      return;
    }

    setSelectedMedia(file);
    setMediaType(type);

    if (type === 'image' || type === 'video') {
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }

    setReplyError(null);
  };

  const clearMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };
	
	const getTotalNewMessages = (platformType) => {
	  const sessions = platformType === 'whatsapp' ? whatsappSessions : facebookSessions;
	  if (!sessions || sessions.length === 0) return 0;
	  
	  return sessions.reduce((total, session) => {
		return total + (session.new_message_count || 0);
	  }, 0);
	};
	
	const fetchBothPlatformsSessions = async () => {
	  try {
		// Fetch WhatsApp sessions
		const whatsappResponse = await fetch('/api/chatboxContent/chat-sessions');
		if (whatsappResponse.ok) {
		  const whatsappData = await whatsappResponse.json();
		  setWhatsappSessions(Array.isArray(whatsappData) ? whatsappData : []);
		}
	  } catch (err) {
		console.error('Error fetching WhatsApp sessions:', err);
	  }

	  try {
		// Fetch Facebook sessions
		const facebookResponse = await fetch('/api/chatboxContent/facebook/chat-sessions');
		if (facebookResponse.ok) {
		  const facebookData = await facebookResponse.json();
		  setFacebookSessions(Array.isArray(facebookData) ? facebookData : []);
		}
	  } catch (err) {
		console.error('Error fetching Facebook sessions:', err);
	  }
	};

  const sendMediaMessage = async (overrideFile = null, overrideType = null, isVoice = false) => {
    const mediaFile = overrideFile || selectedMedia;
    const mType = overrideType || mediaType;
    if (!mediaFile || !selectedSession || uploadingMedia) return;

    try {
      setUploadingMedia(true);
      setReplyError(null);
      setReplySuccess(null);

      const formData = new FormData();
      formData.append('media', mediaFile);
      
      if (platform === 'whatsapp') {
        formData.append('phoneNumber', selectedSession.phone_number);
      } else {
        formData.append('pageId', selectedSession.page_id);
        formData.append('userId', selectedSession.user_id);
      }
      
      formData.append('sessionId', selectedSession.session_id);
      formData.append('mediaType', mType);
      formData.append('adminUser', user?.username || 'Admin');
      
      if (isVoice || mediaFile.name.includes('voice_')) {
        formData.append('isVoice', 'true');
      }
      
      if (replyMessage.trim()) {
        formData.append('caption', replyMessage.trim());
      }

      const endpoint = platform === 'whatsapp'
        ? '/api/chatboxContent/send-media'
        : '/api/chatboxContent/facebook/send-media';
        
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const textResult = await response.text();
        result = { error: 'Non-JSON response', details: textResult };
      }

      if (!response.ok) {
        throw new Error(result.details || result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setReplyMessage('');
      clearMedia();
      setReplySuccess(result.message || 'Media message sent successfully!');
      
      if (result.warning) {
        setReplySuccess(`${result.message} (${result.warning})`);
      }
      
      setTimeout(() => {
        setReplySuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Media upload error:', err.message);
      
      let errorMessage = err.message;
      
      if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Cannot connect to server.';
      } else if (err.message.includes('500')) {
        errorMessage = 'Server error: ' + err.message;
      } else if (err.message.includes('413')) {
        errorMessage = 'File too large: Maximum 10MB allowed.';
      }
      
      setReplyError(errorMessage);
      
      setTimeout(() => {
        setReplyError(null);
      }, 10000);
    } finally {
      setUploadingMedia(false);
    }
  };

  const sendMessage = async () => {
    if (selectedMedia) {
      await sendMediaMessage();
    } else {
      await sendReplyMessage();
    }
  };

  // Media preview component
  const MediaPreview = () => {
    if (!selectedMedia) return null;

    return (
      <div className="media-preview">
        <div className="media-preview-header">
          <span className="media-preview-title">
            {mediaType === 'image' && '📷 Image'}
            {mediaType === 'video' && '🎥 Video'}
            {mediaType === 'document' && '📄 Document'}
            : {selectedMedia.name}
          </span>
          <button className="media-preview-close" onClick={clearMedia}>
            ✕
          </button>
        </div>
        
        {mediaPreview && (
          <div className="media-preview-content">
            {mediaType === 'image' && (
              <img src={mediaPreview} alt="Preview" className="media-preview-image" />
            )}
            {mediaType === 'video' && (
              <video src={mediaPreview} controls className="media-preview-video" />
            )}
          </div>
        )}
        
        {mediaType === 'document' && (
          <div className="media-preview-document">
            <div className="document-icon">📄</div>
            <div className="document-info">
              <div className="document-name">{selectedMedia.name}</div>
              <div className="document-size">{(selectedMedia.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Media options dropdown
  const MediaOptions = () => {
    if (!showMediaOptions) return null;

    return (
      <>
        <div 
          className="media-options-backdrop" 
          onClick={() => setShowMediaOptions(false)}
        />
        <div className="media-options">
          <button className="media-option" onClick={() => handleMediaSelect('image')}>
            <span className="media-option-icon">📷</span>
            <span className="media-option-text">Photo</span>
          </button>
          <button className="media-option" onClick={() => handleMediaSelect('video')}>
            <span className="media-option-icon">🎥</span>
            <span className="media-option-text">Video</span>
          </button>
          <button className="media-option" onClick={() => handleMediaSelect('document')}>
            <span className="media-option-icon">📄</span>
            <span className="media-option-text">Document</span>
          </button>
        </div>
      </>
    );
  };
  
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
  }, []);

  useEffect(() => {
    if (messagesListRef.current && messages.length > 0) {
      if (shouldAutoScrollOnLoad) {
        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
        setShouldAutoScrollOnLoad(false);
      }
    }
  }, [messages, shouldAutoScrollOnLoad]);

  const getFilteredSessions = () => {
    if (!chatSessions || chatSessions.length === 0) return [];
    
    let filteredSessions = [];
    
    switch (activeTab) {
      case 'appointment':
        filteredSessions = chatSessions.filter(session => session.appointment_section === 1);
        break;
      case 'human':
        filteredSessions = chatSessions.filter(session => 
          session.human_section === 1 && session.appointment_section !== 1
        );
        break;
      case 'normal':
      default:
        filteredSessions = chatSessions.filter(session => 
          (session.appointment_section === 0 || session.appointment_section === null) && 
          (session.human_section === 0 || session.human_section === null)
        );
        break;
    }
    
    return filteredSessions.sort((a, b) => {
      const aHasNewMessages = (a.new_message_count || 0) > 0;
      const bHasNewMessages = (b.new_message_count || 0) > 0;
      
      if (aHasNewMessages && !bHasNewMessages) return -1;
      if (!aHasNewMessages && bHasNewMessages) return 1;
      
      const aTimestamp = new Date(a.latest_message_timestamp || a.last_activity || 0);
      const bTimestamp = new Date(b.latest_message_timestamp || b.last_activity || 0);
      
      return bTimestamp - aTimestamp;
    });
  };

  const getSessionCounts = () => {
    if (!chatSessions || chatSessions.length === 0) {
      return { normal: 0, appointment: 0, human: 0 };
    }
    
    const appointment = chatSessions.filter(session => session.appointment_section === 1).length;
    const human = chatSessions.filter(session => 
      session.human_section === 1 && session.appointment_section !== 1
    ).length;
    const normal = chatSessions.filter(session => 
      (session.appointment_section === 0 || session.appointment_section === null) && 
      (session.human_section === 0 || session.human_section === null)
    ).length;
    
    return { normal, appointment, human };
  };
  
  const resetSessionFlags = async () => {
    if (!selectedSession || resettingFlags) return;

    const identifier = platform === 'whatsapp' 
      ? formatPhoneNumber(selectedSession.phone_number, selectedSession.client_name)
      : formatPhoneNumber(selectedSession.user_id, selectedSession.client_name);
      
    const confirmed = window.confirm(
      `Are you sure you want to switch this conversation back to AI Reply?\n\nIdentifier: ${identifier}`
    );
    
    if (!confirmed) return;

    try {
      setResettingFlags(true);
      setResetError(null);
      setResetSuccess(null);

      const endpoint = platform === 'whatsapp'
        ? `/api/chatboxContent/reset-session-flags/${selectedSession.session_id}`
        : `/api/chatboxContent/facebook/reset-session-flags/${selectedSession.session_id}`;
        
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to reset session flags');
      }

      setResetSuccess(result.message || 'Session flags reset successfully!');
      
      setTimeout(() => {
        setResetSuccess(null);
      }, 3000);

      fetchSessionsQuietly();

    } catch (err) {
      console.error('Error resetting session flags:', err);
      setResetError(err.message);
      
      setTimeout(() => {
        setResetError(null);
      }, 5000);
    } finally {
      setResettingFlags(false);
    }
  };

  // Initial fetch of chat sessions
	useEffect(() => {
	  const fetchInitialSessions = async () => {
		try {
		  setLoading(true);
		  setError(null);
		  
		  await fetchBothPlatformsSessions();
		  
		  // Set initial display based on selected platform
		  if (platform === 'whatsapp') {
			setChatSessions(whatsappSessions);
		  } else {
			setChatSessions(facebookSessions);
		  }
		  
		} catch (err) {
		  console.error('Error fetching initial sessions:', err);
		  setError(err.message);
		} finally {
		  setLoading(false);
		}
	  };

	  fetchInitialSessions();
	}, []); // ← Only run once on mount, no dependency on [platform]
	
	useEffect(() => {
	  if (platform === 'whatsapp') {
		setChatSessions(whatsappSessions);
	  } else {
		setChatSessions(facebookSessions);
	  }
	}, [whatsappSessions, facebookSessions, platform]);

  const fetchMessages = async (sessionId) => {
    try {
      setLoadingMessages(true);
      
      const endpoint = platform === 'whatsapp'
        ? `/api/chatboxContent/chat-messages/${sessionId}`
        : `/api/chatboxContent/facebook/chat-messages/${sessionId}`;
        
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          errorData = { error: 'Unknown error', details: errorText };
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
      }
      
      const messages = await response.json();
      setMessages(Array.isArray(messages) ? messages : []);
      
      if (messages.length > 0) {
        setLastMessageId(messages[messages.length - 1].message_id);
      }
      
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReplyMessage = async () => {
    if (!replyMessage.trim() || !selectedSession || sendingReply) return;

    try {
      setSendingReply(true);
      setReplyError(null);
      setReplySuccess(null);

      const payload = {
        message: replyMessage.trim(),
        sessionId: selectedSession.session_id,
        adminUser: user?.username || 'Admin'
      };
      
      if (platform === 'whatsapp') {
        payload.phoneNumber = selectedSession.phone_number;
      } else {
        payload.pageId = selectedSession.page_id;
        payload.userId = selectedSession.user_id;
      }
      
      const endpoint = platform === 'whatsapp'
        ? '/api/chatboxContent/send-reply'
        : '/api/chatboxContent/facebook/send-reply';
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to send message');
      }

      setReplyMessage('');
      setReplySuccess(result.message || 'Message sent successfully!');
      
      if (result.warning) {
        setReplySuccess(`${result.message} (${result.warning})`);
      }
      
      setTimeout(() => {
        setReplySuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Error sending reply:', err);
      setReplyError(err.message);
      
      setTimeout(() => {
        setReplyError(null);
      }, 5000);
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReplyInputChange = (e) => {
    setReplyMessage(e.target.value);
    if (showMediaOptions) {
      setShowMediaOptions(false);
    }
  };

  // Recorder helpers (only for WhatsApp)
  const fmtTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const drawWave = () => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !analyserRef.current) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    if (!dataArrayRef.current) dataArrayRef.current = new Uint8Array(bufferLength);
    const draw = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(dataArrayRef.current);
      const width = canvas.width = canvas.clientWidth;
      const height = canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArrayRef.current[i] / 128.0;
        const y = v * height / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
      waveAnimationRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stopWave = () => {
    if (waveAnimationRef.current) cancelAnimationFrame(waveAnimationRef.current);
    waveAnimationRef.current = null;
  };

  const clearRecorderState = () => {
    setIsRecording(false);
    setIsPausedRecording(false);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    try { if (audioContextRef.current) audioContextRef.current.close(); } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    stopWave();
    try { const mr = mediaRecorderRef.current; if (mr && mr.stream) mr.stream.getTracks().forEach(t => t.stop()); } catch {}
    mediaRecorderRef.current = null;
  };
  
  const startRecording = async () => {
    if (platform !== 'whatsapp') {
      setReplyError('Voice messages are only available for WhatsApp');
      setTimeout(() => setReplyError(null), 3000);
      return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setReplyError('Microphone not available in this browser.');
      return;
    }
    
    try {
      setRecorderError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      
      if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
        options.mimeType = 'audio/ogg; codecs=opus';
        recordMimeRef.current = 'audio/ogg';
        recordExtRef.current = 'ogg';
      } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
        options.mimeType = 'audio/webm; codecs=opus';
        recordMimeRef.current = 'audio/ogg';
        recordExtRef.current = 'ogg';
      } else {
        options.mimeType = 'audio/mpeg';
        recordMimeRef.current = 'audio/mpeg';
        recordExtRef.current = 'mp3';
      }
      
      const mr = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mr;
      recordedChunksRef.current = [];
      
      mr.ondataavailable = e => { 
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data); 
        }
      };
      
      mr.onstop = () => {
        if (discardingRef.current) {
          discardingRef.current = false;
          recordedChunksRef.current = [];
          return;
        }
        
        const blob = new Blob(recordedChunksRef.current, { 
          type: recordMimeRef.current 
        });
        const url = URL.createObjectURL(blob);
        
        setRecordedBlob(blob);
        setRecordedUrl(url);
      };
      
      mr.start();
      setIsRecording(true);
      
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        drawWave();
      } catch (audioContextError) {
        console.warn('Audio visualization setup failed:', audioContextError);
      }
      
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      
    } catch (e) {
      console.error('Recording setup error:', e);
      setRecorderError(e.message || 'Failed to start recording.');
    }
  };

  const pauseRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        setIsPausedRecording(true);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (audioContextRef.current?.state === 'running') await audioContextRef.current.suspend();
      }
    } catch {}
  };

  const resumeRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setIsPausedRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
        if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
      }
    } catch {}
  };

  const stopRecording = () => {
    discardingRef.current = false;
    try {
      const mr = mediaRecorderRef.current;
      if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
        mr.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      stopWave();
      setIsRecording(false);
    } catch {}
  };

  const cancelRecording = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
        discardingRef.current = true;
        recordedChunksRef.current = [];
        mr.stop();
      }
    } catch {}
    clearRecorderState();
  };
  
  const sendRecordedAudio = async () => {
    if (!recordedBlob) return;
    try {
      const file = new File(
        [recordedBlob], 
        `voice_${Date.now()}.ogg`,
        { type: 'audio/ogg' }
      );
      
      setSelectedMedia(file);
      setMediaType('audio');
      clearRecorderState();
      await sendMediaMessage(file, 'audio', true);
    } catch (e) {
      setReplyError(e.message || 'Failed to send voice message.');
      setTimeout(() => setReplyError(null), 5000);
    }
  };

  // Icon Components
  const SendIcon = () => (
    <svg 
      className="send-icon" 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );

  const MicIcon = () => (
    <svg className="mic-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 15a3 3 0 0 0 3-3V9a3 3 0 0 0-6 0v3a3 3 0 0 0 3 3z" />
        <path d="M19 12a7 7 0 0 1-14 0" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="9" y1="21.5" x2="15" y2="21.5" />
      </g>
    </svg>
  );

  const PauseIcon = () => (<svg className="rec-icon" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>);
  const ResumeIcon = () => (<svg className="rec-icon" viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg>);
  const StopIcon = () => (<svg className="rec-icon" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>);
  const TrashIcon = () => (<svg className="rec-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>);
  
	const handleSessionSelect = (session) => {
	  // Reset media playing state when switching sessions
	  mediaPlayingRef.current = false;
	  setIsMediaPlaying(false);
	  
	  setSelectedSession(session);
	  setMessages([]);
	  setReplyMessage('');
	  clearMedia();
	  setReplyError(null);
	  setReplySuccess(null);
	  setShowMediaOptions(false);
	  setVoiceEligibility(null);
	  fetchMessages(session.session_id);
	  
	  if (session.new_message_count > 0) {
		resetNewMessageCount(session.session_id);
	  }
	  
	  if (platform === 'whatsapp' && session.phone_number) {
		checkVoiceMessageEligibility(session.phone_number);
	  }
	  
	  setShouldAutoScrollOnLoad(true);
	};
  
  const shouldShowUseAIReplyButton = () => {
    if (!selectedSession) return false;
    return selectedSession.human_reply === 1;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };
  
  const renderFormattedText = (text) => {
    if (!text) return '';
    
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    
    return lines.map((line, index) => {
      if (line.trim() === '') {
        return <div key={index} style={{ height: '1.4em' }}>&nbsp;</div>;
      }
      
      return (
        <div key={index} style={{ minHeight: '1.4em' }}>
          {line}
        </div>
      );
    });
  };

	const getMediaUrl = (filePath, mediaType, message) => {
	  console.log(`🔍 [${platform.toUpperCase()}] Getting media URL for ${mediaType}:`, {
		filePath,
		messageRole: message?.role,
		messageContent: message?.message,
		openingMessageId: message?.opening_message_id,
		messageType: message?.message_type,
		mediaUrl: message?.media_url,
		mediaFilename: message?.media_filename
	  });
	  
	  // Early return check
	  if (!filePath && !message?.message && !message?.media_url && !message?.media_filename) {
		console.log(`❌ [${platform.toUpperCase()}] No media source found - returning null`);
		return null;
	  }
	  
	  // ✅ PRIORITY 1: Opening messages from assistant (BOTH WhatsApp AND Facebook)
	  if (message?.role === 'assistant' && message?.opening_message_id) {
		let filename;
		
		if (platform === 'facebook') {
		  // Facebook stores opening message filename in media_filename column
		  filename = message.media_filename;
		} else {
		  // WhatsApp stores filename directly in message column
		  filename = message.message;
		}
		
		if (!filename) {
		  console.log(`⚠️ [${platform.toUpperCase()}] Opening message but no filename found`);
		  return null;
		}
		
		console.log(`✅ [${platform.toUpperCase()}] OPENING MESSAGE DETECTED!`, {
		  filename,
		  openingMessageId: message.opening_message_id,
		  generatedUrl: `/api/chatboxContent/media_opening/${filename}`
		});
		
		return `/api/chatboxContent/media_opening/${filename}`;
	  }
	  
	  // ✅ PRIORITY 2: Admin-sent messages from send_media folder
	  if (message?.role === 'admin') {
		console.log(`📤 [${platform.toUpperCase()}] Admin ${mediaType}:`, { filePath, mediaUrl: message?.media_url });
		
		const RAILWAY_SERVICE_URL = 'https://reactjs-appointmentwhatsapp-production.up.railway.app';
		
		if (platform === 'facebook') {
		  const mediaPath = message.media_url;
		  if (mediaPath) {
			// Skip if it's an opening message path
			if (mediaPath.startsWith('media_opening/')) {
			  console.log(`⚠️ [FACEBOOK] Unexpected media_opening path for admin message`);
			  return null;
			}
			
			if (mediaPath.startsWith('http')) {
			  console.log(`🌐 [FACEBOOK] External URL:`, mediaPath);
			  return mediaPath;
			}
			const url = `${RAILWAY_SERVICE_URL}/send_media/${mediaPath}`;
			console.log(`🌐 [FACEBOOK] Railway URL:`, url);
			return url;
		  }
		} else {
		  // WhatsApp
		  if (filePath) {
			const url = `${RAILWAY_SERVICE_URL}/send_media/${filePath}`;
			console.log(`🌐 [WHATSAPP] Railway URL:`, url);
			return url;
		  }
		}
	  }
	  
	  // ✅ PRIORITY 3: User-sent messages (from Python Railway service)
	  if (message?.role === 'user') {
		console.log(`👤 [${platform.toUpperCase()}] User ${mediaType}:`, { filePath, mediaUrl: message?.media_url });
		
		if (platform === 'facebook') {
		  const mediaPath = message.media_url;
		  if (mediaPath) {
			// Skip if it's an opening message path
			if (mediaPath.startsWith('media_opening/')) {
			  console.log(`⚠️ [FACEBOOK] Unexpected media_opening path for user message`);
			  return null;
			}
			
			if (mediaPath.startsWith('http')) {
			  console.log(`🌐 [FACEBOOK] External URL:`, mediaPath);
			  return mediaPath;
			}
			const proxyUrl = `/api/chatboxContent/${mediaType}s/${mediaPath}`;
			console.log(`🔄 [FACEBOOK] Proxy URL:`, proxyUrl);
			return proxyUrl;
		  }
		} else {
		  // WhatsApp
		  if (filePath) {
			const proxyUrl = `/api/chatboxContent/${mediaType}s/${filePath}`;
			console.log(`🔄 [WHATSAPP] Proxy URL:`, proxyUrl);
			return proxyUrl;
		  }
		}
	  }
	  
	  console.log(`❌ [${platform.toUpperCase()}] No URL could be generated`, {
		role: message?.role,
		hasOpeningId: !!message?.opening_message_id,
		hasFilePath: !!filePath,
		hasMessageContent: !!message?.message,
		hasMediaUrl: !!message?.media_url,
		hasMediaFilename: !!message?.media_filename
	  });
	  return null;
	};

	// Media viewer components - simplified versions
	const ImageViewer = ({ imageFilePath, imageFileName, mediaCaption, message }) => {
	  const [imageError, setImageError] = useState(false);
	  const [isLoading, setIsLoading] = useState(true);

	  const imageUrl = getMediaUrl(imageFilePath, 'image', message);

	  console.log('🖼️ ImageViewer rendering:', {
		imageUrl,
		imageFilePath,
		imageFileName,
		hasMessage: !!message,
		openingMessageId: message?.opening_message_id
	  });

	  if (!imageUrl) {
		console.log('❌ ImageViewer: No URL generated');
		return (
		  <div className="image-message">
			<span>🖼️ Image message (file not available)</span>
			{mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		  </div>
		);
	  }

	  const displayFileName = imageFileName || (imageFilePath ? imageFilePath.split('/').pop() : null);

	  return (
		<div className="image-message">
		  {isLoading && <div className="media-loading">Loading image...</div>}
		  {imageError ? (
			<div className="media-error">
			  <span>🖼️ Image unavailable</span>
			  {displayFileName && <p className="file-name">{displayFileName}</p>}
			  <p style={{fontSize: '11px', color: '#999'}}>URL: {imageUrl}</p>
			</div>
		  ) : (
			<img
			  src={imageUrl}
			  alt={mediaCaption || displayFileName || "Shared image"}
			  className="shared-image"
			  onLoad={() => {
				console.log('✅ Image loaded successfully:', imageUrl);
				setIsLoading(false);
			  }}
			  onError={(e) => {
				console.error('❌ Image load failed:', {
				  url: imageUrl,
				  error: e,
				  naturalWidth: e.target?.naturalWidth,
				  naturalHeight: e.target?.naturalHeight
				});
				setImageError(true);
				setIsLoading(false);
			  }}
			  style={{ display: isLoading ? 'none' : 'block' }}
			/>
		  )}
		  {mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		</div>
	  );
	};

	const VideoPlayer = ({ videoFilePath, videoFileName, mediaCaption, message }) => {
	  const [videoError, setVideoError] = useState(false);
	  const [isPlaying, setIsPlaying] = useState(false);
	  const videoRef = useRef(null);

	  // Build URL same as your helper
	  const videoUrl = getMediaUrl(videoFilePath, 'video', message);

	  // Remember progress & intent-to-play across re-renders
	  const lastTimeRef = useRef(0);
	  const shouldResumeRef = useRef(false);

	  useEffect(() => {
		const el = videoRef.current;
		if (!el) return;

		const onTimeUpdate = () => { lastTimeRef.current = el.currentTime || 0; };

		const handlePlay = () => {
		  mediaPlayingRef.current = true;
		  setIsMediaPlaying(true);
		  setIsPlaying(true);
		  shouldResumeRef.current = true;
		};

		const handlePause = () => {
		  mediaPlayingRef.current = false;
		  setIsMediaPlaying(false);
		  setIsPlaying(false);
		  shouldResumeRef.current = false;
		};

		const handleEnded = () => {
		  mediaPlayingRef.current = false;
		  setIsMediaPlaying(false);
		  setIsPlaying(false);
		  shouldResumeRef.current = false;
		  lastTimeRef.current = 0;
		};

		const handleLoadedMetadata = () => {
		  // Restore progress if element re-mounted
		  if (lastTimeRef.current > 0) {
			el.currentTime = lastTimeRef.current;
			if (shouldResumeRef.current) {
			  const playPromise = el.play?.();
			  if (playPromise?.catch) playPromise.catch(() => {});
			}
		  }
		};

		el.addEventListener('timeupdate', onTimeUpdate);
		el.addEventListener('loadedmetadata', handleLoadedMetadata);
		el.addEventListener('play', handlePlay);
		el.addEventListener('pause', handlePause);
		el.addEventListener('ended', handleEnded);

		return () => {
		  // If unmounts while playing, reset the global flag
		  if (isPlaying) {
			mediaPlayingRef.current = false;
			setIsMediaPlaying(false);
		  }
		  el.removeEventListener('timeupdate', onTimeUpdate);
		  el.removeEventListener('loadedmetadata', handleLoadedMetadata);
		  el.removeEventListener('play', handlePlay);
		  el.removeEventListener('pause', handlePause);
		  el.removeEventListener('ended', handleEnded);
		};
	  }, [isPlaying]);

	  if (!videoUrl) {
		return (
		  <div className="video-message">
			<span>🎥 Video message (file not available)</span>
			{mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		  </div>
		);
	  }

	  const displayFileName = videoFileName || (videoFilePath ? videoFilePath.split('/').pop() : null);

	  return (
		<div className="video-message">
		  {videoError ? (
			<div className="media-error">
			  <span>🎥 Video unavailable</span>
			  {displayFileName && <p className="file-name">{displayFileName}</p>}
			</div>
		  ) : (
			<video
			  ref={videoRef}
			  src={videoUrl}
			  controls
			  className="shared-video"
			  preload="metadata"
			  onError={() => setVideoError(true)}
			>
			  Your browser does not support the video tag.
			</video>
		  )}
		  {mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		</div>
	  );
	};
	
	const AudioPlayer = ({ audioFilePath, audioFileName, mediaCaption, transcribedText, message }) => {
	  const [audioError, setAudioError] = useState(false);
	  const [isLoading, setIsLoading] = useState(true);
	  const [isPlaying, setIsPlaying] = useState(false);
	  const audioRef = useRef(null);

	  const audioUrl = getMediaUrl(audioFilePath, 'audio', message);

	  // Remember progress & intent-to-play across re-renders
	  const lastTimeRef = useRef(0);
	  const shouldResumeRef = useRef(false);

	  useEffect(() => {
		const el = audioRef.current;
		if (!el) return;

		const onTimeUpdate = () => { lastTimeRef.current = el.currentTime || 0; };
		const onLoadStart = () => setIsLoading(true);
		const onLoadedData = () => setIsLoading(false);

		const handlePlay = () => {
		  mediaPlayingRef.current = true;
		  setIsMediaPlaying(true);
		  setIsPlaying(true);
		  shouldResumeRef.current = true;
		};

		const handlePause = () => {
		  mediaPlayingRef.current = false;
		  setIsMediaPlaying(false);
		  setIsPlaying(false);
		  shouldResumeRef.current = false;
		};

		const handleEnded = () => {
		  mediaPlayingRef.current = false;
		  setIsMediaPlaying(false);
		  setIsPlaying(false);
		  shouldResumeRef.current = false;
		  lastTimeRef.current = 0;
		};

		const handleLoadedMetadata = () => {
		  // Restore progress if element re-mounted
		  if (lastTimeRef.current > 0) {
			el.currentTime = lastTimeRef.current;
			if (shouldResumeRef.current) {
			  const playPromise = el.play?.();
			  if (playPromise?.catch) playPromise.catch(() => {});
			}
		  }
		};

		el.addEventListener('timeupdate', onTimeUpdate);
		el.addEventListener('loadstart', onLoadStart);
		el.addEventListener('loadeddata', onLoadedData);
		el.addEventListener('loadedmetadata', handleLoadedMetadata);
		el.addEventListener('play', handlePlay);
		el.addEventListener('pause', handlePause);
		el.addEventListener('ended', handleEnded);

		return () => {
		  if (isPlaying) {
			mediaPlayingRef.current = false;
			setIsMediaPlaying(false);
		  }
		  el.removeEventListener('timeupdate', onTimeUpdate);
		  el.removeEventListener('loadstart', onLoadStart);
		  el.removeEventListener('loadeddata', onLoadedData);
		  el.removeEventListener('loadedmetadata', handleLoadedMetadata);
		  el.removeEventListener('play', handlePlay);
		  el.removeEventListener('pause', handlePause);
		  el.removeEventListener('ended', handleEnded);
		};
	  }, [isPlaying]);

	  if (!audioUrl) {
		return (
		  <div className="audio-message">
			<span>🎵 Audio message (file not available)</span>
			{transcribedText && (
			  <div className="transcription">
				<strong>Transcription:</strong> {transcribedText}
			  </div>
			)}
			{mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		  </div>
		);
	  }

	  const displayFileName = audioFileName || (audioFilePath ? audioFilePath.split('/').pop() : null);

	  return (
		<div className="audio-message">
		  {isLoading && <div className="media-loading">Loading audio...</div>}
		  {audioError ? (
			<div className="media-error">
			  <span>🎵 Audio unavailable</span>
			  {displayFileName && <p className="file-name">{displayFileName}</p>}
			</div>
		  ) : (
			<div className="audio-player-container">
			  <audio
				ref={audioRef}
				src={audioUrl}
				controls
				className="shared-audio"
				preload="metadata"
				onError={() => {
				  setAudioError(true);
				  setIsLoading(false);
				}}
				style={{ display: isLoading ? 'none' : 'block' }}
			  >
				Your browser does not support the audio element.
			  </audio>
			  {displayFileName && <div className="audio-filename">{displayFileName}</div>}
			</div>
		  )}
		  {transcribedText && (
			<div className="transcription">
			  <strong>Transcription:</strong> {transcribedText}
			</div>
		  )}
		  {mediaCaption && <p className="media-caption">{mediaCaption}</p>}
		</div>
	  );
	};

  const DocumentViewer = ({ documentFilePath, documentFileName, documentExtractedText, mediaCaption, message }) => {
    const documentUrl = getMediaUrl(documentFilePath, 'document', message);
    
    const getFileName = (filePath, dbFileName) => {
      if (dbFileName) return dbFileName;
      if (!filePath) return 'Unknown file';
      const normalizedPath = filePath.replace(/\\/g, '/');
      return normalizedPath.split('/').pop() || 'Unknown file';
    };

    const fileName = getFileName(documentFilePath, documentFileName);
    
    const getFileIcon = (fileName) => {
      const extension = fileName.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'pdf': return '📄';
        case 'doc':
        case 'docx': return '📝';
        case 'xls':
        case 'xlsx': return '📊';
        case 'txt': return '📃';
        default: return '📄';
      }
    };

    if (!documentUrl) {
      return (
        <div className="document-message">
          <span>📄 Document message (file not available)</span>
          {mediaCaption && <p className="media-caption">{mediaCaption}</p>}
        </div>
      );
    }

    return (
      <div className="document-message">
        <div className="document-info">
          <span className="document-icon">{getFileIcon(fileName)}</span>
          <div className="document-details">
            <span className="document-name">{fileName}</span>
            <button 
              className="download-btn"
              onClick={() => {
                const link = document.createElement('a');
                link.href = documentUrl;
                link.download = fileName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              💾 Download
            </button>
          </div>
        </div>
        {mediaCaption && <p className="media-caption">{mediaCaption}</p>}
      </div>
    );
  };

	const renderEnhancedChatHeader = () => {
		if (!selectedSession) return null;
		
		// For WhatsApp, format phone number
		// For Facebook, show user name if available, otherwise show user_id
		let displayName;
		
		if (platform === 'whatsapp') {
		  displayName = formatPhoneNumber(selectedSession.phone_number, selectedSession.client_name);
		} else {
		  // Facebook: show user name with smaller user_id
		  if (facebookUserName) {
			displayName = (
			  <span>
				{facebookUserName} <span style={{ fontSize: '0.75em', color: '#EDEDED' }}>({selectedSession.user_id})</span>
			  </span>
			);
		  } else if (loadingFacebookName) {
			displayName = <span>Loading... <span style={{ fontSize: '0.75em', color: '#EDEDED' }}>({selectedSession.user_id})</span></span>;
		  } else {
			displayName = selectedSession.user_id;
		  }
		}
		
		const isRegisteredClient = platform === 'whatsapp' && selectedSession.client_name && selectedSession.client_name.trim();
		
		return (
		  <div className={`chat-header ${platform}`}>
			<div className="chat-header-info">
			  <h3>
				Chat with{' '}
				{isRegisteredClient && (
				  <span style={{ color: '#EDEDED', padding: '0px 5px', fontWeight: 'bold' }}>
					{selectedSession.client_name}
				  </span>
				)}
				{displayName}
			  </h3>
			  
			  {isMediaPlaying && (
				<div className="media-playing-indicator">
				  <span className="playing-dot"></span>
				  Media Playing - Updates Paused
				</div>
			  )}
			</div>
			
			{shouldShowUseAIReplyButton() && (
			  <div className="chat-header-actions">
				<button
				  className="reset-flags-btn"
				  onClick={resetSessionFlags}
				  disabled={resettingFlags}
				  title="Return control to AI Reply"
				>
				  {resettingFlags ? (
					<>
					  <span className="loading-spinner"></span>
					  Processing...
					</>
				  ) : (
					<>
					  Use AI Reply
					</>
				  )}
				</button>
			  </div>
			)}
		  </div>
		);
	  };

  const getEnhancedReplyPlaceholder = () => {
    if (!selectedSession) return "Type a message...";
    
    let displayName;
    if (platform === 'whatsapp') {
      displayName = formatPhoneNumber(selectedSession.phone_number, selectedSession.client_name);
    } else {
      // For Facebook, use user name if available
      displayName = facebookUserName || selectedSession.user_id;
    }
    
    return `Type a message to ${displayName}...`;
  };

  if (!user) return null;

  if (loading) {
    return (
      <Layout>
        <div className="loading">
          <div>Loading chat sessions...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="error">
          <div>Error: {error}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '10px', padding: '5px 10px' }}
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="chatbox-container">
        {/* Platform Selector */}
        <div className="platform-selector">
		  <span className="platform-selector-label">Select Platform:</span>
		  
		  <button
			className={`platform-btn ${platform === 'whatsapp' ? 'active whatsapp' : ''}`}
			onClick={() => handlePlatformSwitch('whatsapp')}
		  >
			<span className="platform-btn-text">WhatsApp</span>
			{getTotalNewMessages('whatsapp') > 0 && (
			  <span className="platform-new-badge whatsapp-badge">
				{getTotalNewMessages('whatsapp')}
			  </span>
			)}
		  </button>
		  
		  <button
			className={`platform-btn ${platform === 'facebook' ? 'active facebook' : ''}`}
			onClick={() => handlePlatformSwitch('facebook')}
		  >
			<span className="platform-btn-text">Facebook Page</span>
			{getTotalNewMessages('facebook') > 0 && (
			  <span className="platform-new-badge facebook-badge">
				{getTotalNewMessages('facebook')}
			  </span>
			)}
		  </button>
		</div>

        <div className="chatbox-main">
          {/* Sessions List */}
          <div className={`sessions-sidebar ${platform}`}>
            {/* Filter Tabs */}
            <div className="filter-tabs">
              <button
                className={`tab-button ${activeTab === 'appointment' ? 'active' : ''}`}
                onClick={() => setActiveTab('appointment')}
              >
                ({getSessionCounts().appointment}) Appointment 
              </button>
              <button
                className={`tab-button ${activeTab === 'human' ? 'active' : ''}`}
                onClick={() => setActiveTab('human')}
              >
                ({getSessionCounts().human}) Human Service 
              </button>
              <button
                className={`tab-button ${activeTab === 'normal' ? 'active' : ''}`}
                onClick={() => setActiveTab('normal')}
              >
                ({getSessionCounts().normal}) Normal 
              </button>
            </div>

            <h3>
              {activeTab === 'normal' && 'Normal Chat Sessions'}
              {activeTab === 'appointment' && 'Appointment Sessions'}
              {activeTab === 'human' && 'Human Service Sessions'}
              ({getFilteredSessions().length})
            </h3>
            
            <div className="sessions-list">
              {getFilteredSessions().length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  {activeTab === 'normal' && 'No normal chat sessions found'}
                  {activeTab === 'appointment' && 'No appointment sessions found'}
                  {activeTab === 'human' && 'No human service sessions found'}
                </div>
              ) : (
                getFilteredSessions().map((session) => renderSessionItem(session))
              )}
            </div>
          </div>

          {/* Messages Display */}
          <div className="messages-container">
            {selectedSession ? (
              <>
                {renderEnhancedChatHeader()}
                
                <div className="messages-list" ref={messagesListRef}>
				  {loadingMessages ? (
					<div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
					  Loading messages...
					</div>
				  ) : messages.length === 0 ? (
					<div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
					  No messages found for this session
					</div>
				  ) : (
					messages.map((message) => (
					  <div
						key={`${message.message_id}_${message.timestamp}`}
						className={`message ${message.role === 'user' ? 'assistant-message' : 'user-message'}`}
					  >
						<div className={`message-content ${platform} ${message.role === 'user' ? 'assistant-message' : 'user-message'}`}>
						  {message.message_type === 'text' && (
							<div style={{
							  wordWrap: 'break-word',
							  lineHeight: 1.4,
							  fontSize: '15px',
							  fontFamily: 'inherit'
							}}>
							  {renderFormattedText(message.message)}
							</div>
						  )}
						  {message.message_type === 'image' && (
							<ImageViewer 
							  imageFilePath={platform === 'facebook' ? message.media_url : message.image_file_path}
							  imageFileName={platform === 'facebook' ? message.media_filename : message.image_file_name}
							  mediaCaption={message.media_caption}
							  message={message}
							/>
						  )}
						  {message.message_type === 'video' && (
							<VideoPlayer 
							  videoFilePath={platform === 'facebook' ? message.media_url : message.video_file_path}
							  videoFileName={platform === 'facebook' ? message.media_filename : message.video_file_name}
							  mediaCaption={message.media_caption}
							  message={message}
							/>
						  )}
						  {message.message_type === 'audio' && (
							<AudioPlayer 
							  audioFilePath={platform === 'facebook' ? message.media_url : message.audio_file_path}
							  audioFileName={platform === 'facebook' ? message.media_filename : message.audio_file_name}
							  transcribedText={message.transcribed_text}
							  mediaCaption={message.media_caption}
							  message={message}
							/>
						  )}
						  {message.message_type === 'document' && (
							<DocumentViewer 
							  documentFilePath={platform === 'facebook' ? message.media_url : message.document_file_path}
							  documentFileName={platform === 'facebook' ? message.media_filename : message.document_file_name}
							  documentExtractedText={message.document_extracted_text}
							  mediaCaption={message.media_caption}
							  message={message}
							/>
						  )}
						</div>
						<div className="message-meta">
						  <span className="timestamp">{formatDate(message.timestamp)}</span>
						  <span className="role">{message.role}</span>
						</div>
					  </div>
					))
				  )}
				</div>

                {/* Reply Section */}
                <div className="reply-section">
                  <MediaPreview />
                  
                  {platform === 'whatsapp' && (isRecording || recordedBlob) && (
                    <div className="recorder-bar">
                      <div className={`rec-indicator ${isPausedRecording ? 'paused' : 'live'}`}></div>
                      <div className="rec-time">{fmtTime(recordingSeconds)}</div>
                      <div className="rec-wave-wrap">
                        <canvas ref={waveformCanvasRef} className="rec-waveform"></canvas>
                        {recordedUrl && !isRecording && (
                          <audio controls src={recordedUrl} className="rec-audio-preview"></audio>
                        )}
                      </div>
                      <div className="rec-controls">
                        <button className="rec-btn danger" onClick={cancelRecording} title={isRecording ? 'Cancel' : 'Delete'}>
                          <TrashIcon/>
                        </button>
                        {isRecording && (
                          <>
                            {isPausedRecording ? (
                              <button className="rec-btn" onClick={resumeRecording} title="Resume"><ResumeIcon/></button>
                            ) : (
                              <button className="rec-btn" onClick={pauseRecording} title="Pause"><PauseIcon/></button>
                            )}
                            <button className="rec-btn" onClick={stopRecording} title="Finish"><StopIcon/></button>
                          </>
                        )}
                        {!isRecording && recordedBlob && (
                          <button className="rec-btn primary" onClick={sendRecordedAudio} title="Send"><SendIcon/></button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`reply-input-container ${platform}`}>
                    <MediaOptions />
                    
                    <button
                      className={`media-attach-btn ${showMediaOptions ? 'active' : ''}`}
                      onClick={() => setShowMediaOptions(!showMediaOptions)}
                      disabled={sendingReply || uploadingMedia}
                      title="Attach media"
                    >
                      📎
                    </button>
                    
                    {platform === 'whatsapp' && (
                      <button
                        className={`mic-btn ${isRecording ? 'active' : ''} ${!voiceEligibility?.can_send_voice ? 'disabled' : ''}`}
                        onClick={() => { 
                          if (!isRecording && voiceEligibility?.can_send_voice) {
                            startRecording();
                          } else if (!voiceEligibility?.can_send_voice) {
                            setReplyError(voiceEligibility?.message || 'Voice messages not available');
                            setTimeout(() => setReplyError(null), 5000);
                          }
                        }}
                        disabled={sendingReply || uploadingMedia || isRecording || !voiceEligibility?.can_send_voice}
                        title={voiceEligibility?.can_send_voice ? 
                          "Record voice message" : 
                          (voiceEligibility?.message || "Voice messages unavailable")
                        }
                      >
                        <MicIcon />
                      </button>
                    )}

                    <textarea
                      className="reply-input"
                      placeholder={selectedMedia ? "Add a caption..." : getEnhancedReplyPlaceholder()}
                      value={replyMessage}
                      onChange={handleReplyInputChange}
                      onKeyPress={handleReplyKeyPress}
                      disabled={sendingReply || uploadingMedia}
                      rows="1"
                      maxLength="1000"
                      style={{
                        resize: 'none',
                        overflow: 'hidden',
                        minHeight: '20px',
                        maxHeight: '120px'
                      }}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                    />
                    <button
                      className={`send-reply-btn ${platform}`}
                      onClick={sendMessage}
                      disabled={(!replyMessage.trim() && !selectedMedia) || sendingReply || uploadingMedia}
                      title="Send message"
                    >
                      {(sendingReply || uploadingMedia) ? (
                        <span className="loading-spinner"></span>
                      ) : (
                        <SendIcon />
                      )}
                    </button>
                  </div>
                  
                  <div className="character-count">
                    {replyMessage.length}/1000 characters
                    {selectedMedia && (
                      <span className="media-indicator">
                        • {mediaType} attached ({(selectedMedia.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                    {platform === 'whatsapp' && selectedSession && voiceEligibility && (
                      <span className={`voice-status ${voiceEligibility.can_send_voice ? 'available' : 'unavailable'}`}>
                        • Voice messages: {voiceEligibility.can_send_voice ? 'Available' : 'Unavailable'}
                      </span>
                    )}
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'image')}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileChange(e, 'video')}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                    onChange={(e) => handleFileChange(e, 'document')}
                    style={{ display: 'none' }}
                  />

                  {/* Status Messages */}
                  {replySuccess && (
                    <div className="reply-status success">
                      ✅ {replySuccess}
                    </div>
                  )}
                  
                  {replyError && (
                    <div className="reply-status error">
                      ❌ {replyError}
                    </div>
                  )}

                  {resetSuccess && (
                    <div className="reset-status success" style={{
                      padding: '10px 15px',
                      margin: '10px 0',
                      backgroundColor: '#d4edda',
                      border: '1px solid #c3e6cb',
                      borderRadius: '4px',
                      color: '#155724',
                      fontSize: '14px'
                    }}>
                      ✅ {resetSuccess}
                    </div>
                  )}

                  {resetError && (
                    <div className="reset-status error" style={{
                      padding: '10px 15px',
                      margin: '10px 0',
                      backgroundColor: '#f8d7da',
                      border: '1px solid #f5c6cb',
                      borderRadius: '4px',
                      color: '#721c24',
                      fontSize: '14px'
                    }}>
                      ❌ {resetError}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-selection">
                <p>Select a chat session to view messages and send replies</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatboxPage;