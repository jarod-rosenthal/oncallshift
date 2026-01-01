import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Loader2,
  Cloud,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiAssistantAPI, cloudCredentialsAPI } from '../lib/api-client';
import { PromptPreviewModal } from './PromptPreviewModal';
import type { CloudProvider, AIAssistantPromptResponse } from '../types/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    name: string;
    status: 'pending' | 'success' | 'error';
    summary?: string;
  }>;
  timestamp: Date;
}

interface AIAssistantPanelProps {
  incidentId: string;
  incidentSummary: string;
}

export function AIAssistantPanel({ incidentId, incidentSummary }: AIAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // State for fetched data
  const [promptData, setPromptData] = useState<AIAssistantPromptResponse | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [availableCredentials, setAvailableCredentials] = useState<Array<{
    id: string;
    name: string;
    provider: CloudProvider;
  }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch cloud credentials on mount
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const data = await cloudCredentialsAPI.list();
        const creds = data.credentials
          ?.filter(c => c.enabled)
          ?.map(c => ({
            id: c.id,
            name: c.name,
            provider: c.provider as CloudProvider,
          })) || [];
        setAvailableCredentials(creds);
      } catch {
        // Credentials are optional, don't show error
      }
    };
    fetchCredentials();
  }, []);

  // Fetch prompt when modal opens
  useEffect(() => {
    if (showPromptModal && !promptData) {
      const fetchPrompt = async () => {
        setIsLoadingPrompt(true);
        try {
          const data = await aiAssistantAPI.getPrompt(incidentId);
          setPromptData(data);
        } catch {
          // Use a default prompt if fetch fails
          setPromptData({
            prompt: `Please analyze this incident and help me understand the root cause.`,
            incident: {
              id: incidentId,
              number: 0,
              summary: incidentSummary,
              severity: 'unknown',
              state: 'unknown',
              service: null,
            },
            available_credentials: availableCredentials,
          });
        } finally {
          setIsLoadingPrompt(false);
        }
      };
      fetchPrompt();
    }
  }, [showPromptModal, incidentId, incidentSummary, promptData, availableCredentials]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartChat = () => {
    setShowPromptModal(true);
  };

  const handleSendInitialMessage = (message: string, credentialIds: string[]) => {
    setShowPromptModal(false);
    setSelectedCredentials(credentialIds);
    setIsOpen(true);
    sendMessage(message, credentialIds);
  };

  const sendMessage = async (content: string, credentialIds?: string[]) => {
    if (!content.trim() || isStreaming) return;

    setError(null);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`;
    let assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      await aiAssistantAPI.streamChat(
        incidentId,
        {
          message: content.trim(),
          conversation_id: conversationId || undefined,
          credential_ids: credentialIds || selectedCredentials,
        },
        (event) => {
          switch (event.type) {
            case 'conversation_id':
              setConversationId(event.id);
              break;

            case 'text':
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.content }
                  : m
              ));
              break;

            case 'tool_call':
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls || []),
                        { name: event.tool, status: 'pending' as const }
                      ]
                    }
                  : m
              ));
              break;

            case 'tool_result':
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map(tc =>
                        tc.name === event.tool
                          ? { ...tc, status: event.success ? 'success' as const : 'error' as const, summary: event.summary }
                          : tc
                      )
                    }
                  : m
              ));
              break;

            case 'error':
              setError(event.error);
              break;

            case 'done':
              setConversationId(event.conversation_id);
              break;
          }
        },
        (err) => {
          setError(err.message);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  // Collapsed view - just show button
  if (!isOpen && messages.length === 0) {
    return (
      <>
        <button
          onClick={handleStartChat}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
        >
          <Sparkles className="h-4 w-4" />
          Analyze with Claude
        </button>

        <PromptPreviewModal
          isOpen={showPromptModal}
          onClose={() => setShowPromptModal(false)}
          onSend={handleSendInitialMessage}
          defaultPrompt={promptData?.prompt || ''}
          availableCredentials={promptData?.available_credentials || availableCredentials}
          incidentSummary={incidentSummary}
          isLoading={isLoadingPrompt}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" />
            <span className="font-medium text-gray-900">AI Assistant</span>
            {messages.length > 0 && (
              <span className="text-xs text-gray-500">
                {messages.length} messages
              </span>
            )}
          </div>
          <button className="text-gray-500 hover:text-gray-700">
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Chat panel */}
        {isOpen && (
          <div className="flex flex-col h-[500px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-indigo-600" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {/* Tool call indicators */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {message.toolCalls.map((tc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1"
                          >
                            <Cloud className="h-3 w-3" />
                            <span className="font-medium">{tc.name}</span>
                            {tc.status === 'pending' && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {tc.status === 'success' && (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            )}
                            {tc.status === 'error' && (
                              <XCircle className="h-3 w-3 text-red-500" />
                            )}
                            {tc.summary && (
                              <span className="opacity-75">{tc.summary}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message content */}
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                        {isStreaming && message.id === messages[messages.length - 1]?.id && (
                          <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1" />
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  placeholder="Ask a follow-up question..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
                <button
                  onClick={() => sendMessage(inputMessage)}
                  disabled={isStreaming || !inputMessage.trim()}
                  className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isStreaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              {selectedCredentials.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  <Cloud className="h-3 w-3 inline mr-1" />
                  Cloud access enabled for {selectedCredentials.length} credential(s)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <PromptPreviewModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        onSend={handleSendInitialMessage}
        defaultPrompt={promptData?.prompt || ''}
        availableCredentials={promptData?.available_credentials || availableCredentials}
        incidentSummary={incidentSummary}
        isLoading={isLoadingPrompt}
      />
    </>
  );
}
