import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AuthService, type SignInResult } from '../data/auth.service';
import { LoginPage } from './login.page';

async function setup(options: { result?: SignInResult; redirect?: string } = {}) {
  const auth = { signIn: vi.fn(async (): Promise<SignInResult> => options.result ?? 'ok') };
  await TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(
              options.redirect ? { redirect: options.redirect } : {},
            ),
          },
        },
      },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginPage);
  await fixture.whenStable();
  return { fixture, auth, navigate, element: fixture.nativeElement as HTMLElement };
}

function type(element: HTMLElement, selector: string, value: string) {
  const input = element.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submit(fixture: ComponentFixture<LoginPage>) {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>('button[type="submit"]')!
    .click();
  await fixture.whenStable();
}

describe('LoginPage', () => {
  it('has labelled email and password fields and a real submit button', async () => {
    const { element } = await setup();

    expect(element.querySelector('label[for="login-email"]')?.textContent).toContain('Email');
    expect(element.querySelector('label[for="login-password"]')?.textContent).toContain('Password');
    expect(element.querySelector('#login-email')?.getAttribute('autocomplete')).toBe('username');
    expect(element.querySelector('#login-password')?.getAttribute('type')).toBe('password');
    expect(element.querySelector('button[type="submit"]')?.textContent).toContain('Accedi');
  });

  it('offers no sign-up', async () => {
    const { element } = await setup();

    expect(element.textContent?.toLowerCase()).not.toMatch(/registra|crea un account|sign up/);
  });

  it('requires both fields before calling Supabase', async () => {
    const { fixture, auth, element } = await setup();

    await submit(fixture);

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(element.querySelector('#login-email-error')?.textContent).toContain(
      "Inserisci l'email.",
    );
    expect(element.querySelector('#login-password-error')?.textContent).toContain(
      'Inserisci la password.',
    );
    expect(element.querySelector('#login-email')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('#login-email')?.getAttribute('aria-describedby')).toBe(
      'login-email-error',
    );
    expect(document.activeElement?.id).toBe('login-email');
  });

  it('rejects a malformed email', async () => {
    const { fixture, auth, element } = await setup();
    type(element, '#login-email', 'simone');
    type(element, '#login-password', 'secret');

    await submit(fixture);

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(element.querySelector('#login-email-error')?.textContent).toContain(
      "L'email non è valida.",
    );
  });

  it('signs in and returns to the requested page', async () => {
    const { fixture, auth, navigate, element } = await setup({ redirect: '/progetti/x' });
    type(element, '#login-email', '  simone@example.com ');
    type(element, '#login-password', 'secret');

    await submit(fixture);

    expect(auth.signIn).toHaveBeenCalledWith('simone@example.com', 'secret');
    expect(navigate).toHaveBeenCalledWith('/progetti/x');
  });

  it('ignores an external redirect', async () => {
    const { fixture, navigate, element } = await setup({ redirect: '//example.com' });
    type(element, '#login-email', 'simone@example.com');
    type(element, '#login-password', 'secret');

    await submit(fixture);

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows a generic error for wrong credentials and clears the password', async () => {
    const { fixture, navigate, element } = await setup({ result: 'invalid-credentials' });
    type(element, '#login-email', 'simone@example.com');
    type(element, '#login-password', 'wrong');

    await submit(fixture);

    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Email o password non corretti.',
    );
    expect(element.querySelector<HTMLInputElement>('#login-password')?.value).toBe('');
    expect(element.querySelector('#login-password-error')).toBeNull();
  });

  it('says when the service cannot be reached', async () => {
    const { fixture, element } = await setup({ result: 'unavailable' });
    type(element, '#login-email', 'simone@example.com');
    type(element, '#login-password', 'secret');

    await submit(fixture);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Accesso non riuscito');
  });
});
