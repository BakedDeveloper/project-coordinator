import type { Provider } from '@angular/core';

import { BadgeService } from '../app/data/badge.service';
import { PreferencesService } from '../app/data/preferences.service';
import { TaskDetailService } from '../app/data/task-detail.service';
import { TaskService } from '../app/data/task.service';

/**
 * Providers for every unit test (angular.json, test target, `providersFile`).
 *
 * Every component that shows a project badge reads the badges: without this stub the tests
 * would call Supabase. The same for the board columns, which write task statuses and read the
 * visible columns from the preferences. The service
 * tests provide the real service, other tests their own fake.
 */
const providers: Provider[] = [
  { provide: BadgeService, useValue: { badges: () => Promise.resolve(new Map()) } },
  { provide: TaskService, useValue: { setStatus: () => Promise.resolve() } },
  { provide: TaskDetailService, useValue: { load: () => Promise.resolve(null) } },
  {
    provide: PreferencesService,
    useValue: {
      loadTheme: () => Promise.resolve(null),
      saveTheme: () => Promise.resolve(),
      loadBoardColumns: () => Promise.resolve(null),
      saveBoardColumns: () => Promise.resolve(),
      loadGroupedColumns: () => Promise.resolve(null),
      saveGroupedColumns: () => Promise.resolve(),
    },
  },
];

export default providers;
