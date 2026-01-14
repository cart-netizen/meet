/**
 * Event Edit Screen
 * Allows organizers to edit event details
 */

import { useCallback, useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Button, ImageViewer } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { getEventById, updateEvent, uploadEventPhoto, updateEventPhotos } from '@/services/supabase/events.service';
import type { Event } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_EVENT_PHOTOS = 5;

// ============================================================================
// Types
// ============================================================================

interface LocalPhoto {
  uri: string;
  type: string;
  name: string;
  isNew: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [placeDetails, setPlaceDetails] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Fetch event data
  useEffect(() => {
    async function loadEvent() {
      if (!id) return;

      setIsLoading(true);
      try {
        const result = await getEventById(id);
        if (result.event) {
          setEvent(result.event);
          setTitle(result.event.title);
          setDescription(result.event.description ?? '');
          setPlaceName(result.event.placeName ?? '');
          setPlaceDetails(result.event.placeDetails ?? '');
          // Load existing photos
          const existingPhotos = (result.event.photos ?? []).map(uri => ({
            uri,
            type: 'image/jpeg',
            name: uri.split('/').pop() ?? 'photo.jpg',
            isNew: false,
          }));
          setPhotos(existingPhotos);
        }
      } catch (error) {
        console.error('Failed to load event:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить встречу');
      } finally {
        setIsLoading(false);
      }
    }

    loadEvent();
  }, [id]);

  // Pick photo
  const handlePickPhoto = useCallback(async () => {
    if (photos.length >= MAX_EVENT_PHOTOS) {
      Alert.alert('Ошибка', `Максимум ${MAX_EVENT_PHOTOS} фото`);
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
        const asset = result.assets[0];
        setPhotos(prev => [
          ...prev,
          {
            uri: asset.uri,
            type: asset.mimeType ?? 'image/jpeg',
            name: `photo.${asset.uri.split('.').pop() ?? 'jpg'}`,
            isNew: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
  }, [photos.length]);

  // Remove photo
  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Open image viewer
  const handleOpenViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!id || !event) return;

    if (!title.trim()) {
      Alert.alert('Ошибка', 'Введите название встречи');
      return;
    }

    setIsSaving(true);
    try {
      // Upload new photos
      const newPhotos = photos.filter(p => p.isNew);
      const existingPhotoUrls = photos.filter(p => !p.isNew).map(p => p.uri);
      const uploadedUrls: string[] = [...existingPhotoUrls];

      for (const photo of newPhotos) {
        const uploadResult = await uploadEventPhoto(id, {
          uri: photo.uri,
          type: photo.type,
          name: photo.name,
        });
        if (uploadResult.url) {
          uploadedUrls.push(uploadResult.url);
        }
      }

      // Update event
      const { error } = await updateEvent(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        placeName: placeName.trim() || undefined,
        placeDetails: placeDetails.trim() || undefined,
        photos: uploadedUrls,
      });

      if (error) {
        Alert.alert('Ошибка', error.message);
        return;
      }

      Alert.alert('Готово', 'Встреча обновлена', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save event:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  }, [id, event, title, description, placeName, placeDetails, photos]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Встреча не найдена</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Редактирование</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Название встречи"
              placeholderTextColor={THEME_COLORS.textMuted}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Описание</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Опишите вашу встречу..."
              placeholderTextColor={THEME_COLORS.textMuted}
              multiline
              numberOfLines={5}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>
          </View>

          {/* Place Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Название места</Text>
            <TextInput
              style={styles.input}
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="Например: Кофейня 'Ромашка'"
              placeholderTextColor={THEME_COLORS.textMuted}
              maxLength={100}
            />
          </View>

          {/* Place Details */}
          <View style={styles.field}>
            <Text style={styles.label}>Как найти</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={placeDetails}
              onChangeText={setPlaceDetails}
              placeholder="Подсказки как найти место встречи..."
              placeholderTextColor={THEME_COLORS.textMuted}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {/* Photos */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Фото ({photos.length}/{MAX_EVENT_PHOTOS})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContainer}
            >
              {photos.map((photo, index) => (
                <Pressable
                  key={index}
                  style={styles.photoItem}
                  onPress={() => handleOpenViewer(index)}
                  onLongPress={() => handleRemovePhoto(index)}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <Pressable
                    style={styles.photoRemoveButton}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </Pressable>
              ))}
              {photos.length < MAX_EVENT_PHOTOS && (
                <Pressable
                  style={styles.addPhotoButton}
                  onPress={handlePickPhoto}
                >
                  <Text style={styles.addPhotoIcon}>+</Text>
                  <Text style={styles.addPhotoText}>Добавить</Text>
                </Pressable>
              )}
            </ScrollView>
            <Text style={styles.hint}>Удерживайте фото для удаления</Text>
          </View>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
          >
            Сохранить изменения
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image Viewer Modal */}
      <ImageViewer
        images={photos.map(p => p.uri)}
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
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
  headerSpacer: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
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
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 8,
  },
  photosContainer: {
    gap: 12,
    paddingVertical: 8,
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
  photoRemoveButton: {
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
  photoRemoveText: {
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
  saveButton: {
    marginTop: 12,
  },
});
