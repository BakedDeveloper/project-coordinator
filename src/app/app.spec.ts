import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { AuthService } from './data/auth.service';

async function setup() {
  const sessionLost = signal(false);
  const auth = { sessionLost, acknowledgeSessionLost: vi.fn(() => sessionLost.set(false)) };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  }).compileComponents();
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return { fixture, auth, sessionLost, navigate };
}

describe('App', () => {
  it('renders the router outlet', async () => {
    const { fixture } = await setup();

    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });

  it('goes back to the login when the session is lost', async () => {
    const { fixture, auth, sessionLost, navigate } = await setup();

    sessionLost.set(true);
    await fixture.whenStable();

    expect(auth.acknowledgeSessionLost).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { redirect: '/' } });
  });

  it('does nothing while the session is fine', async () => {
    const { navigate } = await setup();

    expect(navigate).not.toHaveBeenCalled();
  });
});
