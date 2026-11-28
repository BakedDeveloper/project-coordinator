import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../data/auth.service';
import { ProjectService } from '../data/project.service';
import { LocalSettings } from '../shared/local-settings';
import { ThemeService } from '../theme/theme.service';
import { Shell } from './shell';

@Component({ template: '' })
class Blank {}

async function setup() {
  const auth = { signOut: vi.fn(async () => undefined) };
  const theme = {
    choice: signal('system'),
    saveFailed: signal(false),
    syncFromDatabase: vi.fn(async () => undefined),
    choose: vi.fn(async () => undefined),
  };
  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([
        { path: '', component: Blank },
        { path: 'priorita', component: Blank },
        { path: 'personalizzazione', component: Blank },
      ]),
      { provide: AuthService, useValue: auth },
      { provide: ThemeService, useValue: theme },
      { provide: ProjectService, useValue: { list: vi.fn(async () => []) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Shell);
  document.body.appendChild(fixture.nativeElement);
  await TestBed.inject(Router).navigateByUrl('/');
  await fixture.whenStable();
  return { fixture, auth, theme, element: fixture.nativeElement as HTMLElement };
}

const button = (element: HTMLElement, label: string) =>
  Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  )!;

describe('Shell', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() =>
    document.body.querySelectorAll('app-shell, div[id^="root"]').forEach((e) => e.remove()),
  );

  it('has a side menu with the sections, Personalizza and Esci', async () => {
    const { element } = await setup();
    const nav = element.querySelector('nav[aria-label="Menu principale"]')!;

    expect(
      Array.from(nav.querySelectorAll<HTMLAnchorElement>('a.nav__link')).map((a) => [
        a.textContent?.trim(),
        a.getAttribute('href'),
      ]),
    ).toEqual([
      ['Board', '/'],
      ['Priorità', '/priorita'],
      ['Personalizza', '/personalizzazione'],
    ]);
    expect(nav.querySelector('app-sidebar-projects')).not.toBeNull();
  });

  it('marks the current section with aria-current', async () => {
    const { fixture, element } = await setup();
    await TestBed.inject(Router).navigateByUrl('/priorita');
    await fixture.whenStable();

    const current = element.querySelectorAll('a[aria-current="page"]');
    expect(Array.from(current).map((a) => a.textContent?.trim())).toEqual(['Priorità']);
  });

  it('"Esci" signs out and goes to the login', async () => {
    const { fixture, auth, element } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    button(element, 'Esci').click();
    await fixture.whenStable();

    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('loads the saved theme when it appears', async () => {
    const { theme } = await setup();
    expect(theme.syncFromDatabase).toHaveBeenCalledOnce();
  });

  it('reduces the menu to icons and remembers it', async () => {
    const { fixture, element } = await setup();
    const reduce = button(element, 'Riduci il menu');
    expect(reduce.getAttribute('aria-pressed')).toBe('false');

    reduce.click();
    await fixture.whenStable();

    expect(element.querySelector('.shell')!.classList).toContain('shell--collapsed');
    expect(reduce.getAttribute('aria-pressed')).toBe('true');
    expect(TestBed.inject(LocalSettings).sidebarCollapsed()).toBe(true);
    expect(localStorage.getItem('coordinator.sidebarCollapsed')).toBe('true');
  });

  it('opens the phone menu from its button, Escape closes it and gives the focus back', async () => {
    const { fixture, element } = await setup();
    const menu = element.querySelector<HTMLButtonElement>('.topbar__menu')!;
    expect(menu.getAttribute('aria-controls')).toBe('side-menu');
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    menu.click();
    await fixture.whenStable();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.backdrop')).not.toBeNull();

    // The top bar is hidden at this width in jsdom, so focus() is checked as a call.
    const focus = vi.spyOn(menu, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(focus).toHaveBeenCalled();
  });

  it('closes the phone menu after moving to another page', async () => {
    const { fixture, element } = await setup();
    const menu = element.querySelector<HTMLButtonElement>('.topbar__menu')!;
    menu.click();
    await fixture.whenStable();

    await TestBed.inject(Router).navigateByUrl('/priorita');
    await fixture.whenStable();

    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('says when the theme was not saved', async () => {
    const { fixture, element, theme } = await setup();
    const notice = element.querySelector('.shell__notice')!;
    expect(notice.textContent?.trim()).toBe('');

    theme.saveFailed.set(true);
    await fixture.whenStable();
    expect(notice.textContent).toContain('non è stato salvato');
  });
});
