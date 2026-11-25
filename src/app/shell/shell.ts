import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { LOGIN_PATH } from '../auth/auth.guards';
import { AuthService } from '../data/auth.service';
import { isThemeChoice, type ThemeChoice } from '../data/preferences.service';
import { ThemeService } from '../theme/theme.service';
import { ProjectsMenu } from './projects-menu';

const THEME_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

/** Frame of every protected page: header with the theme and sign-out controls, then the page. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, ProjectsMenu],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly signingOut = signal(false);

  ngOnInit(): void {
    // The shell appears after every sign-in: the saved theme then replaces the cached one.
    void this.theme.syncFromDatabase();
  }

  protected chooseTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isThemeChoice(value)) {
      void this.theme.choose(value);
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    await this.auth.signOut();
    this.signingOut.set(false);
    await this.router.navigateByUrl(LOGIN_PATH);
  }
}
