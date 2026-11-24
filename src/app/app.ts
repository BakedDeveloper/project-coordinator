import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { LOGIN_PATH } from './auth/auth.guards';
import { AuthService } from './data/auth.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // The session can end while a page is open (refresh token expired or revoked):
    // back to the login, then return to the same page.
    effect(() => {
      if (!this.auth.sessionLost()) {
        return;
      }
      this.auth.acknowledgeSessionLost();
      const current = this.router.url;
      void this.router.navigate([LOGIN_PATH], {
        queryParams: current.startsWith(LOGIN_PATH) ? {} : { redirect: current },
      });
    });
  }
}
