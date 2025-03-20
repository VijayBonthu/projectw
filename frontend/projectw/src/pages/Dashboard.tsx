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
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const fileType = selectedFile.type;
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      // Check if file type is allowed
      if (
        fileType.includes('pdf') || 
        fileType.includes('powerpoint') || 
        fileType.includes('text/plain') || 
        fileType.includes('text/csv') ||
        fileExtension === 'pdf' ||
        fileExtension === 'ppt' ||
        fileExtension === 'pptx' ||
        fileExtension === 'txt' ||
        fileExtension === 'csv'
      ) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload only PDF, PPT, CSV, or TXT files');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
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
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

      const formData = new FormData();
    formData.append('file', file);

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
      
      // Upload the file and get initial analysis
      const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });
      
      setIsProcessing(true);
      
      // Get document_id and other data from the upload response
      const documentId = uploadResponse.data.document_id;
      const chatTitle = uploadResponse.data.title || `Analysis of ${file.name}`;
      
      // Create a message from the upload response
      const initialMessage: Message = {
        role: "assistant", // Upload response is from assistant/system
        content: uploadResponse.data.message || "Document processed successfully",
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
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.response?.data?.detail || 'Failed to upload and process document');
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
    
    if (!message.trim() || !activeConversation) return;
    
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
          localStorage.setItem('user_id', userId);
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
        content: chatResponse.data.response || "Sorry, I couldn't generate a response.",
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
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    setActiveConversation(null);
    setRecommendation(null);
    setFile(null);
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
                hover:shadow-md hover:shadow-purple-500/10"
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
                <div className="space-y-4">
                    {/* Today's conversations */}
                    {groupedConversations.today.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Today</h3>
                        <ul className="space-y-2">
                          {groupedConversations.today.map(conversation => (
                            <li key={conversation.chat_history_id}>
                  <button
                                onClick={() => selectConversation(conversation.chat_history_id)}
                                className={`w-full text-left p-3 rounded-lg transition-all duration-200 
                                ${activeConversation?.id === conversation.chat_history_id 
                                  ? 'bg-white/20 border border-purple-500/30' 
                                  : 'hover:bg-white/10 border border-transparent'}`}
                                title={conversation.title}
                              >
                                <div className="font-medium truncate max-w-full text-fade">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {new Date(conversation.modified_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                  </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Yesterday's conversations */}
                    {groupedConversations.yesterday.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Yesterday</h3>
                        <ul className="space-y-2">
                          {groupedConversations.yesterday.map(conversation => (
                            <li key={conversation.chat_history_id}>
                              <button
                                onClick={() => selectConversation(conversation.chat_history_id)}
                                className={`w-full text-left p-3 rounded-lg transition-all duration-200 
                                ${activeConversation?.id === conversation.chat_history_id 
                                  ? 'bg-white/20 border border-purple-500/30' 
                                  : 'hover:bg-white/10 border border-transparent'}`}
                                title={conversation.title}
                              >
                                <div className="font-medium truncate max-w-full text-fade">
                                  {conversation.title}
                      </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {new Date(conversation.modified_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Last week's conversations */}
                    {groupedConversations.lastWeek.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Last 7 Days</h3>
                        <ul className="space-y-2">
                          {groupedConversations.lastWeek.map(conversation => (
                            <li key={conversation.chat_history_id}>
                      <button
                                onClick={() => selectConversation(conversation.chat_history_id)}
                                className={`w-full text-left p-3 rounded-lg transition-all duration-200 
                                ${activeConversation?.id === conversation.chat_history_id 
                                  ? 'bg-white/20 border border-purple-500/30' 
                                  : 'hover:bg-white/10 border border-transparent'}`}
                                title={conversation.title}
                              >
                                <div className="font-medium truncate max-w-full text-fade">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {new Date(conversation.modified_at).toLocaleDateString()}
                                </div>
                      </button>
                            </li>
                          ))}
                        </ul>
                    </div>
                  )}
                  
                    {/* Older conversations */}
                    {groupedConversations.older.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Older</h3>
                        <ul className="space-y-2">
                          {groupedConversations.older.map(conversation => (
                            <li key={conversation.chat_history_id}>
                  <button
                                onClick={() => selectConversation(conversation.chat_history_id)}
                                className={`w-full text-left p-3 rounded-lg transition-all duration-200 
                                ${activeConversation?.id === conversation.chat_history_id 
                                  ? 'bg-white/20 border border-purple-500/30' 
                                  : 'hover:bg-white/10 border border-transparent'}`}
                                title={conversation.title}
                              >
                                <div className="font-medium truncate max-w-full text-fade">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {new Date(conversation.modified_at).toLocaleDateString()}
                                </div>
                  </button>
                            </li>
                          ))}
                        </ul>
                </div>
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
                    disabled={!message.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg 
                      border border-purple-500/30 shadow-md text-white font-medium
                      hover:from-blue-500 hover:to-purple-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
                </form>
              </div>
            </div>
          ) : (
            // Welcome screen with two possible states
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              {Object.values(groupedConversations).flat().length > 0 ? (
                // Some conversations exist but none selected
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
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-medium hover:bg-white/20 transition-all"
                      >
                        Upload New Document
                      </button>
              </div>
            </div>
                </div>
              ) : (
                // No conversations exist yet - show upload UI
                <div className="max-w-2xl mx-auto w-full">
                  <div className="backdrop-blur-sm bg-white/5 rounded-3xl border border-white/10 p-8 shadow-2xl">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300">
                        Upload Requirements Document
                      </h2>
                      <p className="text-gray-300">
                        Upload your client's requirements document to get AI-powered analysis and recommendations
                      </p>
        </div>
        
                    {error && (
                      <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 rounded-md text-white">
                        {error}
                      </div>
                    )}
                    
                    <div className="mb-6">
                      <label 
                        htmlFor="file-upload" 
                        className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-white/30 p-12 text-center hover:border-purple-500/50 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
                          <span className="text-lg font-medium text-gray-300">
                            {file ? file.name : 'Click to upload or drag and drop'}
                          </span>
                          <span className="text-sm text-gray-400 mt-2">
                            PDF, PPT, CSV, or TXT (max 10MB)
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
                        />
                      </label>
                    </div>
                    
                    {file && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-300">Selected file:</span>
                          <span className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1 bg-white/10 rounded-full h-2 mr-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" 
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-400">{uploadProgress}%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-center">
            <button
                        onClick={handleUpload}
                        disabled={!file || isUploading || isProcessing}
                        className="py-3 px-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600
                        border border-purple-500/30 shadow-md transform transition-all duration-200 
                        hover:translate-y-[-2px] hover:shadow-lg hover:shadow-purple-500/30 
                        hover:from-blue-500 hover:to-purple-500 focus:outline-none disabled:opacity-50"
                      >
                        <span className="relative z-10 flex items-center justify-center text-white font-semibold">
                          {isUploading ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                              Uploading...
                            </>
                          ) : isProcessing ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Analyzing Document...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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