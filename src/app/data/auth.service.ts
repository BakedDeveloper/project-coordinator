import { Injectable, computed, inject, signal } from '@angular/core';
import { isAuthApiError, type Session } from '@supabase/supabase-js';

import { SUPABASE } from './supabase.client';

/** Outcome of a sign-in attempt, without Supabase types leaking out of the data layer. */
export type SignInResult = 'ok' | 'invalid-credentials' | 'unavailable';

/**
 * Supabase Auth behind a small API. Sign-up is deliberately missing: there is only one
 * user, and public sign-up is disabled in Supabase.
 *
 * Errors are never logged: they could carry the email address or other account data.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);

  private readonly session = signal<Session | null>(null);
  private readonly lostSession = signal(false);
  private signingOut = false;

  readonly isSignedIn = computed(() => this.session() !== null);

  /**
   * True when the session ended without the user signing out (for example the refresh
   * token expired or was revoked). The app reacts by sending the user back to the login.
   */
  readonly sessionLost = this.lostSession.asReadonly();

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      if (session === null && this.session() !== null && !this.signingOut) {
        this.lostSession.set(true);
      }
      this.session.set(session);
    });
  }

  /** Reads the stored session (refreshing it if needed) and tells whether it is still valid. */
  async hasValidSession(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      const session = error ? null : data.session;
      const valid = session !== null && !isExpired(session);
      this.session.set(valid ? session : null);
      return valid;
    } catch {
      this.session.set(null);
      return false;
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Every 4xx answer from Supabase Auth gets the same generic message, so the
        // login never reveals whether the email exists.
        return isAuthApiError(error) && error.status >= 400 && error.status < 500
          ? 'invalid-credentials'
          : 'unavailable';
      }
      this.lostSession.set(false);
      this.session.set(data.session);
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  /** Signs out this device only. The local session is removed even if the network call fails. */
  async signOut(): Promise<void> {
    this.signingOut = true;
    try {
      await this.supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Nothing to do: the guard sends the user to the login anyway.
    } finally {
      this.session.set(null);
      this.lostSession.set(false);
      this.signingOut = false;
    }
  }

  /** Called once the app has reacted to a lost session. */
  acknowledgeSessionLost(): void {
    this.lostSession.set(false);
  }
}

function isExpired(session: Session): boolean {
  return session.expires_at !== undefined && session.expires_at * 1000 <= Date.now();
}
