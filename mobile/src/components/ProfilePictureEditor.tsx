import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';

// Dynamically import ImagePicker to handle cases where native module isn't available
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (_e) {
  // expo-image-picker not available in this build
}

// Convert SVG URLs to PNG for React Native compatibility
const convertToPngUrl = (url: string): string => {
  if (url.includes('dicebear.com') && url.includes('/svg')) {
    return url.replace('/svg', '/png') + (url.includes('?') ? '&size=128' : '?size=128');
  }
  return url;
};

interface ProfilePictureEditorProps {
  currentPictureUrl: string | null;
  userName: string | null;
  userEmail: string;
  onUpdate: (newUrl: string | null) => void;
}

export function ProfilePictureEditor({
  currentPictureUrl,
  userName,
  userEmail,
  onUpdate,
}: ProfilePictureEditorProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDefault, setSelectedDefault] = useState<string | null>(null);

  const getInitials = () => {
    if (userName) {
      const parts = userName.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : userName.substring(0, 2).toUpperCase();
    }
    return userEmail.substring(0, 2).toUpperCase();
  };

  const handlePickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Not Available', 'Photo library is not available in this build. Please select a default avatar instead.');
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('Not Available', 'Camera is not available in this build. Please select a default avatar instead.');
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your camera to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      // Determine content type from URI
      const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
      const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';

      // Get presigned URL
      const { uploadUrl, publicUrl } = await apiService.getProfilePictureUploadUrl(contentType);

      // Fetch the image as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to S3
      await apiService.uploadToPresignedUrl(uploadUrl, blob, contentType);

      // Update profile with new URL
      await apiService.updateProfilePicture(publicUrl);

      onUpdate(publicUrl);
      setShowModal(false);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (_error) {
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDefault = async (url: string) => {
    setSelectedDefault(url);
    setUploading(true);
    try {
      await apiService.updateProfilePicture(url);
      onUpdate(url);
      setShowModal(false);
      setSelectedDefault(null);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePicture = async () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              await apiService.removeProfilePicture();
              onUpdate(null);
              setShowModal(false);
            } catch (_error) {
              Alert.alert('Error', 'Failed to remove profile picture');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={() => setShowModal(true)}
      >
        {currentPictureUrl ? (
          <Image source={{ uri: convertToPngUrl(currentPictureUrl) }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials()}</Text>
          </View>
        )}
        <View style={styles.editBadge}>
          <Ionicons name="camera" size={14} color="#fff" />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !uploading && setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => !uploading && setShowModal(false)}
              disabled={uploading}
            >
              <Text style={[styles.cancelText, uploading && styles.disabledText]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Profile Picture</Text>
            <View style={{ width: 60 }} />
          </View>

          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.uploadingText}>Updating...</Text>
            </View>
          )}

          <ScrollView style={styles.modalContent}>
            {/* Current Picture Preview */}
            <View style={styles.previewSection}>
              {currentPictureUrl ? (
                <Image source={{ uri: convertToPngUrl(currentPictureUrl) }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewInitials}>{getInitials()}</Text>
                </View>
              )}
            </View>

            {/* Upload Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload Photo</Text>
              <View style={styles.uploadOptions}>
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={handleTakePhoto}
                  disabled={uploading}
                >
                  <View style={styles.uploadIconContainer}>
                    <Ionicons name="camera" size={24} color="#6366f1" />
                  </View>
                  <Text style={styles.uploadOptionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  <View style={styles.uploadIconContainer}>
                    <Ionicons name="images" size={24} color="#6366f1" />
                  </View>
                  <Text style={styles.uploadOptionText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Default Avatars */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose an Avatar</Text>
              <View style={styles.defaultAvatarsGrid}>
                {apiService.DEFAULT_AVATARS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.defaultAvatarOption,
                      selectedDefault === avatar.url && styles.selectedAvatar,
                    ]}
                    onPress={() => handleSelectDefault(avatar.url)}
                    disabled={uploading}
                  >
                    <Image source={{ uri: avatar.url }} style={styles.defaultAvatarImage} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Remove Option */}
            {currentPictureUrl && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemovePicture}
                disabled={uploading}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={styles.removeButtonText}>Remove Profile Picture</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginVertical: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e5e7eb',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6366f1',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  disabledText: {
    opacity: 0.5,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  modalContent: {
    flex: 1,
  },
  previewSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e5e7eb',
  },
  previewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitials: {
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  defaultAvatarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  defaultAvatarOption: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAvatar: {
    borderColor: '#6366f1',
  },
  defaultAvatarImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  removeButtonText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
});

export default ProfilePictureEditor;
