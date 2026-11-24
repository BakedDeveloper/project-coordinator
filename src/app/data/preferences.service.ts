import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

/** Theme choice, as `user_preferences.theme` stores it. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice);
}

/** Raised when the preferences cannot be read or saved. It carries no database data. */
export class PreferencesUnavailableError extends Error {
  constructor() {
    super('Preferences unavailable');
    this.name = 'PreferencesUnavailableError';
  }
}

/**
 * Reads and writes `user_preferences`, one row for the signed-in user (RLS shows no other).
 * `user_id` and `updated_at` are set by the database: the app writes only the preferences.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly supabase = inject(SUPABASE);

  /** The saved theme, or null when the user has never saved one. */
  async loadTheme(): Promise<ThemeChoice | null> {
    let result;
    try {
      result = await this.supabase.from('user_preferences').select('theme').maybeSingle();
    } catch {
      throw new PreferencesUnavailableError();
    }
    if (result.error) {
      throw new PreferencesUnavailableError();
    }
    if (result.data === null) {
      return null;
    }
    if (!isThemeChoice(result.data.theme)) {
      throw new PreferencesUnavailableError();
    }
    return result.data.theme;
  }

  async saveTheme(theme: ThemeChoice): Promise<void> {
    // user_id defaults to auth.uid(): on the first save the row is inserted, later the
    // conflict on the primary key turns the insert into an update of the theme only.
    let result;
    try {
      result = await this.supabase
        .from('user_preferences')
        .upsert({ theme }, { onConflict: 'user_id' });
    } catch {
      throw new PreferencesUnavailableError();
    }
    if (result.error) {
      throw new PreferencesUnavailableError();
    }
  }
}
