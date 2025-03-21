import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

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

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      {/* Header - fixed height */}
      <header className="flex-shrink-0 relative z-10 backdrop-blur-sm bg-black/10 border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                <span className="text-xl font-bold">AQ</span>
            </div>
              <h1 className="ml-3 text-xl font-bold text-white">AlignIQ</h1>
            </Link>
        </div>
        
          <div className="flex items-center space-x-4">
          <button 
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500/80 to-purple-600/80 
              hover:from-purple-500 hover:to-purple-600 transition-all duration-300 
              border border-purple-400/20 shadow-md hover:shadow-purple-500/20"
            >
              <span className="text-white font-medium">Logout</span>
          </button>
          </div>
        </div>
      </header>

      {/* Main content - explicitly use remaining height */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-73px)]">
        {/* Collapsed sidebar - showing just icons */}
        {!sidebarExpanded && (
          <div className="w-16 h-full border-r border-white/10 bg-black/5 backdrop-blur-sm flex-shrink-0 
            flex flex-col items-center py-6 space-y-8">
            {/* Expand sidebar button - improved styling */}
          <button 
              onClick={toggleSidebar}
              className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 
                hover:from-indigo-500/20 hover:to-purple-500/20 border border-white/5 
                transition-all duration-300 text-gray-200 hover:text-white
                hover:shadow-md hover:shadow-purple-500/10"
              title="Expand sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        
            {/* New Analysis button - improved styling */}
          <button
              onClick={startNewConversation}
              className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 
                hover:from-indigo-500/20 hover:to-purple-500/20 border border-white/5 
                transition-all duration-300 text-gray-200 hover:text-white
                hover:shadow-md hover:shadow-purple-500/10 mt-0.1"
              title="New Analysis"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
            
            {/* Divider - more subtle */}
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            {/* Recent conversations - improved styling */}
            {Object.values(groupedConversations)
              .flat()
              .slice(0, 5)
              .map(conversation => (
                <button
                  key={conversation.chat_history_id}
                  onClick={() => selectConversation(conversation.chat_history_id)}
                  className={`p-2.5 rounded-lg transition-all duration-300 border border-white/5
                    ${activeConversation?.id === conversation.chat_history_id 
                      ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-purple-500/30 text-white shadow-md shadow-purple-500/10' 
                      : 'bg-gradient-to-br from-indigo-500/5 to-purple-500/5 text-gray-400 hover:from-indigo-500/10 hover:to-purple-500/10 hover:text-white'
                    }`}
                  title={conversation.title}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                </button>
              ))
              }
          </div>
        )}

        {/* Expanded sidebar - fixed for mobile */}
        {sidebarExpanded && (
          <aside className={`w-80 border-r border-white/10 bg-black/10 flex-shrink-0 overflow-hidden 
            transition-all duration-300 flex flex-col
            ${isMobile 
              ? 'fixed top-[73px] left-0 bottom-0 z-20 h-[calc(100%-73px)]' 
              : 'h-full relative'}`}
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <button
                onClick={startNewConversation}
                className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600
                border border-purple-500/30 shadow-md transition-all duration-200 
                hover:from-blue-500 hover:to-purple-500 focus:outline-none mr-2"
              >
                <span className="flex items-center justify-center text-white font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                  New Analysis
                </span>
              </button>
              
              <div className="flex items-center">
                <button 
                  onClick={toggleSidebar}
                  className="p-2 rounded-md bg-gradient-to-br from-indigo-500/10 to-purple-500/10 
                    hover:from-indigo-500/20 hover:to-purple-500/20 border border-white/5
                    transition-all duration-300 text-gray-300 hover:text-white"
                  title="Hide sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
        </div>
      </div>
      
            {/* Conversations list with time-based grouping */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">Your Analyses</h2>
                
                {Object.keys(groupedConversations).every(key => 
                  groupedConversations[key as keyof GroupedConversations].length === 0
                ) ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No analyses yet</p>
                    <p className="text-sm mt-2">Upload a document to get started</p>
                </div>
                ) : (
                <div className="mt-6 space-y-1.5">
                  {Object.entries(groupedConversations).map(([period, convs]) => 
                    convs.length > 0 && (
                      <div key={period} className="mb-2.5">
                        <h3 className="text-xs font-medium text-gray-400 uppercase mb-1 px-3">
                          {period}
                        </h3>
                        <div className="space-y-0.5">
                          {convs.map(conv => (
                            <div key={conv.chat_history_id} className="relative">
                              {renamingConversation === conv.chat_history_id ? (
                                // Rename form
                                <form 
                                  onSubmit={(e) => saveNewTitle(conv.chat_history_id, e)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2.5 py-1 bg-gray-800/70 rounded-md"
                                >
                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    autoFocus
                                  />
                                  <div className="flex mt-1 justify-end space-x-1">
                  <button
                                      type="button"
                                      onClick={cancelRenaming}
                                      className="text-xs px-2 py-0.5 text-gray-300 hover:text-white"
                                    >
                                      Cancel
                  </button>
                                    <button
                                      type="submit"
                                      className="text-xs px-2 py-0.5 bg-purple-600 rounded text-white hover:bg-purple-500"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                // Normal conversation button
                                <button
                                  onClick={() => selectConversation(conv.chat_history_id)}
                                  className={`w-full text-left px-2.5 py-1 rounded-md transition-colors group
                                    ${activeConversation?.id === conv.chat_history_id 
                                      ? 'bg-purple-500/20 text-white' 
                                      : 'text-gray-300 hover:bg-white/5'
                                    }
                                  `}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1 min-w-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                                      <span className="truncate text-xs">{conv.title}</span>
                      </div>
                                    
                                    {/* Horizontal ellipsis menu button */}
                                    <div className="relative flex-shrink-0">
                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveDropdown(activeDropdown === conv.chat_history_id ? null : conv.chat_history_id);
                                        }}
                                        className={`p-1 rounded-full ${activeDropdown === conv.chat_history_id ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'} hover:bg-white/10 transition-opacity`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </button>
                  
                                      {/* Dropdown menu */}
                                      {activeDropdown === conv.chat_history_id && (
                                        <div className="absolute right-0 mt-1 w-32 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                                          <div className="py-1">
                  <button
                                              onClick={(e) => renameConversation(conv.chat_history_id, e)}
                                              className="flex items-center px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white w-full text-left"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                              Rename
                                            </button>
                                            <button
                                              onClick={(e) => deleteConversation(conv.chat_history_id, e)}
                                              className="flex items-center px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white w-full text-left"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-2 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              Delete
                  </button>
                </div>
              </div>
                                      )}
            </div>
                                  </div>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
                )}
            </div>
            </div>
          </aside>
        )}

        {/* Main content area - with explicit height */}
        <main className="flex-1 flex flex-col h-[calc(100vh-73px)] overflow-hidden">
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
            // Chat interface with fixed structure
            <div className="flex flex-col h-full">
              {/* Conversation header - fixed height */}
              <div className="flex-shrink-0 sticky top-0 z-10 p-4 border-b border-white/10 backdrop-blur-sm bg-black/30">
                <h2 className="text-xl font-semibold text-white">{activeConversation.title}</h2>
              </div>
              
              {/* Messages area with fixed height calculation */}
              <div className="flex-1 overflow-y-auto" style={{ height: recommendation ? 'calc(100% - 165px)' : 'calc(100% - 73px)' }}>
                <div className="p-4 space-y-6">
                  {activeConversation.messages.map((msg, index) => (
                  <div
                    key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                        className={`max-w-3xl rounded-2xl p-4 ${
                          msg.role === 'user' 
                            ? 'bg-purple-600/30 border border-purple-500/30 ml-12' 
                            : 'bg-white/10 border border-white/10 mr-12'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words overflow-hidden">
                          {msg.content}
                      </div>
                        <div className="text-xs text-gray-400 mt-2 text-right">
                          {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                    </div>
                  ))}
              <div ref={messagesEndRef} />
            </div>
        </div>
        
              {/* Recommendation panel - collapsible */}
              {recommendation && (
                <div className="flex-shrink-0 p-4 border-t border-white/10 max-h-[30vh] overflow-y-auto">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h3 className="text-xl font-bold mb-4 text-purple-300">AI Analysis</h3>
                    
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold mb-2">Project Summary</h4>
                      <p className="text-gray-300">{recommendation.summary}</p>
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
                <div className="text-center max-w-md mx-auto">
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
                    <h2 className="text-xl font-bold mb-2 text-white">Welcome Back!</h2>
                    <p className="text-gray-300 mb-4">Select a conversation from the sidebar to continue where you left off, or upload a new document to start a fresh analysis.</p>
                    <div className="flex justify-center">
          <button 
                        onClick={() => {
                          if (!sidebarExpanded) {
                            setSidebarExpanded(true);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-500 hover:to-purple-500 transition-all mr-2"
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
                        <p className="text-sm text-gray-300">
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
        </main>
      </div>

      {/* Mobile overlay when sidebar is expanded */}
      {sidebarExpanded && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-10"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 0.2;
            }
            50% {
              opacity: 0.8;
            }
          }
          
          .text-fade {
            position: relative;
          }
          
          .text-fade::after {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            height: 100%;
            width: 30%;
            background: linear-gradient(to right, transparent, rgba(18, 16, 44, 0.95) 90%);
            pointer-events: none;
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;