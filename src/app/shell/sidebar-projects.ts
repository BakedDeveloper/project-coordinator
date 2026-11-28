import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { projectColor } from '../all-projects/all-projects.model';
import { ProjectService, type ProjectLink } from '../data/project.service';
import { LocalSettings, type MenuScope } from '../shared/local-settings';
import { ProjectBadge } from '../shared/project-badge';
import { groupProjects } from './projects-menu.model';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * The projects in the side menu (issue #66): the active ones always listed, paused and closed
 * ones folded away, with a Tutti / Lavoro / Personale selector. In the reduced menu only the
 * tiles of the active projects stay.
 */
@Component({
  selector: 'app-sidebar-projects',
  imports: [RouterLink, RouterLinkActive, ProjectBadge],
  templateUrl: './sidebar-projects.html',
  styleUrl: './sidebar-projects.css',
})
export class SidebarProjects {
  private readonly projects = inject(ProjectService);
  protected readonly settings = inject(LocalSettings);

  protected readonly scopes: readonly { value: MenuScope; label: string }[] = [
    { value: 'all', label: 'Tutti' },
    { value: 'work', label: 'Lavoro' },
    { value: 'personal', label: 'Personale' },
  ];

  /** The side menu is reduced to icons. */
  readonly collapsed = input(false);

  protected readonly state = signal<LoadState>('loading');
  private readonly list = signal<ProjectLink[]>([]);
  /** The groups of the chosen scope; the reduced menu shows every active project. */
  protected readonly groups = computed(() => {
    const scope = this.collapsed() ? 'all' : this.settings.menuScope();
    return groupProjects(this.list().filter((p) => scope === 'all' || p.scope === scope));
  });

  constructor() {
    void this.load();
  }

  protected color(project: ProjectLink): string {
    return projectColor(project.id, project.color);
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await this.projects.list());
      this.state.set('ready');
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.state.set('error');
    }
  }
}
