import { useState, useRef } from 'react';
import { usersAPI } from '../lib/api-client';
import { Button } from './ui/button';

// Default avatars using DiceBear API - variety of styles beyond headshots
const DEFAULT_AVATARS = [
  { id: 'shapes-blue', url: 'https://api.dicebear.com/9.x/shapes/svg?seed=blue', label: 'Blue Shapes' },
  { id: 'shapes-purple', url: 'https://api.dicebear.com/9.x/shapes/svg?seed=purple', label: 'Purple Shapes' },
  { id: 'shapes-green', url: 'https://api.dicebear.com/9.x/shapes/svg?seed=green', label: 'Green Shapes' },
  { id: 'shapes-orange', url: 'https://api.dicebear.com/9.x/shapes/svg?seed=orange', label: 'Orange Shapes' },
  { id: 'identicon-1', url: 'https://api.dicebear.com/9.x/identicon/svg?seed=oncall1', label: 'Identicon 1' },
  { id: 'identicon-2', url: 'https://api.dicebear.com/9.x/identicon/svg?seed=oncall2', label: 'Identicon 2' },
  { id: 'bottts-1', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot1', label: 'Robot 1' },
  { id: 'bottts-2', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot2', label: 'Robot 2' },
  { id: 'thumbs-1', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=happy1', label: 'Thumbs 1' },
  { id: 'thumbs-2', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=happy2', label: 'Thumbs 2' },
  { id: 'rings-1', url: 'https://api.dicebear.com/9.x/rings/svg?seed=ring1', label: 'Rings 1' },
  { id: 'rings-2', url: 'https://api.dicebear.com/9.x/rings/svg?seed=ring2', label: 'Rings 2' },
];

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
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = () => {
    if (userName) {
      const parts = userName.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : userName.substring(0, 2).toUpperCase();
    }
    return userEmail.substring(0, 2).toUpperCase();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Get presigned URL
      const { uploadUrl, publicUrl } = await usersAPI.getProfilePictureUploadUrl(file.type);

      // Upload to S3
      await usersAPI.uploadToPresignedUrl(uploadUrl, file, file.type);

      // Update profile with new URL
      await usersAPI.updateProfilePicture(publicUrl);

      onUpdate(publicUrl);
      setIsOpen(false);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload profile picture');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectDefault = async (url: string) => {
    setUploading(true);
    setError(null);

    try {
      await usersAPI.updateProfilePicture(url);
      onUpdate(url);
      setIsOpen(false);
    } catch (err) {
      console.error('Error setting default avatar:', err);
      setError('Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePicture = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await usersAPI.removeProfilePicture();
      onUpdate(null);
      setIsOpen(false);
    } catch (err) {
      console.error('Error removing profile picture:', err);
      setError('Failed to remove profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative group"
        type="button"
      >
        {currentPictureUrl ? (
          <img
            src={currentPictureUrl}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center border-4 border-background shadow-lg">
            <span className="text-2xl font-semibold text-primary-foreground">
              {getInitials()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Profile Picture</h3>
                <button
                  onClick={() => !uploading && setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={uploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              {uploading && (
                <div className="mb-4 flex items-center justify-center gap-2 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-muted-foreground">Updating...</span>
                </div>
              )}

              {/* Current Picture Preview */}
              <div className="flex justify-center mb-6">
                {currentPictureUrl ? (
                  <img
                    src={currentPictureUrl}
                    alt="Current profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-muted"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-4xl font-semibold text-primary-foreground">
                      {getInitials()}
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                  Upload Photo
                </h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Choose from device
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Max file size: 5MB. Supported formats: JPEG, PNG, GIF
                </p>
              </div>

              {/* Default Avatars */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                  Choose an Avatar
                </h4>
                <div className="grid grid-cols-6 gap-2">
                  {DEFAULT_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => handleSelectDefault(avatar.url)}
                      disabled={uploading}
                      className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-primary transition-colors disabled:opacity-50"
                      title={avatar.label}
                    >
                      <img
                        src={avatar.url}
                        alt={avatar.label}
                        className="w-full h-full object-cover bg-muted"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Remove Button */}
              {currentPictureUrl && (
                <Button
                  onClick={handleRemovePicture}
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={uploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                  Remove Profile Picture
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
