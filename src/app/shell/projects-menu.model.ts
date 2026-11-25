import type { ProjectLink, ProjectStatus } from '../data/project.service';

export interface ProjectGroup {
  status: ProjectStatus;
  label: string;
  projects: ProjectLink[];
}

const GROUPS: readonly { status: ProjectStatus; label: string }[] = [
  { status: 'active', label: 'Attivi' },
  { status: 'paused', label: 'In pausa' },
  { status: 'closed', label: 'Chiusi' },
];

const BY_NAME = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** Active projects first, then paused, then closed; by name inside each group. Empty groups are left out. */
export function groupProjects(projects: readonly ProjectLink[]): ProjectGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    projects: projects
      .filter((p) => p.status === group.status)
      .sort((a, b) => BY_NAME.compare(a.name, b.name)),
  })).filter((group) => group.projects.length > 0);
}
