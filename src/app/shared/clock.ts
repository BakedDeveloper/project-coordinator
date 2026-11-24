import { InjectionToken } from '@angular/core';

/** The current time. Replace it in tests to fix "today". */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
