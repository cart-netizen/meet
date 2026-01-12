/**
 * Activity categories for MeetUp.local
 *
 * IMPORTANT: This file serves as FALLBACK data only.
 * The primary source of categories is the Supabase database.
 * Use useCategoriesStore for accessing categories in components.
 *
 * These static categories are used when:
 * - Database is unavailable
 * - Network errors occur
 * - During initial app load before DB fetch completes
 */

import type { ActivityCategory } from '@/types';

/**
 * Fallback categories with string IDs
 * Note: Database uses UUIDs, this is only for offline fallback
 */
export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  {
    id: 'board-games',
    name: 'Настольные игры',
    slug: 'board-games',
    icon: '🎲',
    color: '#8B5CF6',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'mafia', name: 'Мафия', slug: 'mafia', icon: '🎭', color: '#8B5CF6', parentId: 'board-games', isActive: true },
      { id: 'monopoly', name: 'Монополия', slug: 'monopoly', icon: '🏠', color: '#8B5CF6', parentId: 'board-games', isActive: true },
      { id: 'carcassonne', name: 'Каркассон', slug: 'carcassonne', icon: '🏰', color: '#8B5CF6', parentId: 'board-games', isActive: true },
      { id: 'codenames', name: 'Кодовые имена', slug: 'codenames', icon: '🕵️', color: '#8B5CF6', parentId: 'board-games', isActive: true },
      { id: 'uno', name: 'UNO', slug: 'uno', icon: '🃏', color: '#8B5CF6', parentId: 'board-games', isActive: true },
      { id: 'alias', name: 'Alias', slug: 'alias', icon: '💬', color: '#8B5CF6', parentId: 'board-games', isActive: true },
    ],
  },
  {
    id: 'sports',
    name: 'Спорт',
    slug: 'sports',
    icon: '⚽',
    color: '#10B981',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'football', name: 'Футбол', slug: 'football', icon: '⚽', color: '#10B981', parentId: 'sports', isActive: true },
      { id: 'volleyball', name: 'Волейбол', slug: 'volleyball', icon: '🏐', color: '#10B981', parentId: 'sports', isActive: true },
      { id: 'basketball', name: 'Баскетбол', slug: 'basketball', icon: '🏀', color: '#10B981', parentId: 'sports', isActive: true },
      { id: 'tennis', name: 'Теннис', slug: 'tennis', icon: '🎾', color: '#10B981', parentId: 'sports', isActive: true },
      { id: 'badminton', name: 'Бадминтон', slug: 'badminton', icon: '🏸', color: '#10B981', parentId: 'sports', isActive: true },
      { id: 'table-tennis', name: 'Настольный теннис', slug: 'table-tennis', icon: '🏓', color: '#10B981', parentId: 'sports', isActive: true },
    ],
  },
  {
    id: 'outdoor',
    name: 'Активный отдых',
    slug: 'outdoor',
    icon: '🚴',
    color: '#F59E0B',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'rollerblading', name: 'Ролики', slug: 'rollerblading', icon: '🛼', color: '#F59E0B', parentId: 'outdoor', isActive: true },
      { id: 'cycling', name: 'Велосипед', slug: 'cycling', icon: '🚴', color: '#F59E0B', parentId: 'outdoor', isActive: true },
      { id: 'hiking', name: 'Походы', slug: 'hiking', icon: '🥾', color: '#F59E0B', parentId: 'outdoor', isActive: true },
      { id: 'running', name: 'Бег', slug: 'running', icon: '🏃', color: '#F59E0B', parentId: 'outdoor', isActive: true },
      { id: 'skateboarding', name: 'Скейтборд', slug: 'skateboarding', icon: '🛹', color: '#F59E0B', parentId: 'outdoor', isActive: true },
    ],
  },
  {
    id: 'intellectual',
    name: 'Интеллектуальные',
    slug: 'intellectual',
    icon: '🧠',
    color: '#3B82F6',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'quiz', name: 'Квизы', slug: 'quiz', icon: '❓', color: '#3B82F6', parentId: 'intellectual', isActive: true },
      { id: 'debates', name: 'Дебаты', slug: 'debates', icon: '🎤', color: '#3B82F6', parentId: 'intellectual', isActive: true },
      { id: 'chess', name: 'Шахматы', slug: 'chess', icon: '♟️', color: '#3B82F6', parentId: 'intellectual', isActive: true },
      { id: 'book-club', name: 'Книжный клуб', slug: 'book-club', icon: '📚', color: '#3B82F6', parentId: 'intellectual', isActive: true },
    ],
  },
  {
    id: 'languages',
    name: 'Языковые практики',
    slug: 'languages',
    icon: '🌍',
    color: '#EC4899',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'english', name: 'Английский', slug: 'english', icon: '🇬🇧', color: '#EC4899', parentId: 'languages', isActive: true },
      { id: 'german', name: 'Немецкий', slug: 'german', icon: '🇩🇪', color: '#EC4899', parentId: 'languages', isActive: true },
      { id: 'spanish', name: 'Испанский', slug: 'spanish', icon: '🇪🇸', color: '#EC4899', parentId: 'languages', isActive: true },
      { id: 'french', name: 'Французский', slug: 'french', icon: '🇫🇷', color: '#EC4899', parentId: 'languages', isActive: true },
      { id: 'chinese', name: 'Китайский', slug: 'chinese', icon: '🇨🇳', color: '#EC4899', parentId: 'languages', isActive: true },
      { id: 'japanese', name: 'Японский', slug: 'japanese', icon: '🇯🇵', color: '#EC4899', parentId: 'languages', isActive: true },
    ],
  },
  {
    id: 'creative',
    name: 'Творчество',
    slug: 'creative',
    icon: '🎨',
    color: '#EF4444',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'drawing', name: 'Рисование', slug: 'drawing', icon: '🖌️', color: '#EF4444', parentId: 'creative', isActive: true },
      { id: 'music', name: 'Музыка', slug: 'music', icon: '🎵', color: '#EF4444', parentId: 'creative', isActive: true },
      { id: 'photography', name: 'Фотография', slug: 'photography', icon: '📷', color: '#EF4444', parentId: 'creative', isActive: true },
      { id: 'crafts', name: 'Рукоделие', slug: 'crafts', icon: '🧶', color: '#EF4444', parentId: 'creative', isActive: true },
      { id: 'writing', name: 'Писательство', slug: 'writing', icon: '✍️', color: '#EF4444', parentId: 'creative', isActive: true },
    ],
  },
  {
    id: 'walks',
    name: 'Прогулки',
    slug: 'walks',
    icon: '🚶',
    color: '#6366F1',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'excursions', name: 'Экскурсии', slug: 'excursions', icon: '🗺️', color: '#6366F1', parentId: 'walks', isActive: true },
      { id: 'photowalks', name: 'Фотопрогулки', slug: 'photowalks', icon: '📸', color: '#6366F1', parentId: 'walks', isActive: true },
      { id: 'city-quests', name: 'Городские квесты', slug: 'city-quests', icon: '🔍', color: '#6366F1', parentId: 'walks', isActive: true },
      { id: 'park-walks', name: 'Прогулки в парках', slug: 'park-walks', icon: '🌳', color: '#6366F1', parentId: 'walks', isActive: true },
    ],
  },
  {
    id: 'social',
    name: 'Социальные',
    slug: 'social',
    icon: '🤝',
    color: '#14B8A6',
    parentId: null,
    isActive: true,
    subcategories: [
      { id: 'networking', name: 'Нетворкинг', slug: 'networking', icon: '💼', color: '#14B8A6', parentId: 'social', isActive: true },
      { id: 'speed-friending', name: 'Speed Friending', slug: 'speed-friending', icon: '⚡', color: '#14B8A6', parentId: 'social', isActive: true },
      { id: 'themed-parties', name: 'Тематические вечеринки', slug: 'themed-parties', icon: '🎉', color: '#14B8A6', parentId: 'social', isActive: true },
    ],
  },
];
