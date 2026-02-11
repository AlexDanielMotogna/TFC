/**
 * useUrlState - Hook for syncing state with URL query parameters
 *
 * Features:
 * - Initializes state from URL on mount
 * - Updates URL when state changes (shallow navigation)
 * - Syncs state when URL changes (browser back/forward)
 * - Type-safe with generic constraints
 * - Supports validation of allowed values
 *
 * @example
 * // Tab state with URL persistence
 * const [tab, setTab] = useUrlState({
 *   key: 'tab',
 *   defaultValue: 'live',
 *   validValues: ['live', 'pending', 'finished'],
 *   basePath: '/lobby',
 * });
 *
 * @example
 * // Range filter with URL persistence
 * const [range, setRange] = useUrlState({
 *   key: 'range',
 *   defaultValue: 'weekly',
 *   validValues: ['weekly', 'all_time'],
 *   basePath: '/leaderboard',
 * });
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export interface UseUrlStateOptions<T extends string> {
  /** The query parameter key (e.g., 'tab', 'range') */
  key: string;
  /** Default value when URL param is missing or invalid */
  defaultValue: T;
  /** Array of valid values for type-safety and validation */
  validValues: readonly T[];
  /** Base path for the page (e.g., '/lobby', '/leaderboard') */
  basePath: string;
}

export function useUrlState<T extends string>({
  key,
  defaultValue,
  validValues,
  basePath,
}: UseUrlStateOptions<T>): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read value from URL, returning default if invalid
  const getValueFromUrl = useCallback((): T => {
    const param = searchParams?.get(key);
    if (param && (validValues as readonly string[]).includes(param)) {
      return param as T;
    }
    return defaultValue;
  }, [searchParams, key, validValues, defaultValue]);

  const [value, setValueState] = useState<T>(getValueFromUrl);

  // Update URL when value changes
  const setValue = useCallback((newValue: T) => {
    setValueState(newValue);

    const params = new URLSearchParams(searchParams?.toString() || '');

    // Don't show default value in URL (cleaner URLs)
    if (newValue === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, newValue);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, key, defaultValue, basePath]);

  // Sync state when URL changes (browser back/forward)
  useEffect(() => {
    const valueFromUrl = getValueFromUrl();
    if (valueFromUrl !== value) {
      setValueState(valueFromUrl);
    }
  }, [searchParams, getValueFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValue];
}

/**
 * useMultipleUrlState - Hook for managing multiple URL parameters
 *
 * Useful when you have several parameters to sync at once.
 *
 * @example
 * const { get, set, getAll, setMultiple } = useMultipleUrlState('/lobby');
 * const tab = get('tab', 'live', ['live', 'pending', 'finished']);
 * set('tab', 'pending');
 */
export function useMultipleUrlState(basePath: string) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const get = useCallback(<T extends string>(
    key: string,
    defaultValue: T,
    validValues: readonly T[]
  ): T => {
    const param = searchParams?.get(key);
    if (param && (validValues as readonly string[]).includes(param)) {
      return param as T;
    }
    return defaultValue;
  }, [searchParams]);

  const set = useCallback(<T extends string>(
    key: string,
    value: T,
    defaultValue?: T
  ) => {
    const params = new URLSearchParams(searchParams?.toString() || '');

    if (defaultValue !== undefined && value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, basePath]);

  const getAll = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};
    searchParams?.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }, [searchParams]);

  const setMultiple = useCallback((values: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');

    for (const [key, value] of Object.entries(values)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, basePath]);

  return { get, set, getAll, setMultiple, searchParams };
}

export default useUrlState;
