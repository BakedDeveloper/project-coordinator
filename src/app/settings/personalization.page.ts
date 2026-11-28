import { Component, inject } from '@angular/core';

import { isThemeChoice, type ThemeChoice } from '../data/preferences.service';
import { LocalSettings, type CardStyle } from '../shared/local-settings';
import { ThemeService } from '../theme/theme.service';

const THEMES: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Come il sistema' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro (Grafite)' },
];

const CARD_STYLES: readonly { value: CardStyle; label: string; hint: string }[] = [
  {
    value: 'project',
    label: 'Bordo del progetto',
    hint: 'Il bordo e il nome del progetto nel suo colore.',
  },
  { value: 'clean', label: 'Pulita', hint: 'Bordo neutro: il colore solo nel riquadro del logo.' },
];

/**
 * The Personalizzazione page (issue #66): theme, look of the board cards and the priority
 * number. The theme is saved in the database; the card choices on this device.
 */
@Component({
  selector: 'app-personalization-page',
  templateUrl: './personalization.page.html',
  styleUrl: './personalization.page.css',
})
export class PersonalizationPage {
  protected readonly theme = inject(ThemeService);
  protected readonly settings = inject(LocalSettings);

  protected readonly themes = THEMES;
  protected readonly cardStyles = CARD_STYLES;

  protected chooseTheme(value: string): void {
    if (isThemeChoice(value)) {
      void this.theme.choose(value);
    }
  }
}
