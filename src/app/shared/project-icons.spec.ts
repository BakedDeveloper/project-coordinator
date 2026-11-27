import { LucideFolder, LucideTruck } from '@lucide/angular';

import { GENERIC_PROJECT_ICON, projectIcon } from './project-icons';

describe('project icons', () => {
  it('finds a known icon by its kebab-case name', () => {
    expect(projectIcon('truck')).toBe(LucideTruck);
  });

  it('gives the generic folder icon for a missing or unknown name, never nothing', () => {
    expect(GENERIC_PROJECT_ICON).toBe(LucideFolder);
    expect(projectIcon(null)).toBe(GENERIC_PROJECT_ICON);
    expect(projectIcon('not-an-icon')).toBe(GENERIC_PROJECT_ICON);
    // Not fooled by names of Object.prototype.
    expect(projectIcon('constructor')).toBe(GENERIC_PROJECT_ICON);
  });
});
