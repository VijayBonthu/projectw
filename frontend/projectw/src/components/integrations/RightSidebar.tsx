import React, { useState, useEffect } from 'react';
import IntegrationPanel from './IntegrationPanel';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface RightSidebarProps {
  onJiraConnect: () => void;
  onGitHubConnect: () => void;
  onAzureConnect: () => void;
  jiraToken: string | null;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  onJiraConnect,
  onGitHubConnect,
  onAzureConnect,
  jiraToken
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'jira' | 'github' | 'azure'>('jira');

  // Add a local state to track Jira connection
  const [isJiraConnected, setIsJiraConnected] = useState(!!jiraToken);

  
  const togglePanel = () => {
    setShowPanel(!showPanel);
  };

  const handleJiraDisconnect = () => {
    try {
      // Remove the token from localStorage
      localStorage.removeItem('jira_authorization');
      

      // Update local state immediately
      setIsJiraConnected(false);

      // Notify user
      toast.success('Successfully disconnected from Jira');
      
      // Force refresh of the component by triggering events
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('jiraAuthUpdate'));
    } catch (error) {
      console.error('Error disconnecting from Jira:', error);
      toast.error('Error disconnecting from Jira');
    }
  };

  // Improved effect to detect token changes
  useEffect(() => {
    // Function to check if Jira is connected
    const checkJiraConnection = () => {
      const jiraAuthToken = localStorage.getItem('jira_authorization');
      setIsJiraConnected(!!jiraAuthToken);
      console.log("Jira connection status updated:", !!jiraAuthToken);
    };
    
    // Check initially and when jiraToken prop changes
    checkJiraConnection();
    
    // Add event listeners for changes
    const handleTokenChange = () => {
      checkJiraConnection();
    };
    
    window.addEventListener('storage', handleTokenChange);
    window.addEventListener('jiraAuthUpdate', handleTokenChange);
    
    return () => {
      window.removeEventListener('storage', handleTokenChange);
      window.removeEventListener('jiraAuthUpdate', handleTokenChange);
    };
  }, [jiraToken]);

  return (
    <>
      {/* Only show the button when panel is NOT visible */}
      {!showPanel && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={togglePanel}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500/40 to-purple-500/40 shadow-lg hover:from-blue-500/60 hover:to-purple-500/60 transition-all"
            title="Integrations"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>

            {isJiraConnected && (

              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-green-500 transform translate-x-1 -translate-y-1"></span>
            )}
          </button>
        </div>
      )}
      
      {/* Integration panel with tabs */}
      {showPanel && (
        <IntegrationPanel
          isExpanded={showPanel}
          onToggle={togglePanel}

          jiraToken={isJiraConnected ? localStorage.getItem('jira_authorization') : null}

          onJiraConnect={onJiraConnect}
          onJiraDisconnect={handleJiraDisconnect}
          initialActiveTab={activeTab}
        />
      )}
    </>
  );
};

export default RightSidebar; 