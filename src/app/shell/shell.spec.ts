import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../data/auth.service';
import { ProjectService } from '../data/project.service';
import type { ThemeChoice } from '../data/preferences.service';
import { ThemeService } from '../theme/theme.service';
import { Shell } from './shell';

async function setup(choice: ThemeChoice = 'system') {
  const auth = { signOut: vi.fn(async () => undefined) };
  const theme = {
    choice: signal(choice),
    saveFailed: signal(false),
    syncFromDatabase: vi.fn(async () => undefined),
    choose: vi.fn(async () => undefined),
  };
  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ThemeService, useValue: theme },
      { provide: ProjectService, useValue: { list: vi.fn(async () => []) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  return { fixture, auth, theme, element: fixture.nativeElement as HTMLElement };
}

describe('Shell', () => {
  it('"Esci" signs out and goes to the login', async () => {
    const { fixture, auth, element } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const button = Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Esci',
    );
    expect(button?.type).toBe('button');
    button!.click();
    await fixture.whenStable();

    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('loads the saved theme when it appears', async () => {
    const { theme } = await setup();
    expect(theme.syncFromDatabase).toHaveBeenCalledOnce();
  });

  it('has a labelled "Tema" select showing the current choice', async () => {
    const { element } = await setup('dark');
    const select = element.querySelector('select')!;
    expect(select.closest('label')?.textContent).toContain('Tema');
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
      'Sistema',
      'Chiaro',
      'Scuro',
    ]);
    expect(select.value).toBe('dark');
  });

  it('choosing a theme passes it to the theme service', async () => {
    const { element, theme } = await setup();
    const select = element.querySelector('select')!;
    select.value = 'light';
    select.dispatchEvent(new Event('change'));
    expect(theme.choose).toHaveBeenCalledWith('light');
  });

  it('says when the theme was not saved', async () => {
    const { fixture, element, theme } = await setup();
    const notice = element.querySelector('[role="status"]')!;
    expect(notice.textContent?.trim()).toBe('');

    theme.saveFailed.set(true);
    await fixture.whenStable();
    expect(notice.textContent).toContain('non è stato salvato');
  });
});
