import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type {
  Incident,
  AIStreamEvent,
  AIModelId,
  CloudCredential,
} from '../services/apiService';
import { useToast } from '../components';
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

interface AIChatScreenProps {
  route: {
    params: {
      incident: Incident;
    };
  };
  navigation: any;
}

const MODEL_OPTIONS: { id: AIModelId; label: string; description: string }[] = [
  { id: 'haiku', label: 'Haiku', description: 'Fastest, basic analysis' },
  { id: 'sonnet', label: 'Sonnet', description: 'Balanced speed & quality' },
  { id: 'opus', label: 'Opus', description: 'Most capable, detailed analysis' },
];

export default function AIChatScreen({ route, navigation }: AIChatScreenProps) {
  const incident = route.params?.incident;
  const theme = useTheme();

  // If no incident provided, show error state
  if (!incident) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <MaterialCommunityIcons name="robot-confused" size={64} color="#718096" />
        <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          No Incident Selected
        </Text>
        <Text style={{ fontSize: 14, color: '#718096', marginTop: 8, textAlign: 'center' }}>
          Open an incident and tap "AI Chat" to start a conversation about that incident.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3182CE', borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

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

  // Current streaming message
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
    console.log('[AIChat] Loading conversation for incident:', incident.id);
    setMessages([]);
    setError(null);
    setConversationId(null);
    setStreamingContent('');
    setActiveToolCalls([]);
  }, [incident.id]);

  const generateInitialPrompt = (): string => {
    const details = incident.details ? JSON.stringify(incident.details, null, 2) : 'No additional details';
    return `Please analyze this incident:

INCIDENT DETAILS:
- Incident #: ${incident.incidentNumber}
- Summary: ${incident.summary}
- Service: ${incident.service.name}
- Severity: ${incident.severity.toUpperCase()}
- State: ${incident.state}
- Triggered: ${new Date(incident.triggeredAt).toLocaleString()}
${incident.acknowledgedAt ? `- Acknowledged: ${new Date(incident.acknowledgedAt).toLocaleString()}` : ''}

ADDITIONAL CONTEXT:
${details}

Provide:
1. Likely root causes based on the information
2. Recommended investigation steps
3. Potential fixes or mitigations`;
  };

  const handleStreamEvent = useCallback((event: AIStreamEvent) => {
    switch (event.type) {
      case 'conversation_id':
        if (event.id) {
          setConversationId(event.id);
        }
        break;

      case 'text':
        if (event.content) {
          setStreamingContent(prev => prev + event.content);
        }
        break;

      case 'tool_call':
        const toolCallMsg: ChatMessage = {
          id: `tool-${Date.now()}-${Math.random()}`,
          role: 'tool_call',
          content: '',
          toolName: event.tool,
          toolStatus: 'pending',
          timestamp: Date.now(),
        };
        setActiveToolCalls(prev => [...prev, toolCallMsg]);
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
        // Finalize the streaming message
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
            console.error('Stream error:', err);
            setError(err.message || 'Failed to get response');
            setIsLoading(false);
            setIsStreaming(false);
            hapticService.error();
          },
          onComplete: () => {
            setIsLoading(false);
            setIsStreaming(false);

            // Add completed tool calls and assistant message
            setMessages(prev => {
              const newMessages = [...prev];

              // Add tool call messages
              setActiveToolCalls(tools => {
                tools.forEach(tool => {
                  newMessages.push({
                    ...tool,
                    id: `tool-final-${Date.now()}-${Math.random()}`,
                  });
                });
                return [];
              });

              return newMessages;
            });

            // Add the final assistant message
            setStreamingContent(content => {
              if (content) {
                setMessages(prev => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content,
                    timestamp: Date.now(),
                  },
                ]);
              }
              return '';
            });

            hapticService.success();
          },
        }
      );

      abortRef.current = { abort };
    } catch (err: any) {
      console.error('AI chat error:', err);
      setError(err.message || 'Failed to send message');
      setIsLoading(false);
      setIsStreaming(false);
      await hapticService.error();
    }
  };

  const startAnalysis = () => {
    const initialPrompt = generateInitialPrompt();
    sendMessage(initialPrompt);
  };

  const clearChat = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setConversationId(null);
    setStreamingContent('');
    setActiveToolCalls([]);
    await hapticService.lightTap();
  };

  const handleSaveToNotes = async () => {
    if (messages.length === 0) return;

    try {
      const formattedChat = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => `**${msg.role === 'user' ? 'You' : 'Claude'}:**\n${msg.content}`)
        .join('\n\n---\n\n');

      await apiService.addIncidentNote(incident.id, `**AI Analysis Conversation:**\n\n${formattedChat}`);
      await hapticService.success();
      showSuccess('Conversation saved to notes');
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to save to notes');
    }
  };

  const toggleCredential = (credId: string) => {
    setSelectedCredentials(prev =>
      prev.includes(credId)
        ? prev.filter(id => id !== credId)
        : [...prev, credId]
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aws':
        return 'aws';
      case 'azure':
        return 'microsoft-azure';
      case 'gcp':
        return 'google-cloud';
      default:
        return 'cloud';
    }
  };

  const renderToolCall = (tool: ChatMessage) => {
    const statusIcon = tool.toolStatus === 'pending'
      ? 'loading'
      : tool.toolStatus === 'success'
        ? 'check-circle'
        : 'alert-circle';
    const statusColor = tool.toolStatus === 'pending'
      ? theme.colors.primary
      : tool.toolStatus === 'success'
        ? '#10B981'
        : theme.colors.error;

    return (
      <View key={tool.id} style={[styles.toolCallContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
        {tool.toolStatus === 'pending' ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <MaterialCommunityIcons name={statusIcon} size={16} color={statusColor} />
        )}
        <Text style={[styles.toolCallText, { color: theme.colors.onSurfaceVariant }]}>
          {tool.toolName}
        </Text>
        {tool.toolSummary && (
          <Text style={[styles.toolCallSummary, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {tool.toolSummary}
          </Text>
        )}
      </View>
    );
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === 'tool_call' || item.role === 'tool_result') {
      return renderToolCall(item);
    }

    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}>
        <Surface
          style={[
            styles.messageBubble,
            isUser
              ? { backgroundColor: theme.colors.primary }
              : { backgroundColor: theme.colors.surfaceVariant },
          ]}
          elevation={1}
        >
          <Text
            style={[
              styles.messageText,
              { color: isUser ? '#FFFFFF' : theme.colors.onSurface },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: isUser ? 'rgba(255,255,255,0.7)' : theme.colors.onSurfaceVariant },
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Surface>
      </View>
    );
  }, [theme]);

  const renderStreamingMessage = () => {
    if (!isStreaming && !streamingContent && activeToolCalls.length === 0) return null;

    return (
      <View style={styles.streamingContainer}>
        {/* Active tool calls */}
        {activeToolCalls.map(tool => renderToolCall(tool))}

        {/* Streaming text */}
        {streamingContent && (
          <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
            <Surface
              style={[styles.messageBubble, { backgroundColor: theme.colors.surfaceVariant }]}
              elevation={1}
            >
              <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>
                {streamingContent}
              </Text>
            </Surface>
          </View>
        )}

        {/* Streaming indicator */}
        {isStreaming && !streamingContent && activeToolCalls.length === 0 && (
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
              Connecting to Claude...
            </Text>
          </View>
        )}
      </View>
    );
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 12,
      paddingTop: 4,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    inputContainer: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surfaceVariant,
      maxHeight: 100,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 32,
    },
  };

  const selectedModelInfo = MODEL_OPTIONS.find(m => m.id === selectedModel);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={dynamicStyles.header}>
          <IconButton
            icon="arrow-left"
            onPress={() => {
              if (abortRef.current) abortRef.current.abort();
              navigation.goBack();
            }}
            iconColor={theme.colors.onSurface}
          />
          <View style={styles.headerContent}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              AI Assistant
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
              #{incident.incidentNumber} - {incident.summary}
            </Text>
          </View>
          {messages.length > 0 && (
            <View style={styles.headerActions}>
              <IconButton
                icon="content-save-outline"
                onPress={handleSaveToNotes}
                iconColor={theme.colors.primary}
                size={20}
              />
              <IconButton
                icon="delete-outline"
                onPress={clearChat}
                iconColor={theme.colors.error}
                size={20}
              />
            </View>
          )}
        </View>

        {/* Model & Credentials Selection Bar */}
        <View style={[styles.selectionBar, { backgroundColor: theme.colors.surface }]}>
          {/* Model Selector */}
          <Menu
            visible={modelMenuVisible}
            onDismiss={() => setModelMenuVisible(false)}
            anchor={
              <Chip
                icon="brain"
                onPress={() => setModelMenuVisible(true)}
                style={styles.selectorChip}
                textStyle={{ fontSize: 12 }}
              >
                {selectedModelInfo?.label}
              </Chip>
            }
          >
            {MODEL_OPTIONS.map(option => (
              <Menu.Item
                key={option.id}
                onPress={() => {
                  setSelectedModel(option.id);
                  setModelMenuVisible(false);
                }}
                title={`${option.label} - ${option.description}`}
                leadingIcon={selectedModel === option.id ? 'check' : undefined}
              />
            ))}
          </Menu>

          {/* Cloud Credentials Selector */}
          {availableCredentials.length > 0 && (
            <Menu
              visible={credentialsMenuVisible}
              onDismiss={() => setCredentialsMenuVisible(false)}
              anchor={
                <Chip
                  icon="cloud"
                  onPress={() => setCredentialsMenuVisible(true)}
                  style={styles.selectorChip}
                  textStyle={{ fontSize: 12 }}
                >
                  {selectedCredentials.length > 0
                    ? `${selectedCredentials.length} cloud${selectedCredentials.length > 1 ? 's' : ''}`
                    : 'No cloud'}
                </Chip>
              }
            >
              {availableCredentials.map(cred => (
                <Menu.Item
                  key={cred.id}
                  onPress={() => toggleCredential(cred.id)}
                  title={`${cred.name} (${cred.provider.toUpperCase()})`}
                  leadingIcon={getProviderIcon(cred.provider)}
                  trailingIcon={selectedCredentials.includes(cred.id) ? 'check' : undefined}
                />
              ))}
              {selectedCredentials.length > 0 && (
                <>
                  <Divider />
                  <Menu.Item
                    onPress={() => setSelectedCredentials([])}
                    title="Clear selection"
                    leadingIcon="close"
                  />
                </>
              )}
            </Menu>
          )}
        </View>

        {/* Messages or Empty State */}
        {messages.length === 0 && !isStreaming ? (
          <View style={dynamicStyles.emptyContainer}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={64}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface, marginTop: 16, textAlign: 'center' }}
            >
              AI-Powered Analysis
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}
            >
              Get help investigating this incident with Claude AI.
              {availableCredentials.length > 0 && ' Select cloud credentials to enable live investigation.'}
            </Text>
            <Pressable
              style={[styles.startButton, { backgroundColor: theme.colors.primary }]}
              onPress={startAnalysis}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Start Analysis</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={renderStreamingMessage}
          />
        )}

        {/* Loading indicator */}
        {isLoading && !isStreaming && (
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
              Claude is thinking...
            </Text>
          </View>
        )}

        {/* Error display */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={{ color: theme.colors.error }}>{error}</Text>
          </View>
        )}

        {/* Input area */}
        {(messages.length > 0 || isStreaming) && (
          <View style={dynamicStyles.inputContainer}>
            <TextInput
              mode="outlined"
              placeholder="Ask a follow-up question..."
              value={inputText}
              onChangeText={setInputText}
              style={dynamicStyles.input}
              multiline
              maxLength={2000}
              disabled={isLoading || isStreaming}
              onSubmitEditing={() => sendMessage(inputText)}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
            />
            <IconButton
              icon="send"
              mode="contained"
              containerColor={theme.colors.primary}
              iconColor="#FFFFFF"
              onPress={() => sendMessage(inputText)}
              disabled={isLoading || isStreaming || !inputText.trim()}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    flex: 1,
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  selectionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  selectorChip: {
    height: 32,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  toolCallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  toolCallText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toolCallSummary: {
    flex: 1,
    fontSize: 12,
  },
  streamingContainer: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  errorContainer: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
