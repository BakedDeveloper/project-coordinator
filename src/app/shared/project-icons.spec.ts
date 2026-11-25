import { LucideTruck } from '@lucide/angular';

import { initials, projectIcon } from './project-icons';

describe('project icons', () => {
  it('finds a known icon by its kebab-case name', () => {
    expect(projectIcon('truck')).toBe(LucideTruck);
  });

  it('has no icon for a missing or unknown name', () => {
    expect(projectIcon(null)).toBeNull();
    expect(projectIcon('not-an-icon')).toBeNull();
    // Not fooled by names of Object.prototype.
    expect(projectIcon('constructor')).toBeNull();
  });

  it('makes up to two initials from the name', () => {
    expect(initials('Reply - Fleet')).toBe('RF');
    expect(initials('Fleet')).toBe('FL');
    expect(initials('Competenze IA')).toBe('CI');
    expect(initials('  ')).toBe('?');
  });
});
