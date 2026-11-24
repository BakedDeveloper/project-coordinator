import { TestBed } from '@angular/core/testing';

import { PreferencesService, PreferencesUnavailableError } from '../data/preferences.service';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(preferences: Partial<Record<keyof PreferencesService, unknown>> = {}) {
  const service = {
    loadTheme: vi.fn(async () => null),
    saveTheme: vi.fn(async () => undefined),
    ...preferences,
  };
  TestBed.configureTestingModule({
    providers: [{ provide: PreferencesService, useValue: service }],
  });
  return { theme: TestBed.inject(ThemeService), preferences: service };
}

const root = () => document.documentElement;

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete root().dataset['theme'];
  });

  it('defaults to "system", with no data-theme', () => {
    const { theme } = setup();
    expect(theme.choice()).toBe('system');
    expect(root().dataset['theme']).toBeUndefined();
  });

  it('starts from the cached theme, before the database answers', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { theme, preferences } = setup();
    expect(theme.choice()).toBe('dark');
    expect(root().dataset['theme']).toBe('dark');
    expect(preferences.loadTheme).not.toHaveBeenCalled();
  });

  it('ignores an unknown cached value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    const { theme } = setup();
    expect(theme.choice()).toBe('system');
  });

  it('the saved theme overrides the cache and updates it', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { theme } = setup({ loadTheme: vi.fn(async () => 'light') });
    await theme.syncFromDatabase();
    expect(theme.choice()).toBe('light');
    expect(root().dataset['theme']).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('no saved row means "system"', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { theme } = setup({ loadTheme: vi.fn(async () => null) });
    await theme.syncFromDatabase();
    expect(theme.choice()).toBe('system');
    expect(root().dataset['theme']).toBeUndefined();
  });

  it('keeps the cached theme when the database cannot be read', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { theme } = setup({
      loadTheme: vi.fn(async () => {
        throw new PreferencesUnavailableError();
      }),
    });
    await theme.syncFromDatabase();
    expect(theme.choice()).toBe('dark');
    expect(theme.saveFailed()).toBe(false);
  });

  it('a choice made while the database loads is not overwritten', async () => {
    const load = deferred<'light'>();
    const { theme } = setup({ loadTheme: vi.fn(() => load.promise) });
    const sync = theme.syncFromDatabase();
    await theme.choose('dark');
    load.resolve('light');
    await sync;
    expect(theme.choice()).toBe('dark');
  });

  for (const choice of ['system', 'light', 'dark'] as const) {
    it(`choosing "${choice}" applies, caches and saves it`, async () => {
      localStorage.setItem(THEME_STORAGE_KEY, choice === 'dark' ? 'light' : 'dark');
      const { theme, preferences } = setup();
      await theme.choose(choice);
      expect(theme.choice()).toBe(choice);
      expect(root().dataset['theme']).toBe(choice === 'system' ? undefined : choice);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(choice);
      expect(preferences.saveTheme).toHaveBeenCalledWith(choice);
      expect(theme.saveFailed()).toBe(false);
    });
  }

  it('a failed save still changes the theme here and says so', async () => {
    const { theme } = setup({
      saveTheme: vi.fn(async () => {
        throw new PreferencesUnavailableError();
      }),
    });
    await theme.choose('dark');
    expect(theme.choice()).toBe('dark');
    expect(root().dataset['theme']).toBe('dark');
    expect(theme.saveFailed()).toBe(true);
  });

  it('works when storage is blocked', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { theme } = setup();
    await theme.choose('dark');
    expect(theme.choice()).toBe('dark');
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
