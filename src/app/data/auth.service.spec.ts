import { TestBed } from '@angular/core/testing';
import { AuthApiError, type AuthChangeEvent, type Session } from '@supabase/supabase-js';

import { AuthService } from './auth.service';
import { SUPABASE } from './supabase.client';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

function fakeSession(expiresInSeconds = 3600): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: expiresInSeconds,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    user: { id: 'user-id' },
  } as Session;
}

function setup() {
  let listener: Listener = () => undefined;
  const auth = {
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => {
      listener('SIGNED_OUT', null);
      return { error: null };
    }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { auth } }] });
  const service = TestBed.inject(AuthService);
  return {
    service,
    auth,
    emit: (event: AuthChangeEvent, session: Session | null) => listener(event, session),
  };
}

describe('AuthService', () => {
  describe('hasValidSession', () => {
    it('is true with a stored, unexpired session', async () => {
      const { service, auth } = setup();
      auth.getSession.mockResolvedValue({ data: { session: fakeSession() }, error: null });

      expect(await service.hasValidSession()).toBe(true);
      expect(service.isSignedIn()).toBe(true);
    });

    it('is false without a session', async () => {
      const { service, auth } = setup();
      auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

      expect(await service.hasValidSession()).toBe(false);
      expect(service.isSignedIn()).toBe(false);
    });

    it('is false with an expired session', async () => {
      const { service, auth } = setup();
      auth.getSession.mockResolvedValue({ data: { session: fakeSession(-60) }, error: null });

      expect(await service.hasValidSession()).toBe(false);
    });

    it('is false when reading the session fails', async () => {
      const { service, auth } = setup();
      auth.getSession.mockRejectedValue(new Error('storage unavailable'));

      expect(await service.hasValidSession()).toBe(false);
    });
  });

  describe('signIn', () => {
    it('returns ok and keeps the session', async () => {
      const { service, auth } = setup();
      auth.signInWithPassword.mockResolvedValue({ data: { session: fakeSession() }, error: null });

      expect(await service.signIn('simone@example.com', 'secret')).toBe('ok');
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'simone@example.com',
        password: 'secret',
      });
      expect(service.isSignedIn()).toBe(true);
    });

    it('maps wrong credentials to a generic result', async () => {
      const { service, auth } = setup();
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      });

      expect(await service.signIn('simone@example.com', 'wrong')).toBe('invalid-credentials');
      expect(service.isSignedIn()).toBe(false);
    });

    it('maps server and network failures to unavailable', async () => {
      const { service, auth } = setup();
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null },
        error: new AuthApiError('Internal error', 500, 'unexpected_failure'),
      });
      auth.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      expect(await service.signIn('simone@example.com', 'secret')).toBe('unavailable');
      expect(await service.signIn('simone@example.com', 'secret')).toBe('unavailable');
    });
  });

  describe('session end', () => {
    it('flags a session lost without signing out', () => {
      const { service, emit } = setup();
      emit('SIGNED_IN', fakeSession());

      emit('SIGNED_OUT', null);

      expect(service.sessionLost()).toBe(true);
      service.acknowledgeSessionLost();
      expect(service.sessionLost()).toBe(false);
    });

    it('does not flag an explicit sign-out, which is local to this device', async () => {
      const { service, auth, emit } = setup();
      emit('SIGNED_IN', fakeSession());

      await service.signOut();

      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(service.isSignedIn()).toBe(false);
      expect(service.sessionLost()).toBe(false);
    });

    it('clears the session even if the sign-out call fails', async () => {
      const { service, auth, emit } = setup();
      emit('SIGNED_IN', fakeSession());
      auth.signOut.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await service.signOut();

      expect(service.isSignedIn()).toBe(false);
    });
  });
});
