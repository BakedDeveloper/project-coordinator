import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { LOGIN_PATH } from '../auth/auth.guards';
import { AuthService } from '../data/auth.service';

/** Frame of every protected page: header with the sign-out button, then the page. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly signingOut = signal(false);

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
