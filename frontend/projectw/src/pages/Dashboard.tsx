import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Define the API URL correctly for Vite
const API_URL = import.meta.env.VITE_API_URL;

// Add proper TypeScript interfaces
interface ChatItem {
  id: number;
  title: string;
  date: string;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

interface FileItem {
  id: number;
  name: string;
  size: number;
  type: string;
}

interface IntegrationItem {
  id: string;
  title: string;
  type: string;
  status?: string;
  key?: string;
  lastUpdated?: string;
}

interface IntegrationState {
  connected: boolean;
  data: IntegrationItem[];
}

// Processing status interface
interface ProcessingStep {
  name: string;
  status: 'waiting' | 'in-progress' | 'completed' | 'error';
  message?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    { id: 1, title: 'Previous Chat 1', date: '2023-08-01' },
    { id: 2, title: 'Previous Chat 2', date: '2023-08-05' },
    { id: 3, title: 'Previous Chat 3', date: '2023-08-10' },
  ]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, IntegrationState>>({
    jira: { connected: false, data: [] },
    workplace: { connected: false, data: [] },
    github: { connected: false, data: [] }
  });
  const [attachedItems, setAttachedItems] = useState<IntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  
  // Document upload and processing states
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { name: 'Reading document', status: 'waiting' },
    { name: 'Processing content', status: 'waiting' },
    { name: 'Analyzing data', status: 'waiting' },
    { name: 'Generating recommendations', status: 'waiting' },
    { name: 'Finalizing', status: 'waiting' }
  ]);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Setup axios interceptor for 401 errors
  useEffect(() => {
    // Create response interceptor
    const interceptor = axios.interceptors.response.use(
      response => response, // Return successful responses as-is
      error => {
        // Handle 401 Unauthorized errors
        if (error.response && error.response.status === 401) {
          // Clear tokens from localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('google_auth_token');
          localStorage.removeItem('regular_token');
          
          // Redirect to login page
          navigate('/login');
        }
        
        // Reject the promise for other errors
        return Promise.reject(error);
      }
    );
    
    // Remove the interceptor when component unmounts
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for token and load dashboard data
  useEffect(() => {
    const token = localStorage.getItem('token') || 
                 localStorage.getItem('google_auth_token') || 
                 localStorage.getItem('regular_token');
    
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Convert FileList to array and add to uploadedFiles
      const newFiles = Array.from(e.dataTransfer.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      setDocumentUploaded(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to array and add to uploadedFiles
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      setDocumentUploaded(true);
      
      // Reset the input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setDocumentUploaded(false);
    }
  };

  const updateProcessingStep = (index: number, status: 'waiting' | 'in-progress' | 'completed' | 'error', message?: string) => {
    setProcessingSteps(prevSteps => {
      const newSteps = [...prevSteps];
      newSteps[index] = { ...newSteps[index], status, ...(message && { message }) };
      return newSteps;
    });
  };

  // Process documents with popup for ngrok bypass
  const processDocuments = async () => {
    if (uploadedFiles.length === 0) return;
    
    setIsProcessing(true);
    setProcessingComplete(false);
    setProcessingError(null);
    
    // Reset processing steps
    setProcessingSteps(prevSteps => 
      prevSteps.map(step => ({ ...step, status: 'waiting', message: undefined }))
    );
    
    // Get authentication token
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('google_auth_token') || 
                  localStorage.getItem('regular_token');
    
    if (!token) {
      setProcessingError('Authentication token not found. Please login again.');
      setIsProcessing(false);
      return;
    }

    try {
      // Update first step status
      updateProcessingStep(0, 'in-progress', 'Uploading document');
      
      // Create FormData object
      const formData = new FormData();
      formData.append('file', uploadedFiles[0]); // For now, just process the first file
      
      // Send request to backend
      const response = await axios.post(`${API_URL}/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // Update first step progress based on upload
            updateProcessingStep(0, 'in-progress', `Uploading: ${percentCompleted}%`);
          }
        }
      });

      // Mark upload as complete
      updateProcessingStep(0, 'completed', 'Upload complete');
      
      // Get task ID from response
      if (response.data && response.data.task_id) {
        // Open a popup window for status tracking (bypasses ngrok security page)
        const statusUrl = `${API_URL}/status-page/${response.data.task_id}?token=${encodeURIComponent(token)}`;
        console.log('Opening status window:', statusUrl);
        const statusWindow = window.open(statusUrl, 'TaskStatus', 'width=1,height=1,left=-1000,top=-1000');
          
          if (!statusWindow) {
            console.error('Popup blocked! Please allow popups for this site.');
            return;
          }
        
        // Listen for messages from the status window
        const handleStatusUpdate = (event: MessageEvent) => {
          if (event.data && event.data.type === 'task_status_update') {
            const { status, current_step, step_progress, message, result } = event.data;
            
            console.log('Received status update:', event.data);
            
            // Update UI based on progress
            if (current_step >= 0 && current_step < processingSteps.length) {
              // Mark previous steps as completed
              for (let i = 0; i < current_step; i++) {
                if (processingSteps[i].status !== 'completed') {
                  updateProcessingStep(i, 'completed');
                }
              }
              
              // Update current step
              updateProcessingStep(
                current_step, 
                'in-progress', 
                message || `Progress: ${step_progress}%`
              );
            }
            
            // Check if processing is complete
            if (status === 'completed') {
              // Mark all steps as completed
              processingSteps.forEach((_, index) => {
                updateProcessingStep(index, 'completed');
              });
              
              setProcessingComplete(true);
              setIsProcessing(false);
              setProcessingResult(result);
              
              // Add a welcome message to start the chat
              setMessages([
                {
                  id: 1,
                  content: "I've analyzed your document. What would you like to know about it?",
                  sender: 'assistant',
                  timestamp: new Date().toISOString()
                }
              ]);
              
              // Add this document to the chat history
              const newChatItem = {
                id: chatHistory.length + 1,
                title: uploadedFiles[0].name,
                date: new Date().toLocaleDateString()
              };
              setChatHistory([newChatItem, ...chatHistory]);
              setActiveChat(newChatItem.id);
              
              // Close the status window
              if (statusWindow && !statusWindow.closed) {
                statusWindow.close();
              }
              
              // Remove the event listener
              window.removeEventListener('message', handleStatusUpdate);
            }
            
            // Handle error status
            if (status === 'error') {
              setProcessingError(message || 'An error occurred during processing');
              setIsProcessing(false);
              
              // Close the status window
              if (statusWindow && !statusWindow.closed) {
                statusWindow.close();
              }
              
              // Remove the event listener
              window.removeEventListener('message', handleStatusUpdate);
            }
          }
        };
        
        // Add the message event listener
        window.addEventListener('message', handleStatusUpdate);
        
        // Cleanup if window closes unexpectedly
        const checkClosed = setInterval(() => {
          if (statusWindow && statusWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleStatusUpdate);
            
            // If still processing, show error
            if (isProcessing) {
              setProcessingError('Status monitoring was interrupted. Please try again.');
              setIsProcessing(false);
            }
          }
        }, 1000);
      } else {
        // Fallback for backends that don't support task_id
        handleLegacyResponse(response);
      }
    } catch (error) {
      console.error('Error processing documents:', error);
      
      // Mark current step as error
      const currentStepIndex = processingSteps.findIndex(step => step.status === 'in-progress');
      if (currentStepIndex !== -1) {
        updateProcessingStep(
          currentStepIndex, 
          'error', 
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
      
      setProcessingError('Failed to process document. Please try again.');
      setIsProcessing(false);
    }
  };

  // Handle response from backends that don't support task IDs
  const handleLegacyResponse = (response: any) => {
    // Simulate document processing steps with delays to show progress
    updateProcessingStep(0, 'completed');
    
    setTimeout(() => {
      updateProcessingStep(1, 'in-progress');
      setTimeout(() => {
        updateProcessingStep(1, 'completed');
        updateProcessingStep(2, 'in-progress');
        
        setTimeout(() => {
          updateProcessingStep(2, 'completed');
          updateProcessingStep(3, 'in-progress');
          
          setTimeout(() => {
            updateProcessingStep(3, 'completed');
            updateProcessingStep(4, 'in-progress');
            
            setTimeout(() => {
              updateProcessingStep(4, 'completed');
              setProcessingComplete(true);
              setIsProcessing(false);
              setProcessingResult(response.data);
              
              // Add a welcome message to start the chat
              setMessages([
                {
                  id: 1,
                  content: "I've analyzed your document. What would you like to know about it?",
                  sender: 'assistant',
                  timestamp: new Date().toISOString()
                }
              ]);
              
              // Add this document to the chat history
              const newChatItem = {
                id: chatHistory.length + 1,
                title: uploadedFiles[0].name,
                date: new Date().toLocaleDateString()
              };
              setChatHistory([newChatItem, ...chatHistory]);
              setActiveChat(newChatItem.id);
              
            }, 1000); // Final step
          }, 1500); // Generating recommendations
        }, 2000); // Analyzing data
      }, 1500); // Processing content
    }, 1000); // After reading document
  };

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleNewChat = () => {
    setActiveChat(null);
    setMessages([]);
    setMessage('');
    setAttachedItems([]);
    setDocumentUploaded(false);
    setUploadedFiles([]);
    setProcessingComplete(false);
    setProcessingError(null);
    setProcessingResult(null);
    setIsProcessing(false);
  };

  const handleChatSelect = (chatId: number) => {
    setActiveChat(chatId);
    // In a real app, you would load chat messages from the selected chat
    setMessages([
      {
        id: 1,
        content: "Hello! How can I help you with this document?",
        sender: 'assistant',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;
    
    const newMessage: Message = {
      id: messages.length + 1,
      content: message,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setIsLoading(true);
    
    try {
      // In a real app, you would send the message to your backend API
      // const response = await axios.post(`${API_URL}/chat`, { message, chatId: activeChat });
      
      // Simulate a delay for the AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: messages.length + 2,
          content: "This is a simulated response. In a real application, this would come from your backend API.",
          sender: 'assistant',
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleConnectJira = (provider: string) => {
    // Get token from localStorage
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('google_auth_token') || 
                  localStorage.getItem('regular_token');
    
    if (!token) {
      console.error('No authentication token found');
      return;
    }
    
    // Create the Jira auth URL with token as query param
    const jiraAuthUrl = `${API_URL}/auth/jira/login?token=${encodeURIComponent(token)}`;
    
    // Open the Jira auth in a popup window with the token in the URL
    const jiraAuthWindow = window.open(
      jiraAuthUrl,
      'JiraAuth',
      'width=800,height=600,left=200,top=100'
    );
    
    if (!jiraAuthWindow) {
      console.error('Popup blocked! Please allow popups for this site.');
      return;
    }
    
    // Set up listener to receive the Jira token from the popup
    const handleJiraAuthCallback = (event: MessageEvent) => {
      if (event.data && event.data.type === 'jira_auth_success' && event.data.access_token) {
        console.log("Jira authentication successful, token received");
        
        // Get the token
        const jiraToken = event.data.access_token;
        
        // Store Jira information
        const updatedIntegrations = { ...integrations };
        updatedIntegrations[provider].connected = true;
        setIntegrations(updatedIntegrations);
        
        // Close the popup
        if (jiraAuthWindow && !jiraAuthWindow.closed) {
          jiraAuthWindow.close();
        }
        
        // Remove the event listener
        window.removeEventListener('message', handleJiraAuthCallback);
      }
    };
    
    // Add the message event listener
    window.addEventListener('message', handleJiraAuthCallback);
    
    // Cleanup if window closes without completing auth
    const checkClosed = setInterval(() => {
      if (jiraAuthWindow && jiraAuthWindow.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleJiraAuthCallback);
      }
    }, 1000);
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('google_auth_token');
    localStorage.removeItem('regular_token');
    navigate('/login');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Proware AI</h1>
          <button 
            onClick={handleSignOut}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Chat history */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <button 
              onClick={handleNewChat}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Chat
            </button>
            
            <div className="mt-6">
              <h2 className="text-sm font-medium text-gray-500">Recent Chats</h2>
              <ul className="mt-2 space-y-1">
                {chatHistory.map(chat => (
                  <li key={chat.id}>
                    <button 
                      onClick={() => handleChatSelect(chat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg ${
                        activeChat === chat.id 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium truncate">{chat.title}</div>
                      <div className="text-xs text-gray-500">{chat.date}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Middle panel - Chat or document upload interface */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!documentUploaded ? (
            // Document upload interface
            <div 
              className={`flex-1 flex flex-col items-center justify-center p-8 ${
                dragActive ? 'bg-blue-50 border-2 border-dashed border-blue-400' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="max-w-md w-full text-center">
                <div className="bg-white p-8 rounded-lg shadow-md">
                  <div className="text-4xl text-blue-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Upload your document</h2>
                  <p className="text-gray-600 mb-6">
                    Drag and drop your document here, or click to browse files
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Browse Files
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                  />
                </div>
              </div>
            </div>
          ) : isProcessing ? (
            // Processing status display
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="max-w-md w-full">
                <div className="bg-white p-8 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-6 text-center">Processing Document</h2>
                  
                  <div className="space-y-4">
                    {processingSteps.map((step, index) => (
                      <div key={index} className="flex items-center">
                        {/* Status icon */}
                        {step.status === 'waiting' && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300 mr-3"></div>
                        )}
                        {step.status === 'in-progress' && (
                          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mr-3"></div>
                        )}
                        {step.status === 'completed' && (
                          <div className="w-6 h-6 rounded-full bg-green-500 mr-3 flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {step.status === 'error' && (
                          <div className="w-6 h-6 rounded-full bg-red-500 mr-3 flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        
                        {/* Step name */}
                        <div className="flex-1">
                          <span className={`font-medium ${
                            step.status === 'in-progress' ? 'text-blue-600' :
                            step.status === 'completed' ? 'text-green-600' :
                            step.status === 'error' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {step.name}
                          </span>
                          
                          {step.message && (
                            <p className="text-sm text-gray-500 mt-1">{step.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {processingError && (
                    <div className="mt-6 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
                      {processingError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeChat ? (
            // Chat interface
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`inline-block p-3 rounded-lg ${
                          msg.sender === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center text-gray-500">
                      <div className="dot-flashing mr-2"></div>
                      <span>AI is thinking...</span>
                    </div>
                  )}
                  <div ref={messageEndRef} />
                </div>
              </div>
              
              {/* Message input area */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="max-w-3xl mx-auto flex">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask a question about your document..."
                    className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !message.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Uploaded files awaiting processing
            <div className="flex-1 flex flex-col p-8">
              <div className="max-w-3xl mx-auto w-full">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Selected Files</h2>
                  
                  <div className="space-y-3 mb-6">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <div className="font-medium">{file.name}</div>
                            <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                    >
                      Add More Files
                    </button>
                    
                    <button
                      onClick={processDocuments}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Process Documents
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Right panel - Integrations */}
        <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Integrations</h2>
            
            <div className="space-y-4">
              <div className="border rounded p-3">
                <h3 className="font-medium">Jira</h3>
                {integrations.jira.connected ? (
                  <div className="mt-2 text-sm">
                    <div className="text-green-600 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Connected
                    </div>
                    <p className="mt-1">Access your Jira issues</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnectJira('jira')}
                    className="mt-2 w-full py-1 px-2 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                  >
                    Connect
                  </button>
                )}
              </div>
              
              <div className="border rounded p-3">
                <h3 className="font-medium">GitHub</h3>
                {integrations.github.connected ? (
                  <div className="mt-2 text-sm">
                    <div className="text-green-600 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Connected
                    </div>
                    <p className="mt-1">Access your GitHub repos</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnectJira('github')}
                    className="mt-2 w-full py-1 px-2 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                  >
                    Connect
                  </button>
                )}
              </div>
              
              <div className="border rounded p-3">
                <h3 className="font-medium">Workplace</h3>
                {integrations.workplace.connected ? (
                  <div className="mt-2 text-sm">
                    <div className="text-green-600 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Connected
                    </div>
                    <p className="mt-1">Access your Workplace docs</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnectJira('workplace')}
                    className="mt-2 w-full py-1 px-2 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 