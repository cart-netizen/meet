/**
 * Edit Profile Screen
 * Allows user to edit their profile information
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Avatar, Button, ImageViewer } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import {
  deleteProfilePhoto,
  updateProfile,
  uploadAvatar,
  uploadProfilePhoto,
} from '@/services/supabase/profiles.service';

// ============================================================================
// Constants
// ============================================================================

const MAX_PHOTOS = 5;

// ============================================================================
// Component
// ============================================================================

export default function EditProfileScreen() {
  const profile = useAuthStore(selectProfile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null);
  const [photos, setPhotos] = useState<string[]>(profile?.photos ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // All images for viewer (avatar + photos)
  const allImages = [
    ...(avatarUrl ? [avatarUrl] : []),
    ...photos,
  ];

  // Pick avatar image
  const handlePickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        const asset = result.assets[0];

        const { url, error } = await uploadAvatar({
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: `avatar.${asset.uri.split('.').pop() ?? 'jpg'}`,
        });

        if (error) {
          Alert.alert('Ошибка', error.message);
        } else if (url) {
          setAvatarUrl(url);
          await refreshProfile();
        }

        setIsUploadingAvatar(false);
      }
    } catch (error) {
      console.error('Failed to pick avatar:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
      setIsUploadingAvatar(false);
    }
  }, [refreshProfile]);

  // Pick additional photo
  const handlePickPhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Ошибка', `Максимум ${MAX_PHOTOS} фото`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        const asset = result.assets[0];

        const { url, error } = await uploadProfilePhoto({
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: `photo.${asset.uri.split('.').pop() ?? 'jpg'}`,
        });

        if (error) {
          Alert.alert('Ошибка', error.message);
        } else if (url) {
          setPhotos(prev => [...prev, url]);
          await refreshProfile();
        }

        setIsUploadingPhoto(false);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
      setIsUploadingPhoto(false);
    }
  }, [photos.length, refreshProfile]);

  // Delete photo
  const handleDeletePhoto = useCallback(async (photoUrl: string) => {
    Alert.alert(
      'Удалить фото?',
      'Это действие нельзя отменить',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteProfilePhoto(photoUrl);
            if (error) {
              Alert.alert('Ошибка', error.message);
            } else {
              setPhotos(prev => prev.filter(url => url !== photoUrl));
              await refreshProfile();
            }
          },
        },
      ]
    );
  }, [refreshProfile]);

  // Open image viewer
  const handleOpenViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  // Save profile
  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Ошибка', 'Введите имя');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim(),
      });

      if (error) {
        Alert.alert('Ошибка', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Готово', 'Профиль обновлён', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  }, [displayName, bio, city, refreshProfile]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Редактировать профиль</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar */}
          <Pressable
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            onLongPress={() => avatarUrl && handleOpenViewer(0)}
            disabled={isUploadingAvatar}
          >
            <Avatar
              source={avatarUrl ? { uri: avatarUrl } : null}
              name={displayName}
              size="xl"
            />
            <View style={styles.avatarOverlay}>
              <Text style={styles.avatarOverlayText}>
                {isUploadingAvatar ? '...' : '📷'}
              </Text>
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Нажмите, чтобы изменить фото</Text>

          {/* Photos Gallery */}
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>
              Фото ({photos.length}/{MAX_PHOTOS})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContainer}
            >
              {photos.map((photoUrl, index) => (
                <Pressable
                  key={photoUrl}
                  style={styles.photoItem}
                  onPress={() => handleOpenViewer(avatarUrl ? index + 1 : index)}
                  onLongPress={() => handleDeletePhoto(photoUrl)}
                >
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.deleteHint}>
                    <Text style={styles.deleteHintText}>×</Text>
                  </View>
                </Pressable>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  style={styles.addPhotoButton}
                  onPress={handlePickPhoto}
                  disabled={isUploadingPhoto}
                >
                  <Text style={styles.addPhotoIcon}>
                    {isUploadingPhoto ? '...' : '+'}
                  </Text>
                  <Text style={styles.addPhotoText}>Добавить</Text>
                </Pressable>
              )}
            </ScrollView>
            <Text style={styles.photosHint}>
              Удерживайте фото для удаления
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Имя</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ваше имя"
                placeholderTextColor={THEME_COLORS.textMuted}
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>О себе</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Расскажите немного о себе..."
                placeholderTextColor={THEME_COLORS.textMuted}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.charCount}>{bio.length}/500</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Город</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Ваш город"
                placeholderTextColor={THEME_COLORS.textMuted}
                maxLength={100}
              />
            </View>
          </View>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
          >
            Сохранить
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image Viewer Modal */}
      <ImageViewer
        images={allImages}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: THEME_COLORS.text,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlayText: {
    fontSize: 18,
  },
  avatarHint: {
    textAlign: 'center',
    fontSize: 14,
    color: THEME_COLORS.textMuted,
    marginTop: 8,
    marginBottom: 24,
  },
  photosSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  photosContainer: {
    gap: 12,
    paddingRight: 20,
  },
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  deleteHint: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteHintText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoIcon: {
    fontSize: 28,
    color: THEME_COLORS.textMuted,
  },
  addPhotoText: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
  },
  photosHint: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  input: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME_COLORS.text,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    textAlign: 'right',
  },
  saveButton: {
    marginTop: 32,
  },
});
