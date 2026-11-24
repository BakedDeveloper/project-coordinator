import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../data/auth.service';
import { safeRedirect } from './auth.guards';

const MESSAGES = {
  'invalid-credentials': 'Email o password non corretti.',
  unavailable: 'Accesso non riuscito. Controlla la connessione e riprova.',
} as const;

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput =
    viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected showErrors(control: FormControl<string>): boolean {
    return this.submitted() && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitted.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.controls;
    if (this.form.invalid) {
      (email.invalid ? this.emailInput() : this.passwordInput()).nativeElement.focus();
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.signIn(email.value.trim(), password.value);
    this.submitting.set(false);

    if (result === 'ok') {
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(safeRedirect(redirect));
      return;
    }

    password.reset();
    this.submitted.set(false);
    this.errorMessage.set(MESSAGES[result]);
    this.passwordInput().nativeElement.focus();
  }
}
