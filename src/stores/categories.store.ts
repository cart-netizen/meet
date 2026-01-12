/**
 * Categories Store
 * Manages activity categories state with caching
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { fetchCategories } from '@/services/supabase/categories.service';
import type { ActivityCategory } from '@/types';

// Fallback data in case database is unavailable
import { ACTIVITY_CATEGORIES } from '@/constants/categories';

// ============================================================================
// Types
// ============================================================================

interface CategoriesState {
  // State
  categories: ActivityCategory[];
  categoriesFlat: ActivityCategory[];
  categoriesById: Map<string, ActivityCategory>;
  categoriesBySlug: Map<string, ActivityCategory>;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  initialize: () => Promise<void>;
  refresh: (force?: boolean) => Promise<void>;
  getCategoryById: (id: string) => ActivityCategory | undefined;
  getCategoryBySlug: (slug: string) => ActivityCategory | undefined;
  getParentCategory: (categoryId: string) => ActivityCategory | undefined;
  getSubcategories: (parentId: string) => ActivityCategory[];
  isTopLevelCategory: (categoryId: string) => boolean;
  clearError: () => void;
}

// Cache TTL for categories (24 hours - categories rarely change)
const CATEGORIES_CACHE_TTL = 24 * 60 * 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten hierarchical categories into a single array
 */
function flattenCategories(categories: ActivityCategory[]): ActivityCategory[] {
  const flat: ActivityCategory[] = [];

  for (const category of categories) {
    // Create a copy without subcategories for the flat list
    const { subcategories, ...parent } = category;
    flat.push({ ...parent, parentId: category.parentId });
    if (subcategories && subcategories.length > 0) {
      flat.push(...subcategories);
    }
  }

  return flat;
}

/**
 * Build lookup maps for O(1) access
 */
function buildLookupMaps(flatCategories: ActivityCategory[]): {
  byId: Map<string, ActivityCategory>;
  bySlug: Map<string, ActivityCategory>;
} {
  const byId = new Map<string, ActivityCategory>();
  const bySlug = new Map<string, ActivityCategory>();

  for (const category of flatCategories) {
    byId.set(category.id, category);
    bySlug.set(category.slug, category);
  }

  return { byId, bySlug };
}

/**
 * Initialize with fallback data
 */
function initializeWithFallback(): {
  categories: ActivityCategory[];
  flat: ActivityCategory[];
  byId: Map<string, ActivityCategory>;
  bySlug: Map<string, ActivityCategory>;
} {
  const categories = ACTIVITY_CATEGORIES;
  const flat = flattenCategories(categories);
  const { byId, bySlug } = buildLookupMaps(flat);
  return { categories, flat, byId, bySlug };
}

// ============================================================================
// Store
// ============================================================================

export const useCategoriesStore = create<CategoriesState>()(
  immer((set, get) => ({
    // Initial state
    categories: [],
    categoriesFlat: [],
    categoriesById: new Map(),
    categoriesBySlug: new Map(),
    isLoading: false,
    isInitialized: false,
    error: null,
    lastFetched: null,

    // Initialize categories (called once at app startup)
    initialize: async () => {
      if (get().isInitialized) {
        return;
      }

      set((state) => {
        state.isLoading = true;
      });

      try {
        const { categories, error } = await fetchCategories();

        if (error || categories.length === 0) {
          // Use fallback data if fetch fails
          console.warn('Failed to fetch categories, using fallback:', error?.message);
          const fallback = initializeWithFallback();

          set((state) => {
            state.categories = fallback.categories;
            state.categoriesFlat = fallback.flat;
            state.categoriesById = fallback.byId;
            state.categoriesBySlug = fallback.bySlug;
            state.error = error?.message ?? 'No categories found';
            state.isLoading = false;
            state.isInitialized = true;
          });
          return;
        }

        const flat = flattenCategories(categories);
        const { byId, bySlug } = buildLookupMaps(flat);

        set((state) => {
          state.categories = categories;
          state.categoriesFlat = flat;
          state.categoriesById = byId;
          state.categoriesBySlug = bySlug;
          state.isLoading = false;
          state.isInitialized = true;
          state.error = null;
          state.lastFetched = Date.now();
        });
      } catch (error) {
        // Use fallback data on error
        console.warn('Exception fetching categories, using fallback:', error);
        const fallback = initializeWithFallback();

        set((state) => {
          state.categories = fallback.categories;
          state.categoriesFlat = fallback.flat;
          state.categoriesById = fallback.byId;
          state.categoriesBySlug = fallback.bySlug;
          state.error = error instanceof Error ? error.message : 'Failed to load categories';
          state.isLoading = false;
          state.isInitialized = true;
        });
      }
    },

    // Refresh categories (with optional cache bypass)
    refresh: async (force = false) => {
      const { lastFetched, isLoading } = get();

      if (isLoading) {
        return;
      }

      // Check cache validity
      if (!force && lastFetched && Date.now() - lastFetched < CATEGORIES_CACHE_TTL) {
        return;
      }

      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const { categories, error } = await fetchCategories();

        if (error) {
          set((state) => {
            state.error = error.message;
            state.isLoading = false;
          });
          return;
        }

        const flat = flattenCategories(categories);
        const { byId, bySlug } = buildLookupMaps(flat);

        set((state) => {
          state.categories = categories;
          state.categoriesFlat = flat;
          state.categoriesById = byId;
          state.categoriesBySlug = bySlug;
          state.isLoading = false;
          state.lastFetched = Date.now();
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to refresh categories';
          state.isLoading = false;
        });
      }
    },

    // Get category by ID (O(1) lookup)
    getCategoryById: (id: string) => {
      return get().categoriesById.get(id);
    },

    // Get category by slug (O(1) lookup)
    getCategoryBySlug: (slug: string) => {
      return get().categoriesBySlug.get(slug);
    },

    // Get parent category for a subcategory
    getParentCategory: (categoryId: string) => {
      const category = get().categoriesById.get(categoryId);
      if (!category?.parentId) {
        return undefined;
      }
      return get().categoriesById.get(category.parentId);
    },

    // Get subcategories for a parent
    getSubcategories: (parentId: string) => {
      return get().categoriesFlat.filter((cat) => cat.parentId === parentId);
    },

    // Check if category is top-level
    isTopLevelCategory: (categoryId: string) => {
      const category = get().categoriesById.get(categoryId);
      return category?.parentId === null;
    },

    // Clear error
    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCategories = (state: CategoriesState) => state.categories;
export const selectCategoriesFlat = (state: CategoriesState) => state.categoriesFlat;
export const selectCategoriesLoading = (state: CategoriesState) => state.isLoading;
export const selectCategoriesInitialized = (state: CategoriesState) => state.isInitialized;
export const selectCategoriesError = (state: CategoriesState) => state.error;
