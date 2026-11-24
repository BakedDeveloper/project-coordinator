import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

import { PreferencesService, isThemeChoice, type ThemeChoice } from '../data/preferences.service';

/**
 * Where the last theme is cached on this device. The inline script in src/index.html reads
 * the same key to apply the theme before Angular starts (scripts/check-styles.mjs checks it).
 */
export const THEME_STORAGE_KEY = 'coordinator.theme';

/**
 * The theme of the app: the cached choice first (no flash on reload), then the one saved in
 * the database, which wins once loaded. "system" removes `data-theme` and lets
 * `prefers-color-scheme` decide (src/styles.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preferences = inject(PreferencesService);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<ThemeChoice>(this.readCache() ?? 'system');
  private readonly failedSave = signal(false);
  private chosenSinceSync = false;

  readonly choice = this.current.asReadonly();
  /** True when the last choice was applied here but could not be saved. */
  readonly saveFailed = this.failedSave.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  /** Loads the saved theme. A choice made while it loads wins; a failed load keeps the cache. */
  async syncFromDatabase(): Promise<void> {
    this.chosenSinceSync = false;
    let saved: ThemeChoice | null;
    try {
      saved = await this.preferences.loadTheme();
    } catch {
      return;
    }
    if (!this.chosenSinceSync) {
      this.set(saved ?? 'system');
    }
  }

  /** Applies the choice at once, then saves it. */
  async choose(theme: ThemeChoice): Promise<void> {
    this.chosenSinceSync = true;
    this.failedSave.set(false);
    this.set(theme);
    try {
      await this.preferences.saveTheme(theme);
    } catch {
      // Only the latest choice matters: an older save failing later says nothing about it.
      if (this.current() === theme) {
        this.failedSave.set(true);
      }
    }
  }

  private set(theme: ThemeChoice): void {
    this.current.set(theme);
    this.apply(theme);
    this.writeCache(theme);
  }

  private apply(theme: ThemeChoice): void {
    const root = this.document.documentElement;
    if (theme === 'system') {
      delete root.dataset['theme'];
    } else {
      root.dataset['theme'] = theme;
    }
  }

  // Storage can be missing or blocked (private mode, disabled site data): the theme then
  // simply is not remembered on this device.
  private readCache(): ThemeChoice | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return isThemeChoice(value) ? value : null;
    } catch {
      return null;
    }
  }

  private writeCache(theme: ThemeChoice): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Not remembered on this device, see readCache.
    }
  }
}
