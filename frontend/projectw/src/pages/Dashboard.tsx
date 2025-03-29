import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import * as marked from 'marked'; // Change to namespace import
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// Import the modular Sidebar
import { Sidebar } from '../components/sidebar';
import RightSidebar from '../components/integrations/RightSidebar';
import JiraIssueDetail from '../components/integrations/jira/JiraIssueDetail';

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
  const [showUploadUI, setShowUploadUI] = useState(true);
  // Near the top of the Dashboard component - add new state for selected messages
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  // First, add this state near your other state declarations
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [showIntegrationPanel, setShowIntegrationPanel] = useState(false);
  const [integrationDropdownOpen, setIntegrationDropdownOpen] = useState(false);
  const [integrationTab, setIntegrationTab] = useState<'jira' | 'github' | 'azure'>('jira');
  const [isSplitView, setIsSplitView] = useState(false);
  const [selectedJiraIssue, setSelectedJiraIssue] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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
      setIsMobile(window.innerWidth < 768);
    };
    
    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // First, improve the scrollToBottom function to be more reliable
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Use setTimeout to ensure this happens after DOM updates
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Make sure we're also scrolling when typing indicators appear
  useEffect(() => {
    // This will trigger scrolling whenever messages change, including typing indicators
    if (activeConversation?.messages?.some(msg => msg.content === '...')) {
      scrollToBottom();
    }
  }, [activeConversation?.messages]);

  // Add this as well to ensure scrolling happens after state updates
  useEffect(() => {
    if (isSendingMessage) {
      scrollToBottom();
    }
  }, [isSendingMessage]);

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

  // Update handleSendMessage function to call the correct endpoint with proper payload structure
  const handleSendMessage = async () => {
    if (!message.trim() || isSendingMessage) return;
    
    try {
      setIsSendingMessage(true);
      
      // Get authentication tokens
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('regular_token') || 
                    localStorage.getItem('google_auth_token');
      const userId = localStorage.getItem('user_id');
      
      if (!token || !userId) {
        toast.error("Authentication token or user ID not found. Please log in again.");
        return;
      }
      
      // Create a temporary message for immediate UI update
      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      // Make a copy of the active conversation with the new message
      const updatedConversation = activeConversation ? {
        ...activeConversation,
        messages: [...activeConversation.messages, tempMsg]
      } : {
        id: 'new_' + Date.now(),
        title: 'New Conversation',
        created_at: new Date().toISOString(),
        document_id: '',
        messages: [tempMsg]
      };
      
      // Update UI immediately
      setActiveConversation(updatedConversation);
      setMessage('');
      
      // Add a placeholder for the assistant's response
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '...',
        timestamp: new Date().toISOString()
      };
      
      // Show typing indicator
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, assistantPlaceholder]
        };
      });
      
      // Prepare selected messages for context (or all messages if none selected)
      const contextMessages = activeConversation?.messages
        .filter(msg => !selectedMessageIds.length || (msg.id && selectedMessageIds.includes(msg.id)))
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })) || [];
      
      // Add the new user message to the context
      const userMessageForApi = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      // Call the chat-with-doc endpoint with the CORRECT payload format
      const response = await axios.post(
        `${API_URL}/chat-with-doc`,
        {
          chat_history_id: updatedConversation.id,
          user_id: userId,
          document_id: updatedConversation.document_id || '',
          message: [...contextMessages, userMessageForApi],
          title: updatedConversation.title
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Process the response
      if (response.data) {
        // Create assistant message from the response
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.message || "No response from the server",
          timestamp: new Date().toISOString()
        };
        
        // Update conversation with the final message
        const finalMessages = updatedConversation.messages
          .filter(msg => msg.role !== 'assistant' || msg.content !== '...') // Remove placeholder
          .concat([assistantMessage]);
        
        setActiveConversation({
          ...updatedConversation,
          messages: finalMessages
        });
        
        // Save the updated conversation to the database
        await axios.post(
          `${API_URL}/chat`,
          {
            chat_history_id: updatedConversation.id,
            user_id: userId,
            document_id: updatedConversation.document_id || '',
            message: finalMessages,
            title: updatedConversation.title
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        // Refresh conversation list
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      
      // Remove loading indicator on error
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.filter(msg => msg.content !== '...')
        };
      });
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
    // First, clear any Jira tokens
    localStorage.removeItem('jira_authorization');
    
    // Then perform the normal logout
    logout();
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
            if (period in newState) {
              newState[period as keyof GroupedConversations] = newState[period as keyof GroupedConversations].filter(
                conv => conv.chat_history_id !== chatId
              );
            }
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
              if (period in newState) {
                newState[period as keyof GroupedConversations] = newState[period as keyof GroupedConversations].filter(
                  conv => conv.chat_history_id !== chatId
                );
              }
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

  // Modify the useEffect that initializes selected messages
  useEffect(() => {
    if (activeConversation && activeConversation.messages) {
      // Ensure each message has an ID and select all by default
      const messagesWithIds = activeConversation.messages.map((msg, index) => {
        // If message doesn't have an ID, add one using index
        if (!msg.id) {
          return { ...msg, id: `temp-id-${index}` };
        }
        return msg;
      });
      
      // Update the conversation with message IDs if needed
      if (messagesWithIds.some((msg, i) => !activeConversation.messages[i].id)) {
        setActiveConversation({
          ...activeConversation,
          messages: messagesWithIds
        });
      }
      
      // Get all message IDs for selection
      const allMessageIds = messagesWithIds.map(msg => msg.id as string);
      console.log('Setting initial message IDs:', allMessageIds);
      setSelectedMessageIds(allMessageIds);
    }
  }, [activeConversation?.id]); // Only run when conversation changes

  // Updated toggle message function with better debugging
  const toggleMessageSelection = (messageId: string) => {
    console.log('Toggling message selection for:', messageId);
    setSelectedMessageIds(prev => {
      const newSelection = prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId];
      console.log('New selection state:', newSelection);
      return newSelection;
    });
  };

  // Debug function to see why checkboxes aren't updating
  const debugSelectionState = (msgId: string) => {
    const isSelected = selectedMessageIds.includes(msgId);
    console.log(`Message ${msgId} selected: ${isSelected}`);
    console.log('All selected IDs:', selectedMessageIds);
    return isSelected;
  };

  // Fix the allMessagesSelected function - it should be a value, not a function call
  const allMessagesSelected = 
    activeConversation?.messages
      .filter(msg => msg.id)
      .every(msg => msg.id && selectedMessageIds.includes(msg.id)) || false;

  // Fix the toggleAllMessages function
  const toggleAllMessages = () => {
    if (activeConversation) {
      const allMessageIds = activeConversation.messages
        .filter(msg => msg.id)
        .map(msg => msg.id as string);
      
      if (allMessageIds.every(id => selectedMessageIds.includes(id))) {
        // Deselect all messages
        setSelectedMessageIds([]);
        console.log('Deselected all messages');
      } else {
        // Select all messages
        setSelectedMessageIds(allMessageIds);
        console.log('Selected all messages:', allMessageIds);
      }
    }
  };

  // Updated Jira integration function to match exact backend flow
  const handleJiraIntegration = () => {
    // Get the authentication token
    const authToken = localStorage.getItem('token') || 
                     localStorage.getItem('regular_token') || 
                     localStorage.getItem('google_auth_token');
    
    if (!authToken) {
      toast.error("Authentication required. Please log in again.");
      return;
    }
    
    // Define popup dimensions
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    // Show a loading toast
    const loadingToast = toast.loading("Connecting to Jira...");
    
    // Make the request with proper Authorization header
    fetch(`${API_URL}/auth/jira/login`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    })
    .then(response => {
      toast.dismiss(loadingToast);
      
      if (!response.ok) {
        throw new Error(`Auth request failed with status: ${response.status}`);
      }
      
      return response.json(); // Expecting JSON with auth_url
    })
    .then(data => {
      console.log("Received auth data:", data);
      
      // Get the auth_url from the response
      const authUrl = data.auth_url || data.url;
      
      if (!authUrl) {
        throw new Error("No authentication URL received from server");
      }
      
      console.log("Opening Jira auth popup to:", authUrl);
      
      // Open the popup with the Atlassian auth URL
      const popup = window.open(
        authUrl,
        'Jira_Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        return;
      }
      
      // Listen for messages from the popup
      const handleAuthMessage = (event) => {
        console.log("Received message:", event.origin, event.data);
        
        // Check if this message contains Jira token information
        if (event.data && event.data.type === 'jira_auth_success') {
          // Get the token (check both possible property names)
          const jiraToken = event.data.token || event.data.access_token;
          
          if (jiraToken) {
            console.log("Received Jira token, saving to localStorage");
            
            // Store the token in localStorage
            localStorage.setItem('jira_authorization', jiraToken);
            
            // Close the popup
            popup.close();
            
            // Clean up the event listener
            window.removeEventListener('message', handleAuthMessage);
            
            // Show success message
            toast.success("Successfully connected to Jira!");
            
            // Toggle the panel if it's not already visible
            if (!showIntegrationPanel) {
              setShowIntegrationPanel(true);
            }
            
            // Ensure the Jira tab is active
            setIntegrationTab('jira');
            
            // Trigger UI updates
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('jiraAuthUpdate'));
          } else {
            console.error("Received success message but no token found");
            toast.error("Authentication successful but no token received");
          }
        }
      };
      
      // Add the message listener
      window.addEventListener('message', handleAuthMessage);
      
      // Clean up if popup is closed manually
      const checkPopup = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleAuthMessage);
        }
      }, 1000);
    })
    .catch(error => {
      console.error("Error initiating Jira authentication:", error);
      toast.error("Error connecting to Jira: " + error.message);
    });
  };

  // Add these functions for GitHub and Azure (placeholders for now)
  const handleGitHubIntegration = () => {
    toast.info("GitHub integration coming soon!");
    setIntegrationTab('github');
    setShowIntegrationPanel(true);
  };

  const handleAzureIntegration = () => {
    toast.info("Azure DevOps integration coming soon!");
    setIntegrationTab('azure');
    setShowIntegrationPanel(true);
  };

  // Handle selecting a conversation
  const handleSelectConversation = async (conversation: any) => {
    setActiveConversation(conversation);
    setShowUploadUI(false);
  };
  
  // Handle new chat button
  const handleNewChat = () => {
    setActiveConversation(null);
    setShowUploadUI(true);
  };
  
  // Add this function to handle Jira disconnect
  const handleJiraDisconnect = () => {
    localStorage.removeItem('jira_authorization');
    toast.success("Disconnected from Jira");
    
    // Force refresh of the panel
    setShowIntegrationPanel(false);
    setTimeout(() => setShowIntegrationPanel(true), 10);
  };

  // Add a function to handle viewing a Jira issue
  const handleViewJiraIssue = (issueId: string) => {
    console.log("Viewing Jira issue:", issueId);
    setSelectedJiraIssue(issueId);
    setIsSplitView(true);
    setShowIntegrationPanel(false);
  };

  // Add a function to close the split view
  const handleCloseSplitView = () => {
    setIsSplitView(false);
    setSelectedJiraIssue(null);
  };

  // Add this to handle processing uploaded files
  const handleProcessFile = async () => {
    if (!uploadedFile) return;
    
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      
      // Get the token - try all possible token stores
      const token = localStorage.getItem('token') || 
                   localStorage.getItem('regular_token') || 
                   localStorage.getItem('google_auth_token');
                   
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Upload the file to the backend
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // If successful, create a new conversation
      if (response.data) {
        toast.success('Document processed successfully!');
        
        // Create a new conversation with the document info
        const newConversation = {
          id: response.data.chat_history_id || 'new_' + Date.now(),
          title: uploadedFile.name,
          document_id: response.data.document_id,
          created_at: new Date().toISOString(),
          messages: response.data.messages || []
        };
        
        setActiveConversation(newConversation);
        setShowUploadUI(false);
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('Failed to process document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add/update a useEffect to ensure the integration panel closes when split view is activated
  useEffect(() => {
    // When split view is activated, ensure the integration panel is closed
    if (isSplitView && selectedJiraIssue) {
      setShowIntegrationPanel(false);
    }
  }, [isSplitView, selectedJiraIssue]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      {/* Use the modular Sidebar component */}
      <Sidebar 
        expanded={sidebarExpanded}
        toggleExpanded={() => setSidebarExpanded(!sidebarExpanded)}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        logout={handleLogout}
        isMobile={isMobile}
        activeConversationId={activeConversation?.id || null}
      />
      
      {/* Rest of your Dashboard component */}
      <main 
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out
          ${!isMobile ? (sidebarExpanded ? 'ml-64' : 'ml-16') : (sidebarExpanded ? 'ml-64' : 'ml-0')}`}
        style={{ 
          position: 'relative',
          width: `calc(100% - ${sidebarExpanded ? '16rem' : isMobile ? '0' : '4rem'})`,
          marginLeft: `${sidebarExpanded ? '16rem' : isMobile ? '0' : '4rem'}`
        }}
      >
        {/* Sidebar section */}
        <div className="flex-none relative w-auto">
          <Sidebar 
            expanded={sidebarExpanded}
            toggleExpanded={toggleSidebar}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            logout={handleLogout}
            isMobile={isMobile}
            activeConversationId={activeConversation?.id || null}
          />
        </div>
        
        {/* Main content area with horizontal split view */}
        <div className="flex flex-1 h-full">
          {/* Main content area - take full width on mobile */}
          <div className={`${isSplitView && !isMobile ? 'w-1/2' : 'w-full'} h-full flex flex-col overflow-hidden`}>
            {activeConversation ? (
              // Chat window
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Chat header */}
                <div className="flex-none p-4 border-b border-white/10 flex justify-between items-center bg-indigo-950/50">
                  <h2 className="text-xl font-semibold text-white">{activeConversation.title}</h2>
                </div>
                
                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Select All checkbox header */}
                  <div className="sticky top-0 z-10 p-3 bg-[#141332]/90 border-b border-white/10 flex items-center">
                    <label className="flex items-center space-x-2 text-sm text-gray-300">
                      <input 
                        type="checkbox" 
                        checked={allMessagesSelected} 
                        onChange={toggleAllMessages}
                        className="form-checkbox h-4 w-4 rounded text-purple-500"
                      />
                      <span>Include all messages as context</span>
                    </label>
                  </div>
                  
                  <div className="p-4 space-y-6">
                    {/* Inside the message rendering section - looking for both user and AI messages */}
                    {activeConversation && activeConversation.messages.map((msg, index) => (
                      <div key={msg.id || index} className={`mb-4 flex items-start ${msg.role === 'user' ? 'mr-12' : 'ml-12'}`}>
                        {/* Checkbox for message selection */}
                        <div className="mr-2 mt-2">
                          <input 
                            type="checkbox"
                            checked={msg.id ? debugSelectionState(msg.id) : false}
                            onChange={() => msg.id && toggleMessageSelection(msg.id)}
                            className="form-checkbox h-4 w-4 rounded text-purple-500 cursor-pointer"
                          />
                        </div>
                        
                        {msg.role === 'assistant' ? (
                          // AI message with export options
                          <div className="flex-1 flex flex-col space-y-2 bg-[#1a1745] rounded-lg p-4 max-w-3xl overflow-hidden">
                            <div className="flex items-start space-x-3">
                              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-white">AI</span>
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="prose text-gray-100 max-w-none overflow-hidden break-words whitespace-pre-wrap">
                                  {/* Render markdown content */}
                                  <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} className="overflow-hidden" />
                                </div>
                                
                                {/* Export options bar */}
                                <div className="mt-4 pt-2 border-t border-white/10 flex justify-end space-x-2">
                                  <button 
                                    onClick={() => handleCopyMessage(msg)}
                                    className="flex items-center text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors !p-0"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Copy
                                  </button>
                                
                                  <button
                                    onClick={() => handleDownloadPDF(msg)}
                                    className="flex items-center text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors !p-0"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3 3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download PDF
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // User message
                          <div className="flex-1 bg-[#2b2a63] rounded-lg p-4 max-w-3xl overflow-hidden">
                            <div className="flex items-start space-x-3">
                              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-white whitespace-pre-wrap break-words overflow-hidden">{msg.content}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* This empty div is crucial for scrolling */}
                    <div ref={messagesEndRef} className="h-px w-full" />
                  </div>
                </div>
                {/* Chat input - only shown when conversation is active and not in upload mode */}
                {activeConversation && !showUploadUI && (
                  <div className="flex-none p-4 border-t border-white/10 bg-indigo-950/50">
                    <div className="relative">
                      <textarea
                        value={message}
                        onChange={handleMessageChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type your message here..."
                        className="w-full px-4 py-3 pr-16 bg-white/5 border border-white/10 rounded-lg text-white 
                          placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500
                          min-h-[50px] max-h-[96px] overflow-y-auto resize-none"
                        style={{ height: 'auto', lineHeight: '1.5' }}
                        rows={1}
                        ref={textareaRef}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || isSendingMessage}
                        className="absolute right-5 bottom-2.5 p-1.5
                          bg-gradient-to-r from-blue-600 to-purple-600 rounded-full
                          border border-purple-500/30 shadow-md text-white
                          hover:from-blue-500 hover:to-purple-500 focus:outline-none
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-all duration-200"
                      >
                        {isSendingMessage ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Upload UI
              <div className="flex-1 flex flex-col overflow-y-auto bg-indigo-950">
                <div className="max-w-3xl mx-auto w-full py-12 px-4">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Upload Your Document</h1>
                    <p className="text-lg text-gray-300">Upload a project document to analyze requirements, and get AI assistance</p>
                  </div>
                  
                  <div className="bg-indigo-900/40 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-white mb-2">Document Upload</h2>
                      <p className="text-gray-300">Upload project requirements, specifications, or any documents you need to analyze</p>
                    </div>
                    
                    {uploadedFile ? (
                      <div className="mb-6">
                        <div className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10">
                          <div className="mr-4 bg-indigo-600 rounded-md p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 truncate">
                            <p className="text-sm font-medium text-white truncate">{uploadedFile.name}</p>
                            <p className="text-xs text-gray-400">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <button 
                            onClick={() => setUploadedFile(null)}
                            className="ml-4 text-gray-400 hover:text-white"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <button
                          onClick={handleProcessFile}
                          disabled={isProcessing}
                          className="w-full mt-4 py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600
                            border border-purple-500/30 shadow-md transform transition-all duration-200 
                            hover:translate-y-[-2px] hover:shadow-lg hover:shadow-purple-500/30 
                            hover:from-blue-500 hover:to-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="relative z-10 flex items-center justify-center text-white font-semibold">
                            {isProcessing ? (
                              <>
                                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Process Document
                              </>
                            )}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="border-2 border-dashed border-white/20 rounded-lg p-12 text-center cursor-pointer hover:border-purple-400/50 transition-colors"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            setUploadedFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => document.getElementById('fileInput')?.click()}
                      >
                        <input
                          id="fileInput"
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setUploadedFile(e.target.files[0]);
                            }
                          }}
                          accept=".pdf,.doc,.docx,.txt,.md"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-lg font-medium text-white mb-1">Drag and drop your file here</p>
                        <p className="text-sm text-gray-400 mb-4">or click to browse files</p>
                        <p className="text-xs text-gray-500">Supported formats: PDF, DOC, DOCX, TXT, MD</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 text-center">
                    <h3 className="text-xl font-medium text-white mb-4">Or start a new conversation</h3>
                    <button
                      onClick={() => {
                        // Create a new empty conversation
                        const newConversation = {
                          id: 'new_' + Date.now(),
                          title: 'New Chat',
                          created_at: new Date().toISOString(),
                          messages: []
                        };
                        setActiveConversation(newConversation);
                        setShowUploadUI(false);
                      }}
                      className="py-3 px-6 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 transition-colors"
                    >
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Start New Chat
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right panel - Jira issue detail (only visible in split view AND on desktop) */}
          {isSplitView && selectedJiraIssue && !isMobile && (
            <div className="w-1/2 border-l border-white/10 overflow-auto bg-indigo-950/80">
              <JiraIssueDetail 
                issueId={selectedJiraIssue} 
                onClose={handleCloseSplitView} 
              />
            </div>
          )}
        </div>
      </main>
      {/* For mobile devices, we'll show a modal instead of split view */}
      {isSplitView && selectedJiraIssue && isMobile && (
        <div className="fixed inset-0 z-50 bg-indigo-950/90 overflow-auto">
          <JiraIssueDetail 
            issueId={selectedJiraIssue} 
            onClose={handleCloseSplitView} 
          />
        </div>
      )}
      {/* Add Toast Container at the bottom of your return statement */}
      <div className="fixed bottom-4 right-4 z-50">
        {/* Toast notifications will appear here */}
      </div>
      {/* Integration panel */}
      <RightSidebar
        onJiraConnect={handleJiraIntegration}
        onGitHubConnect={handleGitHubIntegration}
        onAzureConnect={handleAzureIntegration}
        jiraToken={localStorage.getItem('jira_authorization')}
        onViewJiraIssue={handleViewJiraIssue}
        isVisible={showIntegrationPanel}
        onTogglePanel={setShowIntegrationPanel}
        isSplitView={isSplitView}
      />
    </div>
  );
};

export default Dashboard;