/**
 * Event Creation Wizard
 * Multi-step form for creating new events
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
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
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { format, addHours } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

import { Button, EmailVerificationBanner, ImageViewer, Input } from '@/components/ui';
import { LocationPicker } from '@/components/map';
import { THEME_COLORS } from '@/constants';
import {
  selectCategoriesFlat,
  selectCategoriesError,
  selectEffectiveCity,
  selectProfile,
  useAuthStore,
  useCategoriesStore,
  useLocationStore,
} from '@/stores';
import { createEvent, uploadEventPhoto, updateEventPhotos } from '@/services/supabase/events.service';
import { resendVerificationEmail } from '@/services/supabase/auth.service';
import type { EventCreateInput, GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'category' | 'details' | 'datetime' | 'location' | 'settings';

// Helper to check if a string is a valid UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

interface FormData {
  categoryId: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  address: string;
  placeName: string;
  location: GeoPoint | null;
  maxParticipants: number;
  price: number;
  allowChat: boolean;
  requiresApproval: boolean;
}

interface LocalPhoto {
  uri: string;
  type: string;
  name: string;
}

const MAX_EVENT_PHOTOS = 5;

// ============================================================================
// Component
// ============================================================================

export default function CreateEventScreen() {
  const profile = useAuthStore(selectProfile);
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const userLocation = useLocationStore((state) => state.location);
  const effectiveCity = useLocationStore(selectEffectiveCity);
  const categoriesFlat = useCategoriesStore(selectCategoriesFlat);
  const categoriesError = useCategoriesStore(selectCategoriesError);
  const refreshCategories = useCategoriesStore((state) => state.refresh);

  const [currentStep, setCurrentStep] = useState<WizardStep>('category');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'startsAt' | 'endsAt' | null>(null);
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [formData, setFormData] = useState<FormData>({
    categoryId: '',
    title: '',
    description: '',
    startsAt: addHours(new Date(), 1),
    endsAt: addHours(new Date(), 3),
    address: '',
    placeName: '',
    location: null,
    maxParticipants: 10,
    price: 0,
    allowChat: true,
    requiresApproval: false,
  });

  // Check email verification (session exists only when email is verified)
  const isEmailVerified = session !== null;

  // Check subscription
  const canCreateEvent = profile?.subscriptionType === 'organizer';

  // Handle resend verification email
  const handleResendEmail = async () => {
    if (user?.email) {
      const { error } = await resendVerificationEmail(user.email);
      if (error) {
        Alert.alert('Ошибка', error.message);
      } else {
        Alert.alert('Готово', 'Письмо отправлено повторно');
      }
    }
  };

  // Update form field
  const updateField = useCallback(<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Navigate steps
  const goNext = useCallback(() => {
    const steps: WizardStep[] = ['category', 'details', 'datetime', 'location', 'settings'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    const steps: WizardStep[] = ['category', 'details', 'datetime', 'location', 'settings'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      router.back();
    }
  }, [currentStep]);

  // Validate current step
  const validateStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'category':
        if (!formData.categoryId) {
          Alert.alert('Ошибка', 'Выберите категорию');
          return false;
        }
        // Check if category ID is a valid UUID (not fallback data)
        if (!isValidUUID(formData.categoryId)) {
          Alert.alert(
            'Ошибка загрузки категорий',
            'Категории не загружены с сервера. Попробуйте обновить.',
            [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Обновить', onPress: () => refreshCategories(true) },
            ]
          );
          return false;
        }
        break;
      case 'details':
        if (!formData.title.trim()) {
          Alert.alert('Ошибка', 'Введите название встречи');
          return false;
        }
        if (formData.title.length < 5) {
          Alert.alert('Ошибка', 'Название должно быть не менее 5 символов');
          return false;
        }
        if (!formData.description.trim()) {
          Alert.alert('Ошибка', 'Введите описание встречи');
          return false;
        }
        break;
      case 'datetime':
        if (formData.startsAt < new Date()) {
          Alert.alert('Ошибка', 'Дата начала не может быть в прошлом');
          return false;
        }
        if (formData.endsAt <= formData.startsAt) {
          Alert.alert('Ошибка', 'Время окончания должно быть после начала');
          return false;
        }
        break;
      case 'location':
        if (!formData.address.trim()) {
          Alert.alert('Ошибка', 'Укажите адрес проведения');
          return false;
        }
        if (!formData.location) {
          Alert.alert('Ошибка', 'Выберите адрес из списка подсказок');
          return false;
        }
        break;
      case 'settings':
        // No validation needed - unlimited participants
        break;
    }
    return true;
  }, [currentStep, formData, refreshCategories]);

  // Handle next button
  const handleNext = useCallback(() => {
    if (validateStep()) {
      goNext();
    }
  }, [validateStep, goNext]);

  // Pick event photo
  const handlePickPhoto = useCallback(async () => {
    if (localPhotos.length >= MAX_EVENT_PHOTOS) {
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
        setLocalPhotos(prev => [
          ...prev,
          {
            uri: asset.uri,
            type: asset.mimeType ?? 'image/jpeg',
            name: `photo.${asset.uri.split('.').pop() ?? 'jpg'}`,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
  }, [localPhotos.length]);

  // Remove local photo
  const handleRemovePhoto = useCallback((index: number) => {
    setLocalPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Open image viewer
  const handleOpenViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  // Submit form
  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;
    if (!formData.location) return;

    setIsSubmitting(true);
    try {
      // Calculate duration in minutes from start and end times
      const durationMinutes = Math.round(
        (formData.endsAt.getTime() - formData.startsAt.getTime()) / (1000 * 60)
      );

      const eventData: EventCreateInput = {
        categoryId: formData.categoryId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        startsAt: formData.startsAt,
        durationMinutes,
        address: formData.address.trim(),
        location: formData.location,
        city: effectiveCity?.name ?? profile?.city ?? 'Москва',
        maxParticipants: 99999, // Unlimited
        allowChat: formData.allowChat,
        requiresApproval: formData.requiresApproval,
        ...(formData.placeName.trim() && { placeName: formData.placeName.trim() }),
        ...(formData.price > 0 && { entryFee: formData.price }),
      };

      const result = await createEvent(eventData);

      if (result.error || !result.event) {
        Alert.alert('Ошибка', result.error?.message ?? 'Не удалось создать встречу');
        return;
      }

      // Upload photos if any
      if (localPhotos.length > 0) {
        const uploadedUrls: string[] = [];
        for (const photo of localPhotos) {
          const uploadResult = await uploadEventPhoto(result.event.id, photo);
          if (uploadResult.url) {
            uploadedUrls.push(uploadResult.url);
          }
        }
        if (uploadedUrls.length > 0) {
          await updateEventPhotos(result.event.id, uploadedUrls);
        }
      }

      Alert.alert('Готово!', 'Встреча успешно создана', [
        {
          text: 'Посмотреть',
          onPress: () => router.replace(`/event/${result.event!.id}`),
        },
      ]);
    } catch (error) {
      console.error('Failed to create event:', error);
      Alert.alert('Ошибка', 'Не удалось создать встречу. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateStep, profile, localPhotos]);

  // Render email verification required
  if (!isEmailVerified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Создать встречу</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmailVerificationBanner
          message="Для создания встреч необходимо подтвердить email"
          onResend={handleResendEmail}
        />
      </SafeAreaView>
    );
  }

  // Render subscription wall
  if (!canCreateEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Создать встречу</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.subscriptionWall}>
          <Text style={styles.subscriptionIcon}>⭐</Text>
          <Text style={styles.subscriptionTitle}>
            Подписка Организатор
          </Text>
          <Text style={styles.subscriptionText}>
            Для создания встреч необходима подписка Организатор.
            Получите возможность создавать неограниченное количество встреч!
          </Text>
          <Button
            onPress={() => router.push('/subscription')}
            style={styles.subscriptionButton}
          >
            Оформить подписку
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'category':
        return (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>Выберите категорию</Text>
            <Text style={styles.stepSubtitle}>
              Какой тип встречи вы хотите организовать?
            </Text>
            {categoriesError && (
              <Pressable
                style={styles.categoriesErrorBanner}
                onPress={() => refreshCategories(true)}
              >
                <Text style={styles.categoriesErrorText}>
                  Ошибка загрузки категорий. Нажмите чтобы обновить.
                </Text>
              </Pressable>
            )}
            <View style={styles.categoriesGrid}>
              {categoriesFlat.map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    formData.categoryId === category.id && styles.categoryCardSelected,
                    { borderColor: category.color },
                  ]}
                  onPress={() => updateField('categoryId', category.id)}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        );

      case 'details':
        return (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>Основная информация</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Название встречи</Text>
              <Input
                value={formData.title}
                onChangeText={(text) => updateField('title', text)}
                placeholder="Например: Утренняя пробежка в парке"
                maxLength={100}
              />
              <Text style={styles.hint}>Минимум 5 символов</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Описание</Text>
              <TextInput
                style={styles.textarea}
                value={formData.description}
                onChangeText={(text) => updateField('description', text)}
                placeholder="Расскажите подробнее о встрече, что ожидать участникам..."
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>{formData.description.length}/2000</Text>
            </View>
          </ScrollView>
        );

      case 'datetime':
        // Handler for Android imperative picker
        const showAndroidPicker = (field: 'startsAt' | 'endsAt') => {
          const currentValue = formData[field];
          const minimumDate = field === 'startsAt' ? new Date() : formData.startsAt;

          // First show date picker
          DateTimePickerAndroid.open({
            value: currentValue,
            mode: 'date',
            minimumDate,
            onChange: (event, selectedDate) => {
              if (event.type === 'dismissed' || !selectedDate) return;

              // Then show time picker
              DateTimePickerAndroid.open({
                value: selectedDate,
                mode: 'time',
                is24Hour: true,
                onChange: (timeEvent, selectedTime) => {
                  if (timeEvent.type === 'dismissed' || !selectedTime) return;

                  updateField(field, selectedTime);
                  // Auto-adjust end time if start time changed
                  if (field === 'startsAt' && selectedTime >= formData.endsAt) {
                    updateField('endsAt', addHours(selectedTime, 2));
                  }
                },
              });
            },
          });
        };

        // Handler for iOS declarative picker
        const handleIOSChange = (event: unknown, date?: Date) => {
          if (date && showDatePicker) {
            updateField(showDatePicker, date);
            // Auto-adjust end time if start time changed
            if (showDatePicker === 'startsAt' && date >= formData.endsAt) {
              updateField('endsAt', addHours(date, 2));
            }
          }
        };

        return (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>Дата и время</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Начало</Text>
              <Pressable
                style={styles.datetimeButton}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    showAndroidPicker('startsAt');
                  } else {
                    setShowDatePicker('startsAt');
                  }
                }}
              >
                <Text style={styles.datetimeText}>
                  {format(formData.startsAt, "d MMMM yyyy, HH:mm", { locale: ru })}
                </Text>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Окончание</Text>
              <Pressable
                style={styles.datetimeButton}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    showAndroidPicker('endsAt');
                  } else {
                    setShowDatePicker('endsAt');
                  }
                }}
              >
                <Text style={styles.datetimeText}>
                  {format(formData.endsAt, "d MMMM yyyy, HH:mm", { locale: ru })}
                </Text>
              </Pressable>
            </View>

            {/* iOS only - inline picker */}
            {Platform.OS === 'ios' && showDatePicker && (
              <>
                <DateTimePicker
                  value={formData[showDatePicker]}
                  mode="datetime"
                  display="spinner"
                  minimumDate={showDatePicker === 'startsAt' ? new Date() : formData.startsAt}
                  onChange={handleIOSChange}
                />
                <Pressable
                  style={styles.iosPickerDone}
                  onPress={() => setShowDatePicker(null)}
                >
                  <Text style={styles.iosPickerDoneText}>Готово</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        );

      case 'location':
        return (
          <ScrollView
            contentContainerStyle={styles.stepContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.stepTitle}>Место проведения</Text>
            <Text style={styles.stepSubtitle}>
              Введите адрес или выберите место на карте
            </Text>

            <LocationPicker
              address={formData.address}
              location={formData.location}
              placeName={formData.placeName}
              onAddressChange={(address) => updateField('address', address)}
              onLocationChange={(location) => updateField('location', location)}
              onPlaceNameChange={(placeName) => updateField('placeName', placeName)}
              userLocation={userLocation}
              mapHeight={250}
            />
          </ScrollView>
        );

      case 'settings':
        return (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>Настройки</Text>

            {/* Photos Section */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Фото встречи ({localPhotos.length}/{MAX_EVENT_PHOTOS})
              </Text>
              <Text style={styles.labelHint}>
                Добавьте фото места встречи или прошлых мероприятий
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosContainer}
              >
                {localPhotos.map((photo, index) => (
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
                {localPhotos.length < MAX_EVENT_PHOTOS && (
                  <Pressable
                    style={styles.addPhotoButton}
                    onPress={handlePickPhoto}
                  >
                    <Text style={styles.addPhotoIcon}>+</Text>
                    <Text style={styles.addPhotoText}>Добавить</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Стоимость участия (₽)</Text>
              <Input
                value={formData.price > 0 ? formData.price.toString() : ''}
                onChangeText={(text) =>
                  updateField('price', parseInt(text, 10) || 0)
                }
                placeholder="0 = бесплатно"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.toggleGroup}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleTitle}>Чат для участников</Text>
                <Text style={styles.toggleSubtitle}>
                  Участники смогут общаться в чате встречи
                </Text>
              </View>
              <Pressable
                style={[
                  styles.toggle,
                  formData.allowChat && styles.toggleActive,
                ]}
                onPress={() => updateField('allowChat', !formData.allowChat)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    formData.allowChat && styles.toggleThumbActive,
                  ]}
                />
              </Pressable>
            </View>

            <View style={styles.toggleGroup}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleTitle}>Подтверждение участия</Text>
                <Text style={styles.toggleSubtitle}>
                  Вы будете одобрять каждую заявку вручную
                </Text>
              </View>
              <Pressable
                style={[
                  styles.toggle,
                  formData.requiresApproval && styles.toggleActive,
                ]}
                onPress={() =>
                  updateField('requiresApproval', !formData.requiresApproval)
                }
              >
                <View
                  style={[
                    styles.toggleThumb,
                    formData.requiresApproval && styles.toggleThumbActive,
                  ]}
                />
              </Pressable>
            </View>
          </ScrollView>
        );
    }
  };

  const steps: WizardStep[] = ['category', 'details', 'datetime', 'location', 'settings'];
  const currentStepIndex = steps.indexOf(currentStep);
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Создать встречу</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.progressStep,
              index <= currentStepIndex && styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      {renderStepContent()}

      {/* Footer */}
      <View style={styles.footer}>
        {isLastStep ? (
          <Button
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.footerButton}
          >
            Создать встречу
          </Button>
        ) : (
          <Button onPress={handleNext} style={styles.footerButton}>
            Далее
          </Button>
        )}
      </View>

      {/* Image Viewer Modal */}
      <ImageViewer
        images={localPhotos.map(p => p.uri)}
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
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  progress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME_COLORS.divider,
  },
  progressStepActive: {
    backgroundColor: THEME_COLORS.primary,
  },
  stepContent: {
    padding: 20,
    paddingBottom: 100,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    marginBottom: 24,
  },
  categoriesErrorBanner: {
    backgroundColor: `${THEME_COLORS.warning}20`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME_COLORS.warning,
  },
  categoriesErrorText: {
    fontSize: 14,
    color: THEME_COLORS.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
  },
  categoryCardSelected: {
    backgroundColor: `${THEME_COLORS.primary}10`,
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 4,
  },
  textarea: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME_COLORS.text,
    minHeight: 120,
  },
  datetimeButton: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  datetimeText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  iosPickerDone: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  iosPickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
  suggestions: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginBottom: 2,
  },
  suggestionSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  locationConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${THEME_COLORS.success}15`,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  locationConfirmIcon: {
    fontSize: 18,
    color: THEME_COLORS.success,
  },
  locationConfirmText: {
    fontSize: 14,
    color: THEME_COLORS.success,
    fontWeight: '500',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    fontSize: 24,
    color: THEME_COLORS.text,
    fontWeight: '300',
  },
  counterValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    minWidth: 60,
    textAlign: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME_COLORS.text,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME_COLORS.border,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  toggleActive: {
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'flex-end',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    // Thumb moves to right when active via parent alignItems
  },
  labelHint: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    marginTop: 4,
    marginBottom: 8,
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  footerButton: {
    width: '100%',
  },
  subscriptionWall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  subscriptionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  subscriptionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  subscriptionButton: {
    width: '100%',
  },
});
