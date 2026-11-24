import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from '../data/auth.service';

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/';

/** Pages that need a valid session: without one, go to the login and come back afterwards. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (await auth.hasValidSession()) {
    return true;
  }
  return router.createUrlTree([LOGIN_PATH], { queryParams: { redirect: state.url } });
};

/** The login page: whoever is already signed in goes straight to the home page. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return (await auth.hasValidSession()) ? router.parseUrl(HOME_PATH) : true;
};

/**
 * The page to return to after sign-in. Only internal paths are accepted (no `//host`,
 * no `/\host`, no absolute URLs), and never the login page itself.
 */
export function safeRedirect(redirect: string | null | undefined): string {
  if (
    !redirect ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    redirect.startsWith('/\\')
  ) {
    return HOME_PATH;
  }
  if (
    redirect === LOGIN_PATH ||
    redirect.startsWith(`${LOGIN_PATH}?`) ||
    redirect.startsWith(`${LOGIN_PATH}/`)
  ) {
    return HOME_PATH;
  }
  return redirect;
}
