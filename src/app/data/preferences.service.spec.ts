import { TestBed } from '@angular/core/testing';

import { PreferencesService, PreferencesUnavailableError } from './preferences.service';
import { SUPABASE } from './supabase.client';

interface Result {
  data?: unknown;
  error: unknown;
}

function setup(result: Result | Promise<never>) {
  const maybeSingle = vi.fn(() => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const upsert = vi.fn(() => result);
  const from = vi.fn(() => ({ select, upsert }));
  TestBed.configureTestingModule({
    providers: [
      { provide: PreferencesService, useClass: PreferencesService },
      { provide: SUPABASE, useValue: { from } },
    ],
  });
  return { service: TestBed.inject(PreferencesService), from, select, upsert };
}

describe('PreferencesService', () => {
  describe('loadTheme', () => {
    it('reads the theme of user_preferences', async () => {
      const { service, from, select } = setup({ data: { theme: 'dark' }, error: null });
      await expect(service.loadTheme()).resolves.toBe('dark');
      expect(from).toHaveBeenCalledWith('user_preferences');
      expect(select).toHaveBeenCalledWith('theme');
    });

    it('returns null when no row exists', async () => {
      const { service } = setup({ data: null, error: null });
      await expect(service.loadTheme()).resolves.toBeNull();
    });

    it('rejects an unknown theme', async () => {
      const { service } = setup({ data: { theme: 'sepia' }, error: null });
      await expect(service.loadTheme()).rejects.toBeInstanceOf(PreferencesUnavailableError);
    });

    it('fails without database details on an error or a network failure', async () => {
      const failing = setup({ data: null, error: { message: 'secret detail' } });
      const error = await failing.service.loadTheme().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PreferencesUnavailableError);
      expect(String(error)).not.toContain('secret detail');

      TestBed.resetTestingModule();
      const offline = setup(Promise.reject(new Error('offline')));
      await expect(offline.service.loadTheme()).rejects.toBeInstanceOf(PreferencesUnavailableError);
    });
  });

  describe('saveTheme', () => {
    it('upserts only the theme: user_id and updated_at come from the database', async () => {
      const { service, from, upsert } = setup({ error: null });
      await service.saveTheme('light');
      expect(from).toHaveBeenCalledWith('user_preferences');
      expect(upsert).toHaveBeenCalledWith({ theme: 'light' }, { onConflict: 'user_id' });
    });

    it('fails on an error or a network failure', async () => {
      const failing = setup({ error: { message: 'denied' } });
      await expect(failing.service.saveTheme('dark')).rejects.toBeInstanceOf(
        PreferencesUnavailableError,
      );

      TestBed.resetTestingModule();
      const offline = setup(Promise.reject(new Error('offline')));
      await expect(offline.service.saveTheme('dark')).rejects.toBeInstanceOf(
        PreferencesUnavailableError,
      );
    });
  });

  describe('board columns', () => {
    it('reads the saved columns in board order, ignoring unknown ones', async () => {
      const { service, select } = setup({
        data: { board_columns: ['done', 'todo', 'archive'] },
        error: null,
      });
      await expect(service.loadBoardColumns()).resolves.toEqual(['todo', 'done']);
      expect(select).toHaveBeenCalledWith('board_columns');
    });

    it('returns null when nothing was chosen, so the default applies', async () => {
      await expect(
        setup({ data: null, error: null }).service.loadBoardColumns(),
      ).resolves.toBeNull();
      TestBed.resetTestingModule();
      await expect(
        setup({ data: { board_columns: null }, error: null }).service.loadBoardColumns(),
      ).resolves.toBeNull();
    });

    it('upserts only board_columns, in board order', async () => {
      const { service, upsert } = setup({ error: null });
      await service.saveBoardColumns(['cancelled', 'todo']);
      expect(upsert).toHaveBeenCalledWith(
        { board_columns: ['todo', 'cancelled'] },
        { onConflict: 'user_id' },
      );
    });

    it('never saves an empty choice and fails without details', async () => {
      const { service, upsert } = setup({ error: null });
      await expect(service.saveBoardColumns([])).rejects.toBeInstanceOf(
        PreferencesUnavailableError,
      );
      expect(upsert).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      const failing = setup({ data: null, error: { message: 'secret detail' } });
      const error = await failing.service.loadBoardColumns().catch((e: unknown) => e);
      expect(String(error)).not.toContain('secret detail');
    });
  });
});
