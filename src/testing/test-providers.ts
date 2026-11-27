import type { Provider } from '@angular/core';

import { BadgeService } from '../app/data/badge.service';

/**
 * Providers for every unit test (angular.json, test target, `providersFile`).
 *
 * Every component that shows a project badge reads the badges: without this stub the tests
 * would call Supabase. The badge tests provide the real service or their own fake.
 */
const providers: Provider[] = [
  { provide: BadgeService, useValue: { badges: () => Promise.resolve(new Map()) } },
];

export default providers;
