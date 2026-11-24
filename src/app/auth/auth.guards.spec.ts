import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';

import { AuthService } from '../data/auth.service';
import { authGuard, guestGuard, safeRedirect } from './auth.guards';

function setup(hasSession: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { hasValidSession: vi.fn(async () => hasSession) } },
    ],
  });
  return TestBed.inject(Router);
}

const route = {} as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;

describe('authGuard', () => {
  it('lets a valid session through', async () => {
    setup(true);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(route, state('/progetti/x')),
    );

    expect(result).toBe(true);
  });

  it('sends a missing session to the login, keeping the requested page', async () => {
    const router = setup(false);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(route, state('/progetti/x?vista=compatta')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?redirect=%2Fprogetti%2Fx%3Fvista%3Dcompatta',
    );
  });
});

describe('guestGuard', () => {
  it('shows the login without a session', async () => {
    setup(false);
    const result = await TestBed.runInInjectionContext(() => guestGuard(route, state('/login')));

    expect(result).toBe(true);
  });

  it('sends a signed-in user to the home page', async () => {
    const router = setup(true);
    const result = await TestBed.runInInjectionContext(() => guestGuard(route, state('/login')));

    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});

describe('safeRedirect', () => {
  it.each([
    ['/progetti/x', '/progetti/x'],
    ['/?filtro=lavoro', '/?filtro=lavoro'],
    [null, '/'],
    ['', '/'],
    ['https://example.com', '/'],
    ['//example.com', '/'],
    ['/\\example.com', '/'],
    ['/login', '/'],
    ['/login?redirect=%2F', '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
