/**
 * User Profile View Screen
 * Shows public profile of another user with avatar, bio, and reviews
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar, Badge, Button } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import { getProfileById, getProfileReviews, getProfileStats } from '@/services/supabase/profiles.service';
import type { Profile, Review } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Component
// ============================================================================

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore(selectProfile);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({
    eventsOrganized: 0,
    eventsAttended: 0,
    rating: 5.0,
    reviewsCount: 0,
    noShowCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const photoScrollRef = useRef<ScrollView>(null);

  const isOwnProfile = currentUser?.id === id;

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      setIsLoading(true);
      try {
        const [profileResult, reviewsResult, statsResult] = await Promise.all([
          getProfileById(id),
          getProfileReviews(id),
          getProfileStats(id),
        ]);

        if (profileResult.profile) {
          setProfile(profileResult.profile);
        }
        if (reviewsResult.reviews) {
          setReviews(reviewsResult.reviews);
        }
        setStats(statsResult);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Handle photo scroll
  const handlePhotoScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActivePhotoIndex(index);
  }, []);

  // Start chat with user
  const handleStartChat = useCallback(() => {
    router.push(`/chat/dm/${id}`);
  }, [id]);

  // Render review item
  const renderReview = useCallback(
    ({ item }: { item: Review }) => (
      <View style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
          <Avatar
            source={item.reviewer?.avatarUrl ? { uri: item.reviewer.avatarUrl } : null}
            name={item.reviewer?.displayName}
            size="sm"
          />
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>{item.reviewer?.displayName}</Text>
            <Text style={styles.reviewDate}>
              {format(item.createdAt, 'd MMMM yyyy', { locale: ru })}
            </Text>
          </View>
          <View style={styles.reviewRating}>
            <Text style={styles.reviewRatingText}>★ {item.rating.toFixed(1)}</Text>
          </View>
        </View>
        {item.comment && (
          <Text style={styles.reviewComment}>{item.comment}</Text>
        )}
        {item.event && (
          <Text style={styles.reviewEvent}>На встрече: {item.event.title}</Text>
        )}
      </View>
    ),
    []
  );

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // For now, we only have one avatar URL. In the future, we can add multiple photos.
  const photos = profile.avatarUrl ? [profile.avatarUrl] : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          {isOwnProfile && (
            <Pressable
              style={styles.editButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.editIcon}>✏️</Text>
            </Pressable>
          )}
        </View>

        {/* Photo Carousel */}
        <View style={styles.photoContainer}>
          {photos.length > 0 ? (
            <>
              <ScrollView
                ref={photoScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handlePhotoScroll}
                scrollEventThrottle={16}
              >
                {photos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {photos.length > 1 && (
                <View style={styles.photoPagination}>
                  {photos.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === activePhotoIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noPhotoContainer}>
              <Avatar
                source={null}
                name={profile.displayName}
                size="xl"
              />
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.isVerified && (
              <Badge variant="primary" size="sm">
                ✓ Проверен
              </Badge>
            )}
          </View>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingStars}>
              {'★'.repeat(Math.round(stats.rating))}
              {'☆'.repeat(5 - Math.round(stats.rating))}
            </Text>
            <Text style={styles.ratingValue}>{stats.rating.toFixed(1)}</Text>
            <Text style={styles.reviewsCount}>
              ({stats.reviewsCount} {getReviewWord(stats.reviewsCount)})
            </Text>
          </View>

          {/* City */}
          {profile.city && (
            <Text style={styles.city}>📍 {profile.city}</Text>
          )}

          {/* Bio */}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.eventsOrganized}</Text>
              <Text style={styles.statLabel}>Организовал</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.eventsAttended}</Text>
              <Text style={styles.statLabel}>Посетил</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.noShowCount}</Text>
              <Text style={styles.statLabel}>Пропустил</Text>
            </View>
          </View>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsSection}>
              <Text style={styles.sectionTitle}>Интересы</Text>
              <View style={styles.interestsTags}>
                {profile.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Chat Button (for organizers to chat with participants) */}
          {!isOwnProfile && (
            <Button
              onPress={handleStartChat}
              style={styles.chatButton}
            >
              Написать сообщение
            </Button>
          )}
        </View>

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>Отзывы</Text>
            {reviews.map((review) => (
              <View key={review.id}>
                {renderReview({ item: review })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getReviewWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return 'отзывов';
  }
  if (mod10 === 1) {
    return 'отзыв';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'отзыва';
  }
  return 'отзывов';
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
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 20,
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: THEME_COLORS.surface,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.surface,
  },
  photoPagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
  },
  profileInfo: {
    padding: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ratingStars: {
    fontSize: 16,
    color: '#FFB800',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  reviewsCount: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  city: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    color: THEME_COLORS.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: THEME_COLORS.divider,
    marginVertical: 4,
  },
  interestsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  interestsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: `${THEME_COLORS.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  chatButton: {
    marginTop: 8,
  },
  reviewsSection: {
    paddingHorizontal: 20,
  },
  reviewItem: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  reviewDate: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    marginTop: 2,
  },
  reviewRating: {
    backgroundColor: '#FFF8E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFB800',
  },
  reviewComment: {
    fontSize: 15,
    color: THEME_COLORS.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  reviewEvent: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    fontStyle: 'italic',
  },
});
