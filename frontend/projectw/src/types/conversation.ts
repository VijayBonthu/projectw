export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
  document_id: string;
}

export interface ConversationMetadata {
  chat_history_id: string;
  title: string;
  modified_at: string;
  document_id?: string;
}

export interface GroupedConversations {
  today: ConversationMetadata[];
  yesterday: ConversationMetadata[];
  lastWeek: ConversationMetadata[];
  older: ConversationMetadata[];
} 