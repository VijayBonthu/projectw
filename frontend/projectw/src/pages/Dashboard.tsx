import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import * as marked from 'marked'; // Change to namespace import
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL;

// Define types for our data structures
interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
  document_id: string;
}

interface Recommendation {
  tech_stack: string[];
  developers_required: {
    role: string;
    count: number;
    skills: string[];
  }[];
  ambiguities: string[];
  summary: string;
}

// Enhanced types for conversation data
interface ConversationMetadata {
  chat_history_id: string;
  title: string;
  modified_at: string;
  document_id?: string;
}

interface GroupedConversations {
  today: ConversationMetadata[];
  yesterday: ConversationMetadata[];
  lastWeek: ConversationMetadata[];
  older: ConversationMetadata[];
}

const ProfileMenu = ({ user, logout, sidebarExpanded }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  // Get user email from localStorage
  const userEmail = localStorage.getItem('user_email') || 'user@example.com';
  const userName = userEmail.split('@')[0];
  const userInitials = getInitials(userName);
  
  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`flex items-center rounded-lg transition-colors hover:bg-white/5
          ${sidebarExpanded ? 'w-full space-x-3 p-3' : 'w-10 h-10 justify-center mx-auto'}`}
        title={!sidebarExpanded ? "Account menu" : ""}
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">{userInitials}</span>
        </div>
        
        {sidebarExpanded && (
          <>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </>
        )}
      </button>
      
      {/* Dropdown menu */}
      {isMenuOpen && (
        <div className={`bg-gray-800 rounded-lg shadow-lg border border-white/10 overflow-hidden
          ${sidebarExpanded 
            ? 'absolute bottom-full left-0 mb-2 w-full' 
            : 'fixed bottom-[70px] left-16 mb-2 w-48'}`}
        >
          <div className="py-1">
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Account Settings
            </button>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Help Center
            </button>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Give Feedback
            </button>
            <hr className="border-white/10 my-1" />
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center"
              onClick={() => {
                logout();
                setIsMenuOpen(false);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [fileProgresses, setFileProgresses] = useState<{[key: string]: number}>({});
  const [isUploading, setIsUploading] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [groupedConversations, setGroupedConversations] = useState<GroupedConversations>({
    today: [],
    yesterday: [],
    lastWeek: [],
    older: []
  });
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [renamingConversation, setRenamingConversation] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showUploadUI, setShowUploadUI] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      // Fetch existing conversations
      fetchConversations();
    }
  }, [isAuthenticated, navigate]);

  // Simplify the resize effect
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modified scrollToBottom function for better scroll behavior
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom when new messages arrive or conversation changes
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  // Fetch user's conversations with full content
  const fetchConversations = async () => {
    try {
      // Get the token for authentication
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('regular_token') || 
                  localStorage.getItem('google_auth_token');
    
    if (!token) {
        console.error("No token found");
        return;
      }
      
      // Set the authorization header explicitly
      const response = await axios.get(`${API_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.user_details) {
        // Sort conversations by modified_at descending (newest first)
        const sortedConversations = [...response.data.user_details].sort((a, b) => 
          new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
        );
        
        // Group conversations by date
        const grouped = groupConversationsByDate(sortedConversations);
        setGroupedConversations(grouped);
        
        // Update the old conversations array for the collapsed sidebar
        // Only show the 5 most recent conversations in collapsed view
        const conversationsArray = sortedConversations.slice(0, 5).map(conv => ({
          id: conv.chat_history_id,
          title: conv.title,
          created_at: conv.modified_at,
          messages: [],
          document_id: conv.document_id || ''
        }));
        
        setConversations(conversationsArray);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Helper function to group conversations by time period
  const groupConversationsByDate = (conversations: ConversationMetadata[]): GroupedConversations => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    return {
      today: conversations.filter(conv => new Date(conv.modified_at) >= today),
      yesterday: conversations.filter(conv => {
        const date = new Date(conv.modified_at);
        return date >= yesterday && date < today;
      }),
      lastWeek: conversations.filter(conv => {
        const date = new Date(conv.modified_at);
        return date >= lastWeekStart && date < yesterday;
      }),
      older: conversations.filter(conv => new Date(conv.modified_at) < lastWeekStart)
    };
  };

  // Add this function to remove a file from the files array
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Add helper function to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Create simple FileIcon component based on file type
  const FileIcon = ({ type }: { type: string }) => {
    // Choose icon based on file type
    let iconPath;
    
    if (type.includes('pdf')) {
      iconPath = (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      );
    } else if (type.includes('powerpoint') || type.includes('presentation')) {
      iconPath = (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      );
    } else if (type.includes('csv')) {
      iconPath = (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      );
      } else {
      // Default document icon
      iconPath = (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      );
    }
    
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {iconPath}
      </svg>
    );
  };

  // Create TrashIcon component
  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  // Update handleFileChange to properly validate files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Validate files (size and type)
      const validFiles = newFiles.filter(file => {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File "${file.name}" exceeds the 10MB limit.`);
          return false;
        }
        
        // Check file type
        const fileType = file.type;
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        
        const isValidType = 
          fileType.includes('pdf') || 
          fileType.includes('powerpoint') || 
          fileType.includes('text/plain') || 
          fileType.includes('text/csv') ||
          fileExtension === 'pdf' ||
          fileExtension === 'ppt' ||
          fileExtension === 'pptx' ||
          fileExtension === 'txt' ||
          fileExtension === 'csv';
          
        if (!isValidType) {
          setError(`File "${file.name}" has an unsupported format.`);
          return false;
        }
        
        return true;
      });
      
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Replace instances of this problematic code:
  // localStorage.setItem('user_id', userId);

  // With this safer version that handles the null case:
  const decodeTokenAndSaveUserId = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/decode_token/${token}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.id) {
        const userId = response.data.id;
        // Store for future use with null check
        if (userId) {
          localStorage.setItem('user_id', userId);
        }
        return userId;
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      setError('Failed to authenticate user');
    }
    return null;
  };

  // Handle file upload for document analysis
  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setTotalProgress(0);
    setError('');

      const formData = new FormData();
    files.forEach(file => formData.append('file', file));

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('regular_token') || localStorage.getItem('google_auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get userId from localStorage instead of making an API call
      let userId = localStorage.getItem('user_id');
      
      // Only decode token if userId is not in localStorage
      if (!userId) {
        userId = await decodeTokenAndSaveUserId(token);
        if (!userId) {
          throw new Error('Could not get user ID');
        }
      }
      
      // Upload the files and get initial analysis
      const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setTotalProgress(percentCompleted);
        }
      });
      
      setIsProcessing(true);
      
      // Get document_id and other data from the upload response
      const documentId = uploadResponse.data.document_id;
      const chatTitle = uploadResponse.data.title || `Analysis of ${files[0].name}`;
      
      // Create a message from the upload response
      const initialMessage: Message = {
        role: "assistant", // Upload response is from assistant/system
        content: uploadResponse.data.message || "Documents processed successfully",
        timestamp: new Date().toISOString()
      };
      
      // Save the initial conversation to the database
      const saveResponse = await axios.post(`${API_URL}/chat`, 
        { 
          user_id: userId,
          document_id: documentId,
          message: [initialMessage], // Just the initial message from upload
          title: chatTitle
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Create a properly structured conversation
      const newConversation: Conversation = {
        id: saveResponse.data.id || saveResponse.data.chat_history_id,
        title: chatTitle,
        created_at: new Date().toISOString(),
        messages: [initialMessage],
        document_id: documentId
      };
      
      setActiveConversation(newConversation);
      
      // Refresh conversations list
      fetchConversations();
      
      // Reset file state
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.response?.data?.detail || 'Failed to upload and process documents');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  // Add this function
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // Update the message change handler
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setTimeout(autoResizeTextarea, 0);
  };

  // Improved selectConversation function with proper loading and parsing
  const selectConversation = async (chatHistoryId: string) => {
    try {
      setIsLoadingConversation(true);
      setError('');
      
      // Get the authentication token
      const token = localStorage.getItem('token') || 
                   localStorage.getItem('regular_token') || 
                   localStorage.getItem('google_auth_token');
      
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // Fetch the specific conversation
      const response = await axios.get(`${API_URL}/chat/${chatHistoryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.user_details) {
        const details = response.data.user_details;
        
        // Parse the messages array from the string
        let messages: Message[] = [];
        
        try {
          // Handle message parsing with error checking
          if (typeof details.message === 'string') {
            messages = JSON.parse(details.message);
          } else if (Array.isArray(details.message)) {
            messages = details.message;
          } else {
            console.error("Unexpected message format:", details.message);
            messages = [];
          }
        } catch (e) {
          console.error("Error parsing messages:", e);
          messages = [];
        }
        
        // Create a conversation object with the full data
        const conversation: Conversation = {
          id: details.chat_history_id,
          title: details.title,
          created_at: details.modified_at,
          messages: messages,
          document_id: details.document_id || ''
        };
        
        setActiveConversation(conversation);
        
        // Auto-close sidebar on mobile
        if (isMobile && sidebarExpanded) {
          setSidebarExpanded(false);
        }
            } else {
        throw new Error("Invalid response format");
            }
          } catch (error) {
      console.error('Error loading conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Improved handleSendMessage with /chat-with-doc integration
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check BOTH message content AND active conversation existence
    if (!message.trim() || !activeConversation || isSendingMessage) return;
    
    setIsSendingMessage(true);
    
    try {
      // Get the token for authorization
      const token = localStorage.getItem('token') || 
                   localStorage.getItem('regular_token') || 
                   localStorage.getItem('google_auth_token');
      
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // Get user ID from token or localStorage
      let userId = localStorage.getItem('user_id');
      
      if (!userId) {
        // Extract user ID from token if not already saved
        try {
          const userResponse = await axios.get(`${API_URL}/auth/verifyToken`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          userId = userResponse.data.id;
          // Store for future use
          if (typeof userId === 'string') {
          localStorage.setItem('user_id', userId);
      }
    } catch (error) {
          console.error('Error decoding token:', error);
          setError('Failed to authenticate user');
        return;
        }
      }
      
      // Add the user message to the conversation
      const newUserMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      // Create updated conversation with the new message
      const updatedConversation = {
        ...activeConversation,
        messages: [...activeConversation.messages, newUserMessage]
      };
      
      // Update the UI immediately with user message
      setActiveConversation(updatedConversation);
      setMessage('');
      
      // Create a placeholder for assistant's response
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '...',
        timestamp: new Date().toISOString()
      };
      
      // Show typing indicator
      setActiveConversation({
        ...updatedConversation,
        messages: [...updatedConversation.messages, assistantPlaceholder]
      });
      
      // Get response from AI using chat-with-doc endpoint
      const chatResponse = await axios.post(
        `${API_URL}/chat-with-doc`,
        {
          chat_history_id: activeConversation.id,
          document_id: activeConversation.document_id,
          message: newUserMessage.content
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Create the actual assistant message from the response
      const assistantMessage: Message = {
        role: 'assistant',
        content: chatResponse.data.message || "Resources are currently busy. Please try again later.",
        timestamp: new Date().toISOString()
      };
      
      // Final conversation state with real assistant response
      const finalConversation = {
        ...activeConversation,
        messages: [...updatedConversation.messages, assistantMessage]
      };
      
      setActiveConversation(finalConversation);
      
      // Save the conversation to the database
      await axios.post(
        `${API_URL}/chat`,
        {
          chat_history_id: activeConversation.id,
          user_id: userId,
          document_id: activeConversation.document_id,
          message: finalConversation.messages,
          title: activeConversation.title
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh the conversations list to update titles and order
      fetchConversations();
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the loading placeholder and show error
      if (activeConversation) {
        const messages = [...activeConversation.messages];
        if (messages[messages.length - 1]?.role === 'assistant' && 
            messages[messages.length - 1]?.content === '...') {
          messages.pop(); // Remove placeholder
        }
        
        setActiveConversation({
          ...activeConversation,
          messages
        });
      }
      
      setError('Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    setActiveConversation(null);
    setRecommendation(null);
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Simple toggle function - just expands for now
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Update the handleLogout function in Dashboard component
  const handleLogout = () => {
    // Clear all storage items
    localStorage.removeItem('token');
    localStorage.removeItem('regular_token');
    localStorage.removeItem('google_auth_token');
    localStorage.removeItem('user_id');
    sessionStorage.clear(); // Clear all session storage items too

    // Remove authorization header
    delete axios.defaults.headers.common['Authorization'];
    
    // Call the logout function from AuthContext
    logout();
    
    // Navigate to login page
    navigate('/login');
  };

  // Updated deleteConversation function to properly handle last conversation deletion
  const deleteConversation = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering conversation selection
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        const token = localStorage.getItem('token') || 
                     localStorage.getItem('regular_token') || 
                     localStorage.getItem('google_auth_token');
                     
        if (!token) {
          console.error("No token found");
          return;
        }
        
        // Delete the conversation from the backend
        await axios.delete(`${API_URL}/chat/${chatId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Important: Reset active conversation FIRST if it's the one being deleted
        if (activeConversation?.id === chatId) {
          setActiveConversation(null);
        }
        
        // Update local conversation state to immediately reflect deletion
        setGroupedConversations(prevState => {
          const newState = {...prevState};
          
          // Remove the deleted conversation from each period
          Object.keys(newState).forEach(period => {
            newState[period] = newState[period].filter(
              conv => conv.chat_history_id !== chatId
            );
          });
          
          return newState;
        });
        
        // Also update the original conversations array for consistency
        setConversations(prev => prev.filter(conv => conv.id !== chatId));
        
        // Close any open dropdown
        setActiveDropdown(null);
        
        // Fetch fresh conversations to ensure UI is in sync with backend
        fetchConversations();
        
    } catch (error) {
        console.error('Error deleting conversation:', error);
        setError('Failed to delete conversation');
        
        // If we get a 404, the conversation is already gone from backend
        // So we should still clean up the UI
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          if (activeConversation?.id === chatId) {
            setActiveConversation(null);
          }
          
          setGroupedConversations(prevState => {
            const newState = {...prevState};
            
            Object.keys(newState).forEach(period => {
              newState[period] = newState[period].filter(
                conv => conv.chat_history_id !== chatId
              );
            });
            
            return newState;
          });
          
          setConversations(prev => prev.filter(conv => conv.id !== chatId));
          setActiveDropdown(null);
        }
      }
    }
  };

  // Add function to rename conversation
  const renameConversation = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering conversation selection
    
    // Set the conversation as being renamed and show input
    setRenamingConversation(chatId);
    
    // Get current title to pre-fill
    const conversation = Object.values(groupedConversations)
      .flat()
      .find(conv => conv.chat_history_id === chatId);
      
    if (conversation) {
      setNewTitle(conversation.title);
    }
    
    // Close dropdown
    setActiveDropdown(null);
  };

  // Function to handle saving the new title - CORRECTED VERSION
  const saveNewTitle = async (chatId: string, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newTitle.trim()) return;
    
    try {
      const token = localStorage.getItem('token') || 
                   localStorage.getItem('regular_token') || 
                   localStorage.getItem('google_auth_token');
                   
      if (!token) {
        console.error("No token found");
        return;
      }
      
      // First fetch the complete conversation details
      const chatResponse = await axios.get(`${API_URL}/chat/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!chatResponse.data || !chatResponse.data.user_details) {
        throw new Error("Invalid response when fetching conversation details");
      }
      
      const details = chatResponse.data.user_details;
      
      // Parse the messages array from the string
      let messages;
      try {
        if (typeof details.message === 'string') {
          messages = JSON.parse(details.message);
        } else if (Array.isArray(details.message)) {
          messages = details.message;
        } else {
          console.error("Unexpected message format:", details.message);
          messages = [];
        }
      } catch (e) {
        console.error("Error parsing messages:", e);
        messages = [];
      }
      
      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        throw new Error("User ID not found in localStorage");
      }
      
      // Update the conversation with POST
      await axios.post(`${API_URL}/chat`, 
        {
          chat_history_id: chatId,
          user_id: userId,
          document_id: details.document_id || "",
          message: messages,
          title: newTitle.trim()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh conversations to get updated title
      fetchConversations();
      
      // Clear renaming state
      setRenamingConversation(null);
      setNewTitle('');
      
    } catch (error) {
      console.error('Error renaming conversation:', error);
      setError('Failed to rename conversation');
    }
  };

  // Cancel renaming
  const cancelRenaming = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConversation(null);
    setNewTitle('');
  };

  // Add these event handlers to prevent browser default behavior for drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Use the existing file change handler with the dropped files
      const fileChangeEvent = {
        target: {
          files: e.dataTransfer.files
        }
      } as React.ChangeEvent<HTMLInputElement>;
      
      handleFileChange(fileChangeEvent);
    }
  };

  // Function to copy message content
  const handleCopyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        // Show success toast
        toast.success('Message copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast.error('Failed to copy message');
      });
  };

  // Function to download message as PDF - with improved styling and layout
  const handleDownloadPDF = async (message: Message) => {
    // Create a temporary div for rendering the content
    const element = document.createElement('div');
    element.className = 'pdf-content';
    element.innerHTML = `
      <div style="padding: 40px; font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
        <div style="margin-bottom: 30px;">
          <div style="font-size: 12px; color: #9ca3af; text-align: right;">
            Generated on ${new Date().toLocaleDateString()}
          </div>
          <hr style="border: none; height: 1px; background-color: #e5e7eb; margin: 10px 0;" />
        </div>
        
        <div style="font-size: 15px; line-height: 1.6;">
          ${marked.parse(message.content)}
        </div>
        
        <div style="margin-top: 40px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
          Generated by AlignIQ
        </div>
      </div>
    `;
    
    // Add some basic PDF styling
    const style = document.createElement('style');
    style.textContent = `
      .pdf-content {
        background-color: white;
      }
      .pdf-content h1 {
        font-size: 24px;
        margin-bottom: 16px;
        color: #111;
      }
      .pdf-content h2 {
        font-size: 20px;
        margin-top: 24px;
        margin-bottom: 12px;
        color: #111;
      }
      .pdf-content h3 {
        font-size: 18px;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      .pdf-content p {
        margin-bottom: 16px;
      }
      .pdf-content ul, .pdf-content ol {
        margin-bottom: 16px;
        padding-left: 24px;
      }
      .pdf-content li {
        margin-bottom: 6px;
      }
      .pdf-content code {
        font-family: monospace;
        background-color: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
      }
      .pdf-content pre {
        background-color: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        margin-bottom: 16px;
      }
    `;
    element.appendChild(style);
    
    document.body.appendChild(element);
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.width = '800px'; // Fixed width for better rendering
    
    try {
      // Wait a bit for any styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Improved canvas rendering
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality rendering
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Calculate dimensions based on A4 page with margins
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 10; // Margin in mm
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Calculate the available content area
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      // Add the image to the PDF with proper scaling
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      
      // Add additional pages if content is taller than a single page
      let remainingHeight = contentHeight;
      let position = margin + contentHeight;
      
      while (remainingHeight > pageHeight - (margin * 2)) {
        pdf.addPage();
        remainingHeight = remainingHeight - (pageHeight - (margin * 2));
        pdf.addImage(
          imgData, 
          'PNG', 
          margin, // x position
          -(position - margin), // y position (negative to move up)
          contentWidth, 
          contentHeight
        );
        position += pageHeight - (margin * 2);
      }
      
      pdf.save(`aligniq-analysis-${new Date().getTime()}.pdf`);
      
      // Show success toast
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF');
    } finally {
      // Clean up
      document.body.removeChild(element);
    }
  };

  return (
    <div className="relative flex h-screen bg-[#141332]">
      {/* Sidebar with better collapsed state organization */}
      <aside className={`fixed inset-y-0 left-0 z-20 transition-all duration-300 transform bg-[#120f2d] border-r border-gray-800 
        ${sidebarExpanded ? 'w-64' : 'w-16'}`}>
        <div className="flex flex-col h-full">
          {sidebarExpanded ? (
            // EXPANDED SIDEBAR CONTENT
            <>
              {/* Logo + brand with smaller, themed text */}
              <div className="flex-none p-3 border-b border-white/10">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">AQ</span>
                  </div>
                  <span className="ml-3 text-4xl leading-snug font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-300">
                    AlignIQ
                  </span>
                </div>
              </div>
              
              {/* New Chat and Toggle buttons side by side with standard padding */}
              <div className="px-3 py-3">
                <div className="flex items-center space-x-3">
                  {/* New Chat button - larger */}
                  <button
                    onClick={() => {
                      setShowUploadUI(true);
                      setActiveConversation(null);
                    }}
                    className="flex-1 flex items-center justify-center !py-2 !px-3 bg-gradient-to-r from-blue-600 to-purple-600 
                      rounded-md text-white font-medium hover:from-blue-500 hover:to-purple-500 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    New Chat
                  </button>
                  
                  {/* Toggle button - same size as before */}
                  <button 
                    onClick={toggleSidebar}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded hover:bg-white/5 transition-colors !p-0"
                    title="Collapse sidebar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            // COLLAPSED SIDEBAR - Keep the current vertical arrangement
            <>
              {/* 1. Logo at the top */}
              <div className="flex-none p-3 flex justify-center">
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">AQ</span>
                </div>
              </div>
              
              {/* 2. Toggle button in the middle */}
              <div className="flex-none py-3 flex justify-center">
                <button 
                  onClick={toggleSidebar}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors !p-0"
                  title="Expand sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* 3. New chat button (just +) at the bottom */}
              <div className="flex-none py-3 flex justify-center">
                <button 
                  onClick={() => {
                    setShowUploadUI(true);
                    setActiveConversation(null);
                  }}
                  className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 
                    rounded-md text-white font-medium hover:from-blue-500 hover:to-purple-500 transition-all !p-0"
                  title="New Chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </>
          )}
          
          {/* Conversation list - only when expanded */}
          {sidebarExpanded && (
            <div className="flex-grow overflow-y-auto">
              <div className="px-4">
                <h3 className="text-xs font-medium text-gray-300 mb-2">
                  Recent conversations
                </h3>
                
                {/* Conversations grouped by time period */}
                {Object.entries(groupedConversations)
                  .filter(([_, convs]) => convs.length > 0)
                  .map(([period, convs]) => (
                    <div key={period} className="mb-4">
                      <h4 className="text-xs text-gray-500 mb-1">
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </h4>
                      
                      <div className="space-y-1">
                        {convs.map(conversation => (
                          <div key={conversation.chat_history_id} className="relative group">
                            {renamingConversation === conversation.chat_history_id ? (
                              /* Render just the form when renaming - no parent button */
                              <form 
                                className="w-full text-left flex items-center py-2 px-3 rounded-md bg-white/5"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  saveNewTitle(conversation.chat_history_id, e);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                
                <input
                                  type="text"
                                  className="flex-1 bg-gray-800 border border-purple-500/50 rounded px-2 py-1 text-sm text-white"
                                  value={newTitle}
                                  onChange={(e) => setNewTitle(e.target.value)}
                                  autoFocus
                                  onBlur={() => setRenamingConversation(null)}
                                />
                              </form>
                            ) : (
                              /* Regular button when not renaming */
                  <button
                                className={`w-full text-left flex items-center py-2 px-3 rounded-md transition-colors relative
                                  ${activeConversation?.id === conversation.chat_history_id 
                                    ? 'bg-white/10 text-white' 
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                onClick={() => selectConversation(conversation.chat_history_id)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
                                
                                <span className="text-sm truncate">
                                  {conversation.title}
                                </span>
                  </button>
        )}
        
                            {/* Conversation actions - ellipsis menu (don't show during rename) */}
                            {sidebarExpanded && renamingConversation !== conversation.chat_history_id && (
                      <button
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 
                                  hover:bg-white/10 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity
                                  ${activeDropdown === conversation.chat_history_id ? 'opacity-100 bg-white/10 text-white' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(activeDropdown === conversation.chat_history_id ? null : conversation.chat_history_id);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                  )}
                  
                            {/* Dropdown menu */}
                            {activeDropdown === conversation.chat_history_id && (
                              <div className="absolute right-0 mt-1 w-48 rounded-md bg-gray-800 shadow-lg border border-white/10 z-10">
                                <div className="py-1">
                  <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center"
                                    onClick={(e) => renameConversation(conversation.chat_history_id, e)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 0L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                                    Rename
              </button>
                <button 
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center"
                                    onClick={(e) => deleteConversation(conversation.chat_history_id, e)}
                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                  </button>
                </div>
              </div>
            )}
            </div>
                        ))}
        </div>
      </div>
                  ))}
                
                {/* Show message if no conversations */}
                {Object.values(groupedConversations).flat().length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p>No conversations yet</p>
                    <p className="text-xs mt-1">Click "New Chat" to get started</p>
        </div>
                )}
                </div>
                    </div>
                  )}
                  
          {/* Bottom section - Profile menu (always visible) */}
          <div className="flex-none border-t border-white/10 mt-auto">
            <div className="p-4">
              <ProfileMenu user={null} logout={logout} sidebarExpanded={sidebarExpanded} />
                </div>
              </div>
            </div>
      </aside>

      {/* Main content area with proper positioning and transition */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out
        ${sidebarExpanded ? 'pl-64' : 'pl-16'}`}>
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversation ? (
            // Loading state while fetching conversation details
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                <p className="text-gray-400">Loading conversation...</p>
                  </div>
                </div>
          ) : activeConversation ? (
            // Chat interface with sticky header for title
            <div className="flex flex-col h-full">
              {/* Sticky conversation header */}
              <div className="sticky top-0 z-10 p-4 border-b border-white/10 backdrop-blur-sm bg-[#141332]/90">
                <h2 className="text-xl font-semibold text-white">{activeConversation.title}</h2>
              </div>
              
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto" style={{ height: recommendation ? 'calc(100% - 165px)' : 'calc(100% - 73px)' }}>
                <div className="p-4 space-y-6">
                  {activeConversation.messages.map((msg, index) => (
                    <div key={msg.id || index} className={`mb-4 ${msg.role === 'user' ? 'mr-12' : 'ml-12'}`}>
                      {msg.role === 'assistant' ? (
                        // AI message with export options
                        <div className="flex flex-col space-y-2 bg-[#1a1745] rounded-lg p-4 max-w-3xl">
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-white">AI</span>
                            </div>
                            <div className="flex-1 overflow-x-auto">
                              <div className="prose text-gray-100 max-w-none">
                                {/* Render markdown content */}
                                <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                              </div>
                              
                              {/* Export options bar */}
                              <div className="mt-4 pt-2 border-t border-white/10 flex justify-end space-x-2">
                                <button 
                                  onClick={() => handleCopyMessage(msg)}
                                  className="flex items-center text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors !p-0"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                  Copy
                                </button>
                                
                                <button 
                                  onClick={() => handleDownloadPDF(msg)}
                                  className="flex items-center text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors !p-0"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // User message - keep as is
                        <div className="flex flex-col space-y-2 bg-[#232142] rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-white whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              <div ref={messagesEndRef} />
                </div>
              </div>
              
              {/* Recommendation panel - collapsible */}
              {recommendation && (
                <div className="flex-shrink-0 p-4 border-t border-white/10 max-h-[30vh] overflow-y-auto">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h3 className="text-xl font-bold mb-4 text-purple-200">AI Analysis</h3>
                    
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold mb-2 text-white">Project Summary</h4>
                      <p className="text-gray-200">{recommendation.summary}</p>
                    </div>
                    
                    {/* Display tech stack recommendations */}
                    {recommendation.tech_stack && recommendation.tech_stack.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold mb-2">Recommended Tech Stack</h4>
                        <div className="flex flex-wrap gap-2">
                          {recommendation.tech_stack.map((tech, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
            </div>
          )}
                    
                    {/* Display developer requirements */}
                    {recommendation.developers_required && recommendation.developers_required.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold mb-2">Team Requirements</h4>
                        <div className="space-y-3">
                          {recommendation.developers_required.map((dev, index) => (
                            <div key={index} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                              <div className="flex justify-between">
                                <span className="font-medium">{dev.role}</span>
                                <span className="text-purple-300">{dev.count} needed</span>
        </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {dev.skills.map((skill, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Display ambiguities */}
                    {recommendation.ambiguities && recommendation.ambiguities.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-2">Identified Ambiguities</h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {recommendation.ambiguities.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Message input - fixed height at bottom */}
              <div className="flex-shrink-0 border-t border-white/10 backdrop-blur-sm bg-black/30 p-4 w-full">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white 
                      placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500
                      min-h-[44px] max-h-[200px] overflow-y-auto resize-none"
                    style={{ height: 'auto' }}
                    rows={1}
                    ref={textareaRef}
                  />
                <button
                    type="submit"
                    disabled={!message.trim() || isSendingMessage}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg 
                      border border-purple-500/30 shadow-md text-white font-medium
                      hover:from-blue-500 hover:to-purple-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingMessage ? (
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                </form>
              </div>
                </div>
          ) : (
            // Welcome screen with two possible states
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              {Object.values(groupedConversations).flat().length > 0 && !showUploadUI ? (
                // Some conversations exist but none selected - Welcome Back screen
                <div className={`text-center mx-auto ${sidebarExpanded && isMobile ? 'ml-16 max-w-[calc(100%-4rem)]' : 'max-w-md'}`}>
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-4 sm:p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <h2 className="text-lg sm:text-xl font-bold mb-2 text-white">Welcome Back!</h2>
                    <p className="text-gray-200 mb-4 text-sm sm:text-base">Select a conversation from the sidebar to continue where you left off, or upload a new document to start a fresh analysis.</p>
                    <div className="flex flex-col sm:flex-row sm:justify-center space-y-2 sm:space-y-0 sm:space-x-2">
                      <button 
                        onClick={() => {
                          if (!sidebarExpanded) {
                            setSidebarExpanded(true);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-500 hover:to-purple-500 transition-all"
                      >
                        View Conversations
                      </button>
                      <button 
                        onClick={() => {
                          setShowUploadUI(true);
                          // Reset any previous upload state
                          setFiles([]);
                          setTotalProgress(0);
                          setError('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-medium hover:bg-white/20 transition-all"
                      >
                        Upload New Document
                      </button>
            </div>
          </div>
      </div>
              ) : (
                // No conversations exist OR showUploadUI is true - show upload UI
                <div className="max-w-2xl mx-auto w-full">
                  {Object.values(groupedConversations).flat().length > 0 && (
                    // Only show back button if user has conversations
          <button 
                      onClick={() => setShowUploadUI(false)}
                      className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
          >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
                      Back to Conversations
          </button>
        )}

                  {/* Main container with compact fixed layout */}
                  <div className="backdrop-blur-sm bg-white/5 rounded-3xl border border-white/10 p-5 shadow-2xl flex flex-col max-h-[75vh] max-w-xl mx-auto">
                    {/* Section 1: Compact header & drag area */}
                    <div className="flex-none">
                      <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300">
                          Upload Requirements Documents
                        </h2>
                        <p className="text-sm text-gray-200">
                          Upload your client's requirements documents to get AI-powered analysis and recommendations
                        </p>
                      </div>
                      
                      {error && (
                        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded-md text-white text-sm">
                          {error}
                        </div>
                      )}
                      
                      <div className="mb-3">
                        <label 
                          htmlFor="file-upload" 
                          className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-white/30 p-4 text-center hover:border-purple-500/50 transition-colors"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
                            <span className="text-base font-medium text-gray-300">
                              Click to upload or drag and drop
                            </span>
                            <span className="text-xs text-gray-400 mt-1">
                              PDF, PPT, CSV, or TXT (max 10MB each)
                            </span>
                          </div>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.ppt,.pptx,.csv,.txt,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain"
                            multiple
                          />
                        </label>
                      </div>
                    </div>
                    
                    {/* Section 2: File list area - more compact */}
                    <div className="flex-grow overflow-hidden flex flex-col min-h-0">
                      {files.length > 0 && (
                        <div className="mb-3 flex flex-col min-h-0">
                          <div className="flex justify-between items-center mb-1 flex-shrink-0">
                            <h3 className="text-xs font-medium text-gray-300">Selected files ({files.length})</h3>
          <button
                              onClick={() => setFiles([])}
                              className="text-xs text-red-400 hover:text-red-300 flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
                              Delete All
          </button>
              </div>
                          <div className="overflow-y-auto flex-grow bg-white/5 rounded-lg border border-white/10 min-h-[120px]">
                            {files.map((file, index) => (
                              <div key={`${file.name}-${index}`} className="p-2 border-b border-white/10 flex justify-between items-center">
                                <div className="flex items-center flex-1 min-w-0">
                                  <FileIcon type={file.type} />
                                  <div className="ml-2 flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{file.name}</p>
                                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
            </div>
                                </div>
                                <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-400 ml-2">
                                  <TrashIcon />
          </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
        </div>
        
                    {/* Section 3: Action buttons */}
                    <div className="flex-none mt-3 flex justify-center">
            <button
                        onClick={handleUpload}
                        disabled={files.length === 0 || isUploading || isProcessing}
                        className="py-2 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600
                        border border-purple-500/30 shadow-md transition-all
                        hover:from-blue-500 hover:to-purple-500 focus:outline-none disabled:opacity-50"
                      >
                        <span className="flex items-center justify-center text-white font-medium">
                          {isUploading ? (
                            <>
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                              Uploading...
                            </>
                          ) : isProcessing ? (
                            <>
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                              Analyzing Documents...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
                              Upload & Analyze
                            </>
                          )}
                        </span>
            </button>
          </div>
        </div>
      </div>
              )}
            </div>
          )}
        </div>
      </main>
      {/* Add Toast Container at the bottom of your return statement */}
      <div className="fixed bottom-4 right-4 z-50">
        {/* Toast notifications will appear here */}
      </div>
    </div>
  );
};

export default Dashboard;