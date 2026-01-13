/**
 * Edit Profile Screen
 * Allows user to edit their profile information
 */

import { useCallback, useState } from 'react';
import {
  Alert,
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

import { Avatar, Button } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import { updateProfile, uploadAvatar } from '@/services/supabase/profiles.service';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Pick avatar image
  const handlePickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
