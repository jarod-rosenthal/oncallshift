import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import {
  Text,
  TextInput,
  Surface,
  ActivityIndicator,
  IconButton,
  useTheme,
  Menu,
  Chip,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type {
  Incident,
  AIStreamEvent,
  AIModelId,
  CloudCredential,
} from '../services/apiService';
import { useToast } from './ActionToast';
import * as hapticService from '../services/hapticService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  timestamp: number;
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
  toolSummary?: string;
}

interface AIAssistantPanelProps {
  incident: Incident;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  maxHeight?: number;
  onNoteSaved?: () => void;
  hideHeader?: boolean; // Hide the header when embedded in a parent container
}

const MODEL_OPTIONS: { id: AIModelId; label: string }[] = [
  { id: 'haiku', label: 'Haiku' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
];

export default function AIAssistantPanel({
  incident,
  collapsed = false,
  onToggleCollapse,
  maxHeight = 400,
  onNoteSaved,
  hideHeader = false,
}: AIAssistantPanelProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<AIModelId>('sonnet');
  const [modelMenuVisible, setModelMenuVisible] = useState(false);

  // Cloud credentials
  const [availableCredentials, setAvailableCredentials] = useState<CloudCredential[]>([]);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [credentialsMenuVisible, setCredentialsMenuVisible] = useState(false);

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<ChatMessage[]>([]);

  // Load cloud credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const creds = await apiService.getCloudCredentials();
        setAvailableCredentials(creds);
      } catch (e) {
        console.log('Cloud credentials not available:', e);
      }
    };
    loadCredentials();
  }, []);

  // Reset when incident changes
  useEffect(() => {
    setMessages([]);
    setError(null);
    setConversationId(null);
    setStreamingContent('');
    setActiveToolCalls([]);
  }, [incident.id]);

  const generateQuickPrompt = (): string => {
    return `Quickly analyze incident #${incident.incidentNumber}: "${incident.summary}" (${incident.severity} severity, ${incident.service.name} service). What are the likely causes and next steps?`;
  };

  const handleStreamEvent = useCallback((event: AIStreamEvent) => {
    switch (event.type) {
      case 'conversation_id':
        if (event.id) setConversationId(event.id);
        break;
      case 'text':
        if (event.content) setStreamingContent(prev => prev + event.content);
        break;
      case 'tool_call':
        setActiveToolCalls(prev => [...prev, {
          id: `tool-${Date.now()}-${Math.random()}`,
          role: 'tool_call',
          content: '',
          toolName: event.tool,
          toolStatus: 'pending',
          timestamp: Date.now(),
        }]);
        break;
      case 'tool_result':
        setActiveToolCalls(prev =>
          prev.map(tc =>
            tc.toolName === event.tool
              ? { ...tc, toolStatus: event.success ? 'success' : 'error', toolSummary: event.summary }
              : tc
          )
        );
        break;
      case 'done':
        setIsStreaming(false);
        break;
      case 'error':
        setError(event.error || 'An error occurred');
        setIsStreaming(false);
        break;
    }
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isStreaming) return;

    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    setStreamingContent('');
    setActiveToolCalls([]);
    await hapticService.lightTap();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      const { abort } = await apiService.streamAIAssistantChat(
        incident.id,
        content.trim(),
        {
          conversationId: conversationId || undefined,
          credentialIds: selectedCredentials.length > 0 ? selectedCredentials : undefined,
          model: selectedModel,
          onEvent: handleStreamEvent,
          onError: (err) => {
            setError(err.message || 'Failed to get response');
            setIsLoading(false);
            setIsStreaming(false);
            hapticService.error();
          },
          onComplete: () => {
            setIsLoading(false);
            setIsStreaming(false);

            setMessages(prev => {
              const newMessages = [...prev];
              setActiveToolCalls(tools => {
                tools.forEach(tool => {
                  newMessages.push({ ...tool, id: `tool-final-${Date.now()}-${Math.random()}` });
                });
                return [];
              });
              return newMessages;
            });

            setStreamingContent(content => {
              if (content) {
                setMessages(prev => [...prev, {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content,
                  timestamp: Date.now(),
                }]);
              }
              return '';
            });

            hapticService.success();
          },
        }
      );

      abortRef.current = { abort };
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setIsLoading(false);
      setIsStreaming(false);
      await hapticService.error();
    }
  };

  const startQuickAnalysis = () => {
    sendMessage(generateQuickPrompt());
  };

  const handleSaveToNotes = async () => {
    if (messages.length === 0) return;

    try {
      const formattedChat = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => `**${msg.role === 'user' ? 'You' : 'Claude'}:**\n${msg.content}`)
        .join('\n\n---\n\n');

      await apiService.addIncidentNote(incident.id, `**AI Analysis:**\n\n${formattedChat}`);
      await hapticService.success();
      showSuccess('Saved to notes');
      onNoteSaved?.();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to save');
    }
  };

  const toggleCredential = (credId: string) => {
    setSelectedCredentials(prev =>
      prev.includes(credId) ? prev.filter(id => id !== credId) : [...prev, credId]
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aws': return 'aws';
      case 'azure': return 'microsoft-azure';
      case 'gcp': return 'google-cloud';
      default: return 'cloud';
    }
  };

  const renderToolCall = (tool: ChatMessage) => (
    <View key={tool.id} style={[styles.toolCallContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
      {tool.toolStatus === 'pending' ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <MaterialCommunityIcons
          name={tool.toolStatus === 'success' ? 'check-circle' : 'alert-circle'}
          size={14}
          color={tool.toolStatus === 'success' ? '#10B981' : theme.colors.error}
        />
      )}
      <Text style={[styles.toolCallText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {tool.toolName}
      </Text>
    </View>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'tool_call' || item.role === 'tool_result') {
      return renderToolCall(item);
    }

    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.assistantMessage]}>
        <Surface
          style={[
            styles.messageBubble,
            { backgroundColor: isUser ? theme.colors.primary : theme.colors.surfaceVariant },
          ]}
          elevation={0}
        >
          <Text
            style={[styles.messageText, { color: isUser ? '#FFFFFF' : theme.colors.onSurface }]}
            numberOfLines={isUser ? 3 : undefined}
          >
            {item.content}
          </Text>
        </Surface>
      </View>
    );
  };

  if (collapsed) {
    return (
      <Pressable
        onPress={onToggleCollapse}
        style={[styles.collapsedContainer, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <MaterialCommunityIcons name="robot-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.collapsedText, { color: theme.colors.onSurface }]}>
          AI Assistant
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
      </Pressable>
    );
  }

  return (
    <Surface style={[styles.container, hideHeader && styles.containerEmbedded, { backgroundColor: theme.colors.surface }]} elevation={hideHeader ? 0 : 1}>
      {/* Header - hidden when embedded */}
      {!hideHeader && (
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Pressable onPress={onToggleCollapse} style={styles.headerTitle}>
            <MaterialCommunityIcons name="robot-outline" size={20} color={theme.colors.primary} />
            <Text variant="titleSmall" style={{ color: theme.colors.onSurface, marginLeft: 8 }}>
              AI Assistant
            </Text>
            {onToggleCollapse && (
              <MaterialCommunityIcons name="chevron-up" size={20} color={theme.colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
            )}
          </Pressable>
          {messages.length > 0 && (
            <IconButton
              icon="content-save-outline"
              onPress={handleSaveToNotes}
              iconColor={theme.colors.primary}
              size={18}
            />
          )}
        </View>
      )}

      {/* Save button when header is hidden */}
      {hideHeader && messages.length > 0 && (
        <View style={styles.embeddedSaveBar}>
          <IconButton
            icon="content-save-outline"
            onPress={handleSaveToNotes}
            iconColor={theme.colors.primary}
            size={18}
          />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Save to notes
          </Text>
        </View>
      )}

      {/* Selection Bar */}
      <View style={styles.selectionBar}>
        <Menu
          visible={modelMenuVisible}
          onDismiss={() => setModelMenuVisible(false)}
          anchor={
            <Chip
              icon="brain"
              onPress={() => setModelMenuVisible(true)}
              compact
              textStyle={{ fontSize: 11 }}
            >
              {MODEL_OPTIONS.find(m => m.id === selectedModel)?.label}
            </Chip>
          }
        >
          {MODEL_OPTIONS.map(option => (
            <Menu.Item
              key={option.id}
              onPress={() => { setSelectedModel(option.id); setModelMenuVisible(false); }}
              title={option.label}
              leadingIcon={selectedModel === option.id ? 'check' : undefined}
            />
          ))}
        </Menu>

        {availableCredentials.length > 0 && (
          <Menu
            visible={credentialsMenuVisible}
            onDismiss={() => setCredentialsMenuVisible(false)}
            anchor={
              <Chip
                icon="cloud"
                onPress={() => setCredentialsMenuVisible(true)}
                compact
                textStyle={{ fontSize: 11 }}
              >
                {selectedCredentials.length > 0 ? `${selectedCredentials.length}` : '0'}
              </Chip>
            }
          >
            {availableCredentials.map(cred => (
              <Menu.Item
                key={cred.id}
                onPress={() => toggleCredential(cred.id)}
                title={cred.name}
                leadingIcon={getProviderIcon(cred.provider)}
                trailingIcon={selectedCredentials.includes(cred.id) ? 'check' : undefined}
              />
            ))}
          </Menu>
        )}
      </View>

      {/* Messages or Empty State */}
      {messages.length === 0 && !isStreaming ? (
        <View style={styles.emptyState}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>
            Get AI-powered analysis of this incident
          </Text>
          <Pressable
            style={[styles.quickStartButton, { backgroundColor: theme.colors.primary }]}
            onPress={startQuickAnalysis}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFFFFF" />
            <Text style={styles.quickStartText}>Quick Analysis</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ maxHeight }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={() => (
              <>
                {activeToolCalls.map(tool => renderToolCall(tool))}
                {streamingContent && (
                  <View style={[styles.messageContainer, styles.assistantMessage]}>
                    <Surface style={[styles.messageBubble, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                      <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>{streamingContent}</Text>
                    </Surface>
                  </View>
                )}
                {isStreaming && !streamingContent && activeToolCalls.length === 0 && (
                  <View style={styles.streamingIndicator}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                )}
              </>
            )}
          />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
          <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text>
        </View>
      )}

      {/* Input */}
      {messages.length > 0 && (
        <View style={[styles.inputContainer, { borderTopColor: theme.colors.outlineVariant }]}>
          <TextInput
            mode="outlined"
            placeholder="Ask a question..."
            value={inputText}
            onChangeText={setInputText}
            style={styles.input}
            dense
            disabled={isLoading || isStreaming}
            onSubmitEditing={() => sendMessage(inputText)}
          />
          <IconButton
            icon="send"
            mode="contained"
            containerColor={theme.colors.primary}
            iconColor="#FFFFFF"
            size={18}
            onPress={() => sendMessage(inputText)}
            disabled={isLoading || isStreaming || !inputText.trim()}
          />
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  containerEmbedded: {
    marginVertical: 0,
    borderRadius: 0,
  },
  embeddedSaveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginVertical: 8,
  },
  collapsedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  quickStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  quickStartText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  messagesList: {
    padding: 12,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '90%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  toolCallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  toolCallText: {
    fontSize: 11,
    fontWeight: '500',
  },
  streamingIndicator: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  errorContainer: {
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
  },
});
