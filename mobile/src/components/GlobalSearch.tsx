import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Keyboard,
  Animated,
} from 'react-native';
import {
  Text,
  Portal,
  Modal,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { severityColors } from '../theme';
import * as apiService from '../services/apiService';
import type { Incident, Service, UserProfile } from '../services/apiService';
import { OwnerAvatar } from './OwnerAvatar';
import * as hapticService from '../services/hapticService';

const RECENT_SEARCHES_KEY = '@oncallshift/recent_searches';
const MAX_RECENT_SEARCHES = 5;

type SearchResult = {
  type: 'incident' | 'service' | 'user';
  id: string;
  title: string;
  subtitle?: string;
  severity?: string;
  state?: string;
  email?: string;
};

interface GlobalSearchProps {
  visible: boolean;
  onDismiss: () => void;
  placeholder?: string;
}

export function GlobalSearch({
  visible,
  onDismiss,
  placeholder = 'Search incidents, services, users...',
}: GlobalSearchProps) {
  const { colors: themeColors } = useAppTheme();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'incidents' | 'services' | 'users'>('all');

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadRecentSearches();
      setTimeout(() => inputRef.current?.focus(), 100);
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      setQuery('');
      setResults([]);
      animatedValue.setValue(0);
    }
  }, [visible]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (_error) {
      // Use empty list on error
    }
  };

  const saveRecentSearch = async (searchQuery: string) => {
    try {
      const updated = [
        searchQuery,
        ...recentSearches.filter(s => s !== searchQuery),
      ].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (_error) {
      // Ignore save errors
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (_error) {
      // Ignore clear errors
    }
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const queryLower = searchQuery.toLowerCase();

    try {
      const searchResults: SearchResult[] = [];

      // Search incidents
      if (selectedCategory === 'all' || selectedCategory === 'incidents') {
        const [triggeredIncidents, ackedIncidents] = await Promise.all([
          apiService.getIncidents('triggered').catch(() => []),
          apiService.getIncidents('acknowledged').catch(() => []),
        ]);

        const allIncidents = [...triggeredIncidents, ...ackedIncidents];
        const matchedIncidents = allIncidents.filter(incident =>
          incident.summary.toLowerCase().includes(queryLower) ||
          incident.incidentNumber?.toString().includes(queryLower) ||
          incident.service.name.toLowerCase().includes(queryLower)
        );

        searchResults.push(...matchedIncidents.slice(0, 5).map(incident => ({
          type: 'incident' as const,
          id: incident.id,
          title: incident.summary,
          subtitle: `#${incident.incidentNumber} | ${incident.service.name}`,
          severity: incident.severity,
          state: incident.state,
        })));
      }

      // Search services
      if (selectedCategory === 'all' || selectedCategory === 'services') {
        const services = await apiService.getServices().catch(() => []);
        const matchedServices = services.filter(service =>
          service.name.toLowerCase().includes(queryLower)
        );

        searchResults.push(...matchedServices.slice(0, 5).map(service => ({
          type: 'service' as const,
          id: service.id,
          title: service.name,
          subtitle: service.description || 'Service',
        })));
      }

      // Search users
      if (selectedCategory === 'all' || selectedCategory === 'users') {
        const users = await apiService.getUsers().catch(() => []);
        const matchedUsers = users.filter(user =>
          user.fullName?.toLowerCase().includes(queryLower) ||
          user.email?.toLowerCase().includes(queryLower)
        );

        searchResults.push(...matchedUsers.slice(0, 5).map(user => ({
          type: 'user' as const,
          id: user.id,
          title: user.fullName || user.email,
          subtitle: user.role || 'Member',
          email: user.email,
        })));
      }

      setResults(searchResults);
    } catch (_error) {
      // Search error handled by empty results
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleResultPress = async (result: SearchResult) => {
    await hapticService.lightTap();
    saveRecentSearch(query);
    onDismiss();

    switch (result.type) {
      case 'incident':
        navigation.navigate('AlertDetail', {
          alert: {
            id: result.id,
            summary: result.title,
            severity: result.severity || 'info',
            state: result.state || 'triggered',
            service: { id: '', name: '' },
            triggeredAt: new Date().toISOString(),
          },
        });
        break;
      case 'service':
        navigation.navigate('ManageServices');
        break;
      case 'user':
        navigation.navigate('Team');
        break;
    }
  };

  const handleRecentSearchPress = (searchQuery: string) => {
    setQuery(searchQuery);
  };

  const renderResultIcon = (type: string, severity?: string) => {
    switch (type) {
      case 'incident':
        return (
          <View style={[styles.resultIcon, { backgroundColor: severityColors[severity as keyof typeof severityColors] + '20' }]}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={severityColors[severity as keyof typeof severityColors] || themeColors.error}
            />
          </View>
        );
      case 'service':
        return (
          <View style={[styles.resultIcon, { backgroundColor: themeColors.primary + '20' }]}>
            <MaterialCommunityIcons name="server" size={20} color={themeColors.primary} />
          </View>
        );
      case 'user':
        return (
          <View style={[styles.resultIcon, { backgroundColor: themeColors.accent + '20' }]}>
            <MaterialCommunityIcons name="account" size={20} color={themeColors.accent} />
          </View>
        );
      default:
        return null;
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
    >
      {renderResultIcon(item.type, item.severity)}
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        )}
      </View>
      {item.state && (
        <Chip
          compact
          style={[styles.stateChip, { backgroundColor: item.state === 'triggered' ? themeColors.errorLight : themeColors.warningLight }]}
          textStyle={{ color: item.state === 'triggered' ? themeColors.error : themeColors.warning, fontSize: 10 }}
        >
          {item.state === 'triggered' ? 'Active' : item.state}
        </Chip>
      )}
      <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
    </Pressable>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: themeColors.surface }]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: animatedValue,
              transform: [
                {
                  translateY: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={22} color={themeColors.textMuted} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: themeColors.textPrimary }]}
              placeholder={placeholder}
              placeholderTextColor={themeColors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <IconButton
                icon="close-circle"
                size={18}
                onPress={() => setQuery('')}
                iconColor={themeColors.textMuted}
              />
            )}
          </View>

          {/* Category Filters */}
          <View style={styles.categoryRow}>
            <Chip
              selected={selectedCategory === 'all'}
              onPress={() => setSelectedCategory('all')}
              style={styles.categoryChip}
              compact
            >
              All
            </Chip>
            <Chip
              selected={selectedCategory === 'incidents'}
              onPress={() => setSelectedCategory('incidents')}
              style={styles.categoryChip}
              compact
              icon="alert-circle-outline"
            >
              Incidents
            </Chip>
            <Chip
              selected={selectedCategory === 'services'}
              onPress={() => setSelectedCategory('services')}
              style={styles.categoryChip}
              compact
              icon="server"
            >
              Services
            </Chip>
            <Chip
              selected={selectedCategory === 'users'}
              onPress={() => setSelectedCategory('users')}
              style={styles.categoryChip}
              compact
              icon="account"
            >
              Users
            </Chip>
          </View>

          <Divider />

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={themeColors.accent} />
            </View>
          )}

          {/* Results */}
          {!loading && query.length > 0 && (
            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="magnify-close" size={48} color={themeColors.textMuted} />
                  <Text style={styles.emptyText}>No results found</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </View>
              }
            />
          )}

          {/* Recent Searches */}
          {!loading && query.length === 0 && recentSearches.length > 0 && (
            <View style={styles.recentContainer}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent Searches</Text>
                <Pressable onPress={clearRecentSearches}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
              {recentSearches.map((search, index) => (
                <Pressable
                  key={index}
                  style={styles.recentItem}
                  onPress={() => handleRecentSearchPress(search)}
                >
                  <MaterialCommunityIcons name="history" size={18} color={themeColors.textMuted} />
                  <Text style={styles.recentText}>{search}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Quick Tips */}
          {!loading && query.length === 0 && recentSearches.length === 0 && (
            <View style={styles.tipsContainer}>
              <MaterialCommunityIcons name="lightbulb-outline" size={32} color={themeColors.textMuted} />
              <Text style={styles.tipsTitle}>Search Tips</Text>
              <Text style={styles.tipsText}>
                Search by incident number, title, service name, or team member
              </Text>
            </View>
          )}
        </Animated.View>
      </Modal>
    </Portal>
  );
}

// Search trigger button component
export function SearchButton({ onPress }: { onPress: () => void }) {
  const { colors: themeColors } = useAppTheme();

  return (
    <Pressable style={[styles.searchButton, { backgroundColor: themeColors.surfaceSecondary }]} onPress={onPress}>
      <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
      <Text style={[styles.searchButtonText, { color: themeColors.textMuted }]}>Search...</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    marginTop: 60,
    borderRadius: 16,
    maxHeight: '80%',
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    height: 32,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  resultsList: {
    maxHeight: 400,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  resultSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  stateChip: {
    height: 24,
    marginRight: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  recentContainer: {
    padding: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  clearText: {
    fontSize: 13,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  recentText: {
    fontSize: 15,
  },
  tipsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  tipsText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  searchButtonText: {
    fontSize: 15,
  },
});

export default GlobalSearch;
