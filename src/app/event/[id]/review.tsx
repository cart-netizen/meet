/**
 * Event Review Screen
 * Submit a review for an attended event
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { getEventById } from '@/services/supabase/events.service';
import { canReviewEvent, createReview } from '@/services/supabase/reviews.service';
import type { Event, Profile } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function EventReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [reviewReason, setReviewReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Fetch event data
  useEffect(() => {
    async function loadData() {
      if (!id) return;

      setIsLoading(true);
      try {
        const eventData = await getEventById(id);
        if (eventData) {
          setEvent(eventData.event);
          setOrganizer(eventData.organizer);
        }

        const { canReview: canReviewResult, reason } = await canReviewEvent(id);
        setCanReview(canReviewResult);
        setReviewReason(reason ?? null);
      } catch (error) {
        console.error('Failed to load event:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!event || !organizer || rating === 0) return;

    setIsSubmitting(true);
    try {
      await createReview({
        eventId: event.id,
        organizerId: organizer.id,
        rating,
        comment: comment.trim() || undefined,
      });

      Alert.alert('Спасибо!', 'Ваш отзыв успешно отправлен', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to submit review:', error);
      Alert.alert('Ошибка', 'Не удалось отправить отзыв. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }, [event, organizer, rating, comment]);

  // Render star rating
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Pressable
          key={i}
          onPress={() => setRating(i)}
          style={styles.starButton}
        >
          <Text style={[styles.star, i <= rating && styles.starFilled]}>
            {i <= rating ? '★' : '☆'}
          </Text>
        </Pressable>
      );
    }
    return stars;
  };

  // Get rating label
  const getRatingLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Ужасно';
      case 2:
        return 'Плохо';
      case 3:
        return 'Нормально';
      case 4:
        return 'Хорошо';
      case 5:
        return 'Отлично!';
      default:
        return 'Выберите оценку';
    }
  };

  // Get restriction message
  const getRestrictionMessage = (reason: string): string => {
    switch (reason) {
      case 'not_authenticated':
        return 'Войдите в аккаунт, чтобы оставить отзыв';
      case 'not_participant':
        return 'Вы не были участником этой встречи';
      case 'not_attended':
        return 'Отзыв можно оставить только после посещения встречи';
      case 'already_reviewed':
        return 'Вы уже оставили отзыв об этой встрече';
      default:
        return 'Невозможно оставить отзыв';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event || !organizer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.error}>
          <Text style={styles.errorText}>Встреча не найдена</Text>
          <Button onPress={() => router.back()}>Назад</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!canReview && reviewReason) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Оставить отзыв</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.restrictionContainer}>
          <Text style={styles.restrictionIcon}>⚠️</Text>
          <Text style={styles.restrictionTitle}>Невозможно оставить отзыв</Text>
          <Text style={styles.restrictionText}>
            {getRestrictionMessage(reviewReason)}
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Вернуться
          </Button>
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
        <Text style={styles.headerTitle}>Оставить отзыв</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Event Info */}
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.organizerRow}>
            <Avatar
              source={organizer.avatarUrl ? { uri: organizer.avatarUrl } : null}
              name={organizer.displayName}
              size="sm"
            />
            <Text style={styles.organizerName}>{organizer.displayName}</Text>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ваша оценка</Text>
          <View style={styles.starsContainer}>{renderStars()}</View>
          <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Комментарий (необязательно)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Расскажите о своих впечатлениях..."
            placeholderTextColor={THEME_COLORS.textMuted}
            multiline
            numberOfLines={5}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/1000</Text>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>Правила отзывов</Text>
          <Text style={styles.guidelinesText}>
            • Будьте честны и объективны{'\n'}
            • Описывайте только ваш личный опыт{'\n'}
            • Не используйте оскорбления и нецензурную лексику{'\n'}
            • Отзыв будет опубликован от вашего имени
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Button
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={rating === 0}
          style={styles.submitButton}
        >
          Отправить отзыв
        </Button>
      </View>
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
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
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
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  restrictionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  restrictionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  restrictionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  restrictionText: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  eventCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  organizerName: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 44,
    color: THEME_COLORS.border,
  },
  starFilled: {
    color: THEME_COLORS.warning,
  },
  ratingLabel: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
  commentInput: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME_COLORS.text,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  guidelinesCard: {
    backgroundColor: `${THEME_COLORS.info}10`,
    borderRadius: 16,
    padding: 16,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.info,
    marginBottom: 8,
  },
  guidelinesText: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    lineHeight: 20,
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
  submitButton: {
    width: '100%',
  },
});
