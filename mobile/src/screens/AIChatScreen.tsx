import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Text,
  TextInput,
  Surface,
  ActivityIndicator,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '../services/apiService';
import type { Incident } from '../services/apiService';
import { useToast } from '../components';
import * as hapticService from '../services/hapticService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIChatScreenProps {
  route: {
    params: {
      incident: Incident;
    };
  };
  navigation: any;
}

const SYSTEM_PROMPT = `You are an AI assistant integrated into OnCallShift, an incident management platform. You help on-call engineers quickly diagnose and resolve production incidents.

CONTEXT:
- You're viewing an incident that was triggered by a monitoring alert
- The engineer viewing this is likely the on-call responder who needs to investigate and resolve the issue
- Your analysis will help them understand what might have gone wrong and how to fix it
- Be practical and actionable - they need to resolve this quickly
- If you don't have enough information, say what additional data would be helpful

RESPONSE FORMAT:
- Keep responses concise but thorough
- Use clear sections with headers if needed
- Prioritize the most likely causes first
- Include specific commands or steps when applicable`;

export default function AIChatScreen({ route, navigation }: AIChatScreenProps) {
  const { incident } = route.params;
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset and load conversation when incident changes
  useEffect(() => {
    console.log('[AIChat] Loading conversation for incident:', incident.id);
    // Reset messages first to avoid showing stale data
    setMessages([]);
    setError(null);

    loadApiKey();

    // Load conversation for THIS specific incident
    const loadChat = async () => {
      try {
        const key = `ai-chat-${incident.id}`;
        console.log('[AIChat] Loading from key:', key);
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('[AIChat] Loaded', parsed.length, 'messages');
          setMessages(parsed);
        } else {
          console.log('[AIChat] No saved conversation found');
        }
      } catch (e) {
        console.error('[AIChat] Failed to load conversation:', e);
      }
    };

    loadChat();
  }, [incident.id]);

  const loadApiKey = async () => {
    try {
      // First try to get from server (stored encrypted)
      const status = await apiService.getAnthropicCredentialStatus();
      if (status.hasCredential && status.hint) {
        // We have a server-side key, but we need the actual key for direct API calls
        // Fall back to local storage for direct Anthropic calls
      }
    } catch (e) {
      // Ignore - will try local storage
    }

    // Try local storage
    const localKey = await AsyncStorage.getItem('anthropic-api-key');
    if (localKey) {
      setApiKey(localKey);
    }
  };

  const saveConversation = async (msgs: ChatMessage[]) => {
    try {
      const key = `ai-chat-${incident.id}`;
      console.log('[AIChat] Saving', msgs.length, 'messages to key:', key);
      await AsyncStorage.setItem(key, JSON.stringify(msgs));
    } catch (e) {
      console.error('[AIChat] Failed to save conversation:', e);
    }
  };

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

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    if (!apiKey) {
      setError('Please set your Anthropic API key in Settings to use AI chat');
      return;
    }

    setIsLoading(true);
    setError(null);
    await hapticService.lightTap();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');

    // Build messages array for API
    const apiMessages = newMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content[0].text,
        timestamp: Date.now(),
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages);
      await hapticService.success();
    } catch (err: any) {
      console.error('AI chat error:', err);
      setError(err.message || 'Failed to send message');
      // Remove the failed user message
      setMessages(messages);
      await hapticService.error();
    } finally {
      setIsLoading(false);
    }
  };

  const startAnalysis = () => {
    const initialPrompt = generateInitialPrompt();
    sendMessage(initialPrompt);
  };

  const clearChat = async () => {
    setMessages([]);
    await AsyncStorage.removeItem(`ai-chat-${incident.id}`);
    await hapticService.lightTap();
  };

  const handleSaveToNotes = async () => {
    if (messages.length === 0) return;

    try {
      const formattedChat = messages
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

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
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
            onPress={() => navigation.goBack()}
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

        {/* Messages or Empty State */}
        {messages.length === 0 ? (
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
              Get help investigating this incident with Claude AI. Ask follow-up questions to dig deeper.
            </Text>
            {apiKey ? (
              <Pressable
                style={[styles.startButton, { backgroundColor: theme.colors.primary }]}
                onPress={startAnalysis}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFFFFF" />
                <Text style={styles.startButtonText}>Start Analysis</Text>
              </Pressable>
            ) : (
              <View style={styles.noKeyContainer}>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.error, textAlign: 'center', marginTop: 16 }}
                >
                  No API key configured. Add your Anthropic API key in Settings to use AI chat.
                </Text>
                <Pressable
                  style={[styles.startButton, { backgroundColor: theme.colors.secondary, marginTop: 12 }]}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <MaterialCommunityIcons name="cog" size={20} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Go to Settings</Text>
                </Pressable>
              </View>
            )}
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
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
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

        {/* Input area - only show when there are messages or API key exists */}
        {(messages.length > 0 || apiKey) && (
          <View style={dynamicStyles.inputContainer}>
            <TextInput
              mode="outlined"
              placeholder="Ask a follow-up question..."
              value={inputText}
              onChangeText={setInputText}
              style={dynamicStyles.input}
              multiline
              maxLength={2000}
              disabled={isLoading || !apiKey}
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
              disabled={isLoading || !inputText.trim() || !apiKey}
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
  noKeyContainer: {
    alignItems: 'center',
  },
});
