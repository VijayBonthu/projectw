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
  const [showSidebar, setShowSidebar] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      // Fetch existing conversations
      fetchConversations();
    }
  }, [isAuthenticated, navigate]);

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
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('regular_token') || 
                    localStorage.getItem('google_auth_token');
      
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      // This endpoint returns all chat histories with full content
      const response = await axios.get(`${API_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load your conversations');
    }
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
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('regular_token') || 
                    localStorage.getItem('google_auth_token');
      
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      // 1. Upload the file
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
      
      // Get document_id from the upload response
      const documentId = uploadResponse.data.document_id;
      
      // Get user_id from localStorage or fetch it
      let userId = localStorage.getItem('user_id');
      if (!userId) {
        try {
          const userResponse = await axios.get(`${API_URL}/decode_token/${token}`, {
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
          setIsUploading(false);
          setIsProcessing(false);
          return;
        }
      }
      
      // 2. Get initial analysis via chat-with-doc
      const initialUserMessage: Message = {
        role: "user",
        content: "Analyze this document and provide recommendations",
        timestamp: new Date().toISOString()
      };
      
      const chatResponse = await axios.post(`${API_URL}/chat-with-doc`, 
        { 
          message: initialUserMessage,
          document_id: documentId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Format the AI response correctly
      const aiResponse: Message = {
        role: "assistant",
        content: chatResponse.data.message || chatResponse.data, // Handle different response formats
        timestamp: new Date().toISOString()
      };
      
      // Extract recommendations if available
      try {
        if (aiResponse.content && aiResponse.content.includes('```json')) {
          const jsonMatch = aiResponse.content.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            const recommendationData = JSON.parse(jsonMatch[1]);
            setRecommendation(recommendationData);
          }
        }
      } catch (error) {
        console.error('Error parsing recommendation data:', error);
      }
      
      // 3. Save the conversation to the database
      const saveResponse = await axios.post(`${API_URL}/chat`, 
        { 
          user_id: userId,
          document_id: documentId,
          message: [initialUserMessage, aiResponse], // Properly formatted messages
          title: `Analysis of ${file.name}`
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Create a properly structured conversation from the response
      const newConversation: Conversation = {
        id: saveResponse.data.id || saveResponse.data.chat_history_id,
        title: `Analysis of ${file.name}`,
        created_at: new Date().toISOString(),
        messages: [initialUserMessage, aiResponse]
      };
      
      // Set active conversation with the properly formatted conversation object
      setActiveConversation(newConversation);
      
      // Also add this conversation to the conversations list
      setConversations(prev => [newConversation, ...prev]);
      
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

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !activeConversation) return;
    
    // Create message object
    const newMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    // Optimistically add user message to UI
    setActiveConversation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, newMessage]
      };
    });
    
    setMessage('');
    
    try {
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('regular_token') || 
                    localStorage.getItem('google_auth_token');
      
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      // Get user_id from localStorage or fetch it
      let userId = localStorage.getItem('user_id');
      if (!userId) {
        try {
          const userResponse = await axios.get(`${API_URL}/decode_token/${token}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          userId = userResponse.data.id;
          localStorage.setItem('user_id', userId);
        } catch (error) {
          console.error('Error decoding token:', error);
        }
      }

      // 1. First send message to chat-with-doc to get AI response
      const chatResponse = await axios.post(`${API_URL}/chat-with-doc`, 
        { 
          message: newMessage,
          chat_history_id: activeConversation.id
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Format the AI response correctly
      const aiResponse: Message = {
        role: "assistant",
        content: chatResponse.data.message || chatResponse.data,
        timestamp: new Date().toISOString()
      };
      
      // Update UI with AI response
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, aiResponse]
        };
      });
      
      // 2. Then save the conversation to the database
      await axios.post(`${API_URL}/chat`, 
        { 
          chat_history_id: activeConversation.id,
          user_id: userId,
          message: [newMessage, aiResponse] // Properly formatted messages
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh conversations list to update titles
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };

  // Select a conversation from the sidebar
  const selectConversation = async (conversationId: string) => {
    try {
      // Find the conversation in our already loaded data
      const selectedConversation = conversations.find(conv => conv.id === conversationId);
      
      if (selectedConversation) {
        setActiveConversation(selectedConversation);
        setRecommendation(null); // Clear any previous recommendation
        
        // Extract recommendations from the assistant's first response if available
        if (selectedConversation.messages && selectedConversation.messages.length > 0) {
          try {
            // Find the first assistant message that contains JSON data
            const assistantMessage = selectedConversation.messages.find(
              msg => msg.role === 'assistant' && msg.content.includes('```json')
            );
            
            if (assistantMessage) {
              // Extract JSON from the message
              const jsonMatch = assistantMessage.content.match(/```json\n([\s\S]*?)\n```/);
              if (jsonMatch && jsonMatch[1]) {
                const recommendationData = JSON.parse(jsonMatch[1]);
                setRecommendation(recommendationData);
              }
            }
          } catch (error) {
            console.error('Error parsing recommendation data:', error);
            // Continue even if parsing fails - we'll just show the raw message
          }
        }
      } else {
        // If not found in our local data (rare case), fetch it
        const token = localStorage.getItem('token') || 
                    localStorage.getItem('regular_token') || 
                    localStorage.getItem('google_auth_token');
      
        if (!token) {
          logout();
          navigate('/login');
          return;
        }

        const response = await axios.get(`${API_URL}/chat/${conversationId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setActiveConversation(response.data);
        
        // Same recommendation extraction logic as above
        // ... (omitted for brevity)
      }
    } catch (error) {
      console.error('Error selecting conversation:', error);
      setError('Failed to load conversation');
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

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
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
            <button 
              onClick={toggleSidebar}
              className="mr-4 p-2 rounded-md hover:bg-white/10 transition-colors md:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
              className="px-4 py-2 rounded-md border border-white/20 bg-white/5 backdrop-blur-sm 
              hover:bg-white/10 transition-all transform duration-200 hover:translate-y-[-2px] 
              hover:shadow-lg hover:shadow-white/10"
            >
              <span className="text-white font-semibold">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content - explicitly use remaining height */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-73px)]">
        {/* Sidebar with explicit height */}
        <aside className={`${showSidebar ? 'w-80' : 'w-0'} 
          h-[calc(100vh-73px)] transition-all duration-300 border-r border-white/10 bg-black/10 
          flex-shrink-0 overflow-hidden md:relative absolute z-10`}>
          {/* New conversation button */}
          <div className="p-4 border-b border-white/10">
            <button 
              onClick={startNewConversation}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600
              border border-purple-500/30 shadow-md transform transition-all duration-200 
              hover:translate-y-[-2px] hover:shadow-lg hover:shadow-purple-500/30 
              hover:from-blue-500 hover:to-purple-500 focus:outline-none"
            >
              <span className="relative z-10 flex items-center justify-center text-white font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Analysis
              </span>
            </button>
          </div>
          
          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-300">Your Analyses</h2>
              
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No analyses yet</p>
                  <p className="text-sm mt-2">Upload a document to get started</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {conversations.map(conversation => (
                    <li key={conversation.id}>
                      <button
                        onClick={() => selectConversation(conversation.id)}
                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 
                        ${activeConversation?.id === conversation.id 
                          ? 'bg-white/20 border border-purple-500/30' 
                          : 'hover:bg-white/10 border border-transparent'}`}
                      >
                        <div className="font-medium truncate">{conversation.title}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(conversation.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Main content area - with explicit height */}
        <main className="flex-1 flex flex-col h-[calc(100vh-73px)] overflow-hidden">
          {activeConversation ? (
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
                    onChange={(e) => setMessage(e.target.value)}
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
            // Upload interface
            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto h-[calc(100vh-73px)]">
              <div className="w-full max-w-2xl">
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
            </div>
          )}
        </main>
      </div>

      {/* Add CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;