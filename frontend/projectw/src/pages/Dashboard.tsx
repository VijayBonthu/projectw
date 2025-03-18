import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getChatHistory, deleteChat, saveChat, ChatItem, MessageContent, getChatMessages } from '../services/chatService';
import DocumentRenderer from '../components/DocumentRenderer';
import html2pdf from 'html2pdf.js';

// Define the API URL correctly for Vite
const API_URL = import.meta.env.VITE_API_URL;

// Define the ChatItem interface for proper type checking
interface DashboardChatItem extends ChatItem {
  chat_history_id: string;
  document_id?: string;
  title: string;
  modified_at: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'documents'>('chat');
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [chatHistory, setChatHistory] = useState<DashboardChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageContent[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentsData, setDocumentsData] = useState<any[]>([]);
  const [activeDocument, setActiveDocument] = useState<any | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string>('');
  const [chatTitle, setChatTitle] = useState('Untitled Chat');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize sidebars to collapsed state
  const [leftSidebarExpanded, setLeftSidebarExpanded] = useState(false);
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false);
  
  // States for handling document processing
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  // Add new state variables for pinned sidebars
  const [leftSidebarPinned, setLeftSidebarPinned] = useState(false);
  const [rightSidebarPinned, setRightSidebarPinned] = useState(false);

  // Handler functions for sidebars
  const toggleLeftSidebar = () => {
    setLeftSidebarExpanded(!leftSidebarExpanded);
  };

  const toggleRightSidebar = () => {
    setRightSidebarExpanded(!rightSidebarExpanded);
  };

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('regular_token') || 
                  localStorage.getItem('google_auth_token');
    
    if (!token) {
      navigate('/login');
    } else {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchDocuments();
      fetchChatHistory();
    }
  }, [navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling for document processing status
  useEffect(() => {
    if (taskId && pollingInterval) {
      return () => {
        if (pollingInterval) clearInterval(pollingInterval);
      };
    }
  }, [taskId, pollingInterval]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('regular_token');
    localStorage.removeItem('google_auth_token');
    navigate('/login');
  };

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      const history = await getChatHistory();
      
      // Make sure history is an array before setting state
      if (Array.isArray(history)) {
        setChatHistory(history as DashboardChatItem[]);
      } else {
        console.error('Chat history is not an array:', history);
        // Initialize with empty array to prevent rendering errors
        setChatHistory([]);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setChatHistory([]);
    }
  };

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/documents`);
      if (response.data && Array.isArray(response.data.documents)) {
        setDocumentsData(response.data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Load document content
  const loadDocument = async (docId: string) => {
    try {
      setActiveDocumentId(docId);
      const response = await axios.get(`${API_URL}/documents/${docId}`);
      if (response.data) {
        setActiveDocument(response.data);
      }
    } catch (error) {
      console.error('Error loading document:', error);
    }
  };

  // Start document processing
  const startDocumentProcessing = async () => {
    if (!selectedFile) {
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Preparing to analyze your document...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setActiveDocumentId(response.data.document_id);
      
      // Set processing message
      setProcessingMessage('Document uploaded. Starting analysis...');

      // Create a new chat
      const chatResponse = await axios.post(`${API_URL}/chat-history`, {
        document_id: response.data.document_id,
        title: selectedFile.name
      });

      setActiveChat(chatResponse.data.chat_history_id);
      setChatTitle(selectedFile.name);

      // Set task ID for polling
      if (response.data.task_id) {
        setTaskId(response.data.task_id);
        setProcessingMessage('Analyzing document. This may take a minute...');
        setDocumentUploaded(true);
        
        // Start polling
        const interval = setInterval(async () => {
          try {
            const taskResponse = await axios.get(`${API_URL}/tasks/${response.data.task_id}`);
            
            if (taskResponse.data.state === 'SUCCESS') {
              clearInterval(interval);
              setPollingInterval(null);
              setProcessingResult(taskResponse.data.result);
              setProcessingMessage('Analysis complete! You can now chat with your document.');
              
              // Add the initial system message
              let initialMessages: MessageContent[] = [];
              if (taskResponse.data.result && taskResponse.data.result.message) {
                initialMessages = [{
                  role: 'system',
                  content: taskResponse.data.result.message
                }];
                
                // Save the initial message to the backend
                await axios.post(`${API_URL}/chat-history/${chatResponse.data.chat_history_id}/messages`, {
                  messages: initialMessages
                });
              }
              
              setMessages(initialMessages);
              setErrorCount(0);
              
              // Refresh history
              fetchChatHistory();
            } else if (taskResponse.data.state === 'FAILURE') {
              clearInterval(interval);
              setPollingInterval(null);
              setProcessingMessage('Analysis failed. Please try again.');
              setErrorCount(0);
            } else {
              setProcessingMessage(`Analyzing document... ${taskResponse.data.progress || ''}`);
            }
          } catch (error) {
            setErrorCount(prev => prev + 1);
            if (errorCount > 5) {
              clearInterval(interval);
              setPollingInterval(null);
              setProcessingMessage('Error checking analysis status. Please try again.');
            }
          }
        }, 3000);
        
        setPollingInterval(interval);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setProcessingMessage('Error uploading document. Please try again.');
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Send message in chat
  const sendMessage = async () => {
    if (!userInput.trim() || !activeChat) return;
    
    const newMessage: MessageContent = {
      role: 'user',
      content: userInput
    };
    
    setMessages(prev => [...prev, newMessage]);
    setUserInput('');
    setIsProcessing(true);
    
    try {
      const response = await axios.post(`${API_URL}/chat-history/${activeChat}/messages`, {
        messages: [newMessage]
      });
      
      if (response.data && response.data.messages) {
        const assistantMessages = response.data.messages.filter(
          (msg: MessageContent) => msg.role === 'assistant'
        );
        
        if (assistantMessages.length > 0) {
          setMessages(prev => [...prev, ...assistantMessages]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message. Please try again.'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Create new chat
  const createNewChat = async () => {
    try {
      const title = 'Untitled Chat';
      
      // Clear UI state for new chat
      setDocumentUploaded(false);
      setActiveDocument(null);
      setActiveDocumentId('');
      setSelectedFile(null);
      setMessages([]);
      
      // If no document is uploaded yet, just reset the UI
      if (!documentUploaded) {
        setActiveChat(null);
        setChatTitle(title);
        return;
      }
      
      // Create new chat in backend
      const response = await axios.post(`${API_URL}/chat-history`, {
        title
      });
      
      if (response.data && response.data.chat_history_id) {
        setActiveChat(response.data.chat_history_id);
        setChatTitle(title);
        
        // Refresh chat history
        const updatedHistory = await getChatHistory();
        setChatHistory(updatedHistory as DashboardChatItem[]);
        
      } else {
        console.error('Error creating new chat:', response.data);
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  // Update chat title
  const updateChatTitle = async () => {
    if (!activeChat) return;
    
    try {
      await axios.put(`${API_URL}/chat-history/${activeChat}`, {
        title: chatTitle
      });
      
      // Refresh chat history
      const updatedHistory = await getChatHistory();
      setChatHistory(updatedHistory as DashboardChatItem[]);
    } catch (error) {
      console.error('Error updating chat:', error);
    }
  };

  // Load chat messages
  const loadChat = async (chatId: string) => {
    try {
      // Find the chat in history
      const chat = chatHistory.find(c => c.chat_history_id === chatId);
      if (!chat) {
        console.error(`Chat with ID ${chatId} not found in history`);
        return;
      }

      // Update state with chat details
      setActiveChat(chatId);
      setActiveDocumentId(chat.document_id || '');
      setChatTitle(chat.title || 'Untitled Chat');
      
      // Set documentUploaded to true to show the chat interface
      setDocumentUploaded(true);
      
      // Load chat messages
      const chatMessages = await getChatMessages(chatId);
      setMessages(chatMessages);
      
      // If chat has a document, load it
      if (chat.document_id) {
        loadDocument(chat.document_id);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  // Delete chat
  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm('Are you sure you want to delete this chat?')) {
      return;
    }
    
    try {
      await deleteChat(chatId);
      
      // Remove from local state
      setChatHistory(prev => prev.filter(chat => chat.chat_history_id !== chatId));
      
      // If the active chat was deleted, create a new empty chat
      if (activeChat === chatId) {
        setActiveChat(null);
        setChatTitle('Untitled Chat');
        setMessages([]);
        setDocumentUploaded(false);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // Export chat as PDF
  const exportChatAsPdf = async () => {
    if (messages.length === 0) return;
    
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-export-container';
    
    // Add title
    const titleElement = document.createElement('h1');
    titleElement.textContent = chatTitle;
    chatContainer.appendChild(titleElement);
    
    // Add date
    const dateElement = document.createElement('p');
    dateElement.textContent = `Generated on ${new Date().toLocaleString()}`;
    chatContainer.appendChild(dateElement);
    
    // Add messages
    messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.role}`;
      
      const roleLabel = document.createElement('strong');
      roleLabel.textContent = message.role === 'user' ? 'You: ' : 'AI Assistant: ';
      messageElement.appendChild(roleLabel);
      
      const contentElement = document.createElement('p');
      contentElement.textContent = message.content;
      messageElement.appendChild(contentElement);
      
      chatContainer.appendChild(messageElement);
    });
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = `
      .chat-export-container {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .message {
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 5px;
      }
      .user {
        background-color: #f0f0f0;
      }
      .assistant {
        background-color: #e6f7ff;
      }
    `;
    chatContainer.appendChild(style);
    
    // Convert to PDF
    html2pdf()
      .set({
        margin: [15, 15],
        filename: `${chatTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(chatContainer)
      .save();
  };

  return (
    <div className="min-h-screen flex relative bg-[#1a1633] overflow-x-hidden">
      {/* Left sidebar - fixed UI and improved collapsed view */}
      <div 
        className={`h-screen fixed top-0 left-0 transition-all duration-300 border-r border-white/10 
          bg-[#1a1633]/95 backdrop-blur-sm flex flex-col z-20
          ${leftSidebarExpanded || leftSidebarPinned ? 'w-64' : 'w-16'} relative`}
        onMouseEnter={() => !leftSidebarPinned && setLeftSidebarExpanded(true)}
        onMouseLeave={() => !leftSidebarPinned && setLeftSidebarExpanded(false)}
      >
        {/* Logo area */}
        <div className="pt-6 px-3 flex justify-center mb-8">
          {(leftSidebarExpanded || leftSidebarPinned) ? (
            <h1 className="text-white font-medium">AlignIQ</h1>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b6b] to-[#d64242] flex items-center justify-center">
              <span className="text-white font-semibold text-sm">A</span>
            </div>
          )}
        </div>
        
        {/* Add spacer div after the pin button */}
        <div className="h-6"></div>
        
        {/* Hover pin button - positioned just below the header */}
        {leftSidebarExpanded && !leftSidebarPinned && (
          <button 
            onClick={() => setLeftSidebarPinned(true)}
            className="absolute top-20 -right-3 transform bg-[#1a1633] border border-white/20 rounded-full p-1 shadow-md hover:bg-[#302b63] transition-all"
            title="Pin sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Unpin button - positioned just below the header */}
        {leftSidebarPinned && (
          <button 
            onClick={() => setLeftSidebarPinned(false)}
            className="absolute top-20 -right-3 transform bg-[#1a1633] border border-white/20 rounded-full p-1 shadow-md hover:bg-[#302b63] transition-all"
            title="Unpin sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        
        {/* New chat button with fixed alignment */}
        <div className="p-3 mt-4">
          <button
            onClick={() => {
              // Reset states for a new chat
              setActiveChat(null);
              setMessages([]);
              setChatTitle('Untitled Chat');
              setDocumentUploaded(false);
              setSelectedFile(null);
              setActiveDocument(null);
              setActiveDocumentId('');
              setProcessingResult(null);
            }}
            className={`w-full rounded-md flex items-center p-2.5 text-white
              ${leftSidebarExpanded || leftSidebarPinned ? 'justify-start px-4' : 'justify-center'}
              bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
              hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
              hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
              transform transition-all duration-300
              hover:-translate-y-0.5 active:translate-y-0`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {(leftSidebarExpanded || leftSidebarPinned) && <span className="ml-3 font-medium">Start new chat</span>}
          </button>
        </div>
        
        {/* RECENT header with improved collapsed view */}
        <div className="mt-6">
          <div className={`px-3 mb-2 ${leftSidebarExpanded || leftSidebarPinned ? '' : 'text-center'}`}>
            <h3 className="text-xs font-medium text-white/70 uppercase tracking-wider">
              {(leftSidebarExpanded || leftSidebarPinned) ? 'Recent' : 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            </h3>
          </div>
        </div>
        
        {/* Recent chats */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1.5">
          {chatHistory.map(chat => (
            <button
              key={chat.chat_history_id}
              onClick={() => loadChat(chat.chat_history_id)}
              className={`w-full rounded-md flex items-center p-2.5 text-white
                ${leftSidebarExpanded || leftSidebarPinned ? 'justify-start' : 'justify-center'}
                ${activeChat === chat.chat_history_id 
                  ? 'bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/50' 
                  : 'bg-white/5 border border-white/10'}
                hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/30
                hover:shadow-[0_0_10px_rgba(255,105,105,0.2)]
                transform transition-all duration-200
                hover:-translate-y-0.5 active:translate-y-0`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {(leftSidebarExpanded || leftSidebarPinned) && (
                  <div className="ml-3 truncate text-left">
                    <span className="block truncate text-sm">{chat.title}</span>
                    <span className="block truncate text-xs text-gray-400">{new Date(chat.modified_at).toLocaleDateString()}</span>
                  </div>
                )}
              </button>
          ))}
        </div>
        
        {/* User info at bottom */}
        <div className="mt-auto p-3 border-t border-white/10">
          <div className={`flex items-center ${leftSidebarExpanded || leftSidebarPinned ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-[#9370DB]/30 flex items-center justify-center text-white font-medium">
              A
            </div>
            {(leftSidebarExpanded || leftSidebarPinned) && (
              <div className="ml-2 flex-1">
                <div className="text-sm font-medium text-white">AlignIQ</div>
                <button 
                  onClick={handleLogout}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content area with adjusted margins */}
      <div className={`flex-1 flex flex-col h-screen bg-[#1a1633] transition-all duration-300 
        ${leftSidebarExpanded || leftSidebarPinned ? 'ml-64' : 'ml-16'} 
        ${rightSidebarExpanded || rightSidebarPinned ? 'mr-64' : 'mr-16'}`}>
        {/* Chat title bar */}
        <div className="border-b border-white/10 p-4 flex justify-center">
          <h1 className="text-lg font-medium text-white">{chatTitle || 'New Chat'}</h1>
        </div>
        
        {/* Rest of the main content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeDocument ? (
            <DocumentRenderer document={activeDocument} />
          ) : !documentUploaded && !activeChat ? (
            /* Document upload UI */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center p-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 w-full">
                <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full p-4 mb-4 w-20 h-20 mx-auto flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-medium mb-4 text-white">Upload a Document</h2>
                <p className="text-gray-300 mb-6">
                  Upload your requirements document to get started. Our AI will analyze it and provide insights.
                </p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                />
                
                <div className="space-y-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600
                      hover:from-purple-500 hover:to-indigo-500
                      border border-purple-500/30 rounded-lg 
                      hover:shadow-lg hover:shadow-purple-500/20
                      hover:translate-y-[-2px] active:translate-y-0 transform transition-all duration-200
                      text-white font-medium"
                  >
                    Select Document
                  </button>
                  
                  {selectedFile && (
                    <div className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-white truncate max-w-xs">{selectedFile.name}</span>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  
                  <button
                    onClick={startDocumentProcessing}
                    disabled={!selectedFile || isProcessing}
                    className={`w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600
                      border border-purple-500/30 rounded-lg text-white font-medium
                      ${(!selectedFile || isProcessing) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:from-purple-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-purple-500/20 hover:translate-y-[-2px] active:translate-y-0 transform transition-all duration-200'}`}
                  >
                    {isProcessing ? 'Processing...' : 'Upload & Analyze'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full p-4 mb-4 w-16 h-16 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium mb-2 text-white">Start a Conversation</h3>
                  <p className="text-gray-300 max-w-md">
                    Ask questions about your document or get assistance with requirements analysis.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600/30 border border-blue-500/30 text-white'
                          : message.role === 'system'
                          ? 'bg-purple-600/20 border border-purple-500/30 text-white'
                          : 'bg-white/10 border border-white/20 text-white'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1 text-gray-200">
                        {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'AI Assistant'}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Chat input area */}
        {(activeChat || (!documentUploaded && messages.length > 0)) && (
          <div className="border-t border-white/10 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end space-x-2">
                <div className="flex-1 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] border border-white/20 rounded-lg 
                  focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/20
                  focus-within:shadow-lg focus-within:shadow-white/10 transition-all duration-200">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Message AlignIQ..."
                    className="w-full bg-transparent border-none text-white py-3 px-4 min-h-[50px] max-h-[150px] focus:outline-none focus:ring-0 resize-none"
                    disabled={isProcessing}
                  />
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!userInput.trim() || isProcessing}
                  className={`p-3 rounded-lg bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] border border-white/20 text-white
                  ${(!userInput.trim() || isProcessing) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gradient-to-br hover:from-[#252048] hover:via-[#3a3780] hover:to-[#24243e] hover:border-white/30 hover:shadow-lg hover:shadow-white/10 hover:translate-y-[-2px] active:translate-y-0 transform transition-all duration-200'}`}
                >
                  {isProcessing ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12 4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>
              
              {isProcessing && processingMessage && (
                <div className="mt-2 text-sm text-center text-gray-400">
                  {processingMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Right sidebar - with hover pin arrow near top */}
      <div 
        className={`h-screen fixed top-0 right-0 transition-all duration-300 border-l border-white/10 
          bg-[#1a1633]/95 backdrop-blur-sm flex flex-col z-20 overflow-hidden
          ${rightSidebarExpanded || rightSidebarPinned ? 'w-64' : 'w-16'} relative`}
        onMouseEnter={() => !rightSidebarPinned && setRightSidebarExpanded(true)}
        onMouseLeave={() => !rightSidebarPinned && setRightSidebarExpanded(false)}
      >
        {/* Header area without pin button */}
        <div className="pt-6 px-3 flex justify-center mb-4">
          {(rightSidebarExpanded || rightSidebarPinned) && (
            <h3 className="font-medium text-white">INTEGRATIONS</h3>
          )}
        </div>
        
        {/* Hover pin button - positioned just below the header */}
        {rightSidebarExpanded && !rightSidebarPinned && (
          <button 
            onClick={() => setRightSidebarPinned(true)}
            className="absolute top-20 -left-3 transform bg-[#1a1633] border border-white/20 rounded-full p-1 shadow-md hover:bg-[#302b63] transition-all"
            title="Pin sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Unpin button - positioned just below the header */}
        {rightSidebarPinned && (
          <button 
            onClick={() => setRightSidebarPinned(false)}
            className="absolute top-20 -left-3 transform bg-[#1a1633] border border-white/20 rounded-full p-1 shadow-md hover:bg-[#302b63] transition-all"
            title="Unpin sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        
        {/* Integration buttons with fixed alignment */}
        <div className="px-3 space-y-2">
          <button
            className={`w-full rounded-md flex items-center p-2.5 text-white
              ${rightSidebarExpanded || rightSidebarPinned ? 'justify-start px-4' : 'justify-center'}
              bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
              hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
              hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
              transform transition-all duration-300
              hover:-translate-y-0.5 active:translate-y-0`}
            title="Jira Integration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005z"/>
              <path d="M5.231 11.513h11.57a5.215 5.215 0 0 0-5.215-5.215H9.451V4.243A5.218 5.218 0 0 0 4.236 0v11.513a.995.995 0 0 0 .995.995z" fill-opacity=".4"/>
            </svg>
            {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">Jira</span>}
          </button>

          {/* GitHub Integration button with fixed icon */}
          <button
            className={`w-full rounded-md flex items-center p-2.5 text-white
              ${rightSidebarExpanded || rightSidebarPinned ? 'justify-start px-4' : 'justify-center'}
              bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
              hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
              hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
              transform transition-all duration-300
              hover:-translate-y-0.5 active:translate-y-0`}
            title="GitHub Integration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-white" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.236 1.236 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" fill="currentColor"/>
            </svg>
            {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">GitHub</span>}
          </button>

          {/* Microsoft Integration button with fixed icon */}
          <button
            className={`w-full rounded-md flex items-center p-2.5 text-white
              ${rightSidebarExpanded || rightSidebarPinned ? 'justify-start px-4' : 'justify-center'}
              bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
              hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
              hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
              transform transition-all duration-300
              hover:-translate-y-0.5 active:translate-y-0`}
            title="Microsoft Integration"
          >
            <div className="h-5 w-5 flex-shrink-0 relative">
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
                <div className="bg-[#f25022]"></div>
                <div className="bg-[#7fba00]"></div>
                <div className="bg-[#00a4ef]"></div>
                <div className="bg-[#ffb900]"></div>
              </div>
            </div>
            {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">Microsoft</span>}
          </button>
        </div>
        
        {/* Right sidebar bottom buttons with vertical layout in collapsed state */}
        <div className="p-3 border-t border-white/10">
          <div className={`flex ${rightSidebarExpanded || rightSidebarPinned ? 'flex-col' : 'flex-col'} space-y-2`}>
            {/* Dark Theme button */}
            <button
              className={`rounded-md flex items-center ${rightSidebarExpanded || rightSidebarPinned ? 'w-full justify-start px-4' : 'justify-center'} p-2 text-white
                bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
                hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
                hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
                transform transition-all duration-200
                hover:-translate-y-0.5 active:translate-y-0
                ${!rightSidebarExpanded && !rightSidebarPinned ? 'h-10 w-10' : ''}`}
              title="Toggle Theme"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">Dark Theme</span>}
            </button>
            
            {/* Help & Support button */}
            <button
              className={`rounded-md flex items-center ${rightSidebarExpanded || rightSidebarPinned ? 'w-full justify-start px-4' : 'justify-center'} p-2 text-white
                bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
                hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
                hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
                transform transition-all duration-200
                hover:-translate-y-0.5 active:translate-y-0
                ${!rightSidebarExpanded && !rightSidebarPinned ? 'h-10 w-10' : ''}`}
              title="Help & Support"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">Help & Support</span>}
            </button>
            
            {/* Settings button */}
            <button
              className={`rounded-md flex items-center ${rightSidebarExpanded || rightSidebarPinned ? 'w-full justify-start px-4' : 'justify-center'} p-2 text-white
                bg-gradient-to-br from-[#ff6b6b] to-[#d64242] border border-red-500/30
                hover:from-[#ff8080] hover:to-[#e25858] hover:border-red-500/50
                hover:shadow-[0_0_15px_rgba(255,105,105,0.3)]
                transform transition-all duration-200
                hover:-translate-y-0.5 active:translate-y-0
                ${!rightSidebarExpanded && !rightSidebarPinned ? 'h-10 w-10' : ''}`}
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {(rightSidebarExpanded || rightSidebarPinned) && <span className="ml-3">Settings</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;