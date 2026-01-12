/**
 * Categories Service
 * Fetches activity categories from Supabase database
 */

import type { ActivityCategory } from '@/types';

import { supabase, withRetry } from './client';

// ============================================================================
// Types
// ============================================================================

interface CategoriesResult {
  categories: ActivityCategory[];
  error: Error | null;
}

interface DatabaseCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform flat database rows into hierarchical ActivityCategory structure
 */
function transformToHierarchy(rows: DatabaseCategory[]): ActivityCategory[] {
  // First, create a map of all categories
  const categoriesMap = new Map<string, ActivityCategory>();

  for (const row of rows) {
    categoriesMap.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? '',
      color: row.color ?? '#6366F1',
      parentId: row.parent_id,
      isActive: row.is_active,
      subcategories: [],
    });
  }

  // Build hierarchy - attach subcategories to parents
  const rootCategories: ActivityCategory[] = [];

  for (const category of categoriesMap.values()) {
    if (category.parentId === null) {
      rootCategories.push(category);
    } else {
      const parent = categoriesMap.get(category.parentId);
      if (parent) {
        parent.subcategories = parent.subcategories ?? [];
        parent.subcategories.push(category);
      }
    }
  }

  return rootCategories;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all active categories from database
 * Returns hierarchical structure with parent categories containing subcategories
 */
export async function fetchCategories(): Promise<CategoriesResult> {
  try {
    const { data, error } = await withRetry(() =>
      supabase
        .from('activity_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    );

    if (error) {
      console.error('[Categories] Supabase error:', error.message, error.code);
      return { categories: [], error: new Error(error.message) };
    }

    if (!data || data.length === 0) {
      console.warn('[Categories] No categories returned from database');
      return { categories: [], error: new Error('No categories found in database') };
    }

    // Transform flat database rows into hierarchical structure
    const categories = transformToHierarchy((data as DatabaseCategory[]) ?? []);
    console.log(`[Categories] Loaded ${data.length} categories from database`);

    return { categories, error: null };
  } catch (error) {
    console.error('[Categories] Exception during fetch:', error);
    return {
      categories: [],
      error: error instanceof Error ? error : new Error('Failed to fetch categories'),
    };
  }
}

/**
 * Fetch a single category by ID
 */
export async function fetchCategoryById(
  id: string
): Promise<{ category: ActivityCategory | null; error: Error | null }> {
  try {
    const { data, error } = await withRetry(() =>
      supabase.from('activity_categories').select('*').eq('id', id).single()
    );

    if (error) {
      return { category: null, error: new Error(error.message) };
    }

    const row = data as DatabaseCategory;
    const category: ActivityCategory = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? '',
      color: row.color ?? '#6366F1',
      parentId: row.parent_id,
      isActive: row.is_active,
    };

    return { category, error: null };
  } catch (error) {
    return {
      category: null,
      error: error instanceof Error ? error : new Error('Failed to fetch category'),
    };
  }
}
