import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LocalSettings } from '../shared/local-settings';
import { ThemeService } from '../theme/theme.service';
import { PersonalizationPage } from './personalization.page';

async function setup() {
  const theme = { choice: signal('dark'), choose: vi.fn(async () => undefined) };
  await TestBed.configureTestingModule({
    imports: [PersonalizationPage],
    providers: [{ provide: ThemeService, useValue: theme }],
  }).compileComponents();
  const fixture = TestBed.createComponent(PersonalizationPage);
  await fixture.whenStable();
  return { fixture, theme, element: fixture.nativeElement as HTMLElement };
}

const option = (element: HTMLElement, label: string) =>
  Array.from(element.querySelectorAll('label'))
    .find((l) => l.querySelector('.choice__label')?.textContent?.trim() === label)!
    .querySelector('input')!;

describe('PersonalizationPage', () => {
  beforeEach(() => localStorage.clear());

  it('shows the current theme and passes a new choice to the theme service', async () => {
    const { element, theme } = await setup();

    expect(option(element, 'Scuro (Grafite)').checked).toBe(true);
    option(element, 'Chiaro').click();

    expect(theme.choose).toHaveBeenCalledWith('light');
  });

  it('switches the cards to the plain style and back', async () => {
    const { fixture, element } = await setup();
    const settings = TestBed.inject(LocalSettings);
    expect(option(element, 'Bordo del progetto').checked).toBe(true);

    option(element, 'Pulita').click();
    await fixture.whenStable();
    expect(settings.cardStyle()).toBe('clean');
    expect(localStorage.getItem('coordinator.cardStyle')).toBe('clean');

    option(element, 'Bordo del progetto').click();
    expect(settings.cardStyle()).toBe('project');
  });

  it('hides and shows the priority number on the cards', async () => {
    const { element } = await setup();
    const settings = TestBed.inject(LocalSettings);
    const rank = option(element, 'Numero di priorità sulle schede');
    expect(rank.checked).toBe(true);

    rank.click();
    expect(settings.showRank()).toBe(false);
    expect(localStorage.getItem('coordinator.showRank')).toBe('false');
  });
});
