import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { projectColor } from '../all-projects/all-projects.model';
import { ProjectBadge } from '../shared/project-badge';
import { ProjectService, type ProjectLink } from '../data/project.service';
import { groupProjects } from './projects-menu.model';

type LoadState = 'loading' | 'ready' | 'error';

/** "Progetti" button in the header: every project, active, paused and closed. */
@Component({
  selector: 'app-projects-menu',
  imports: [RouterLink, RouterLinkActive, ProjectBadge],
  templateUrl: './projects-menu.html',
  styleUrl: './projects-menu.css',
  host: {
    '(document:keydown.escape)': 'closeAndFocus()',
    '(document:click)': 'closeIfOutside($event)',
  },
})
export class ProjectsMenu {
  private readonly projects = inject(ProjectService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toggleButton = viewChild.required<ElementRef<HTMLButtonElement>>('toggleButton');

  protected readonly open = signal(false);
  protected readonly state = signal<LoadState>('loading');
  private readonly list = signal<ProjectLink[]>([]);
  protected readonly groups = computed(() => groupProjects(this.list()));

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    // Read at every opening: the Claude accounts add projects while the app is open.
    void this.load();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected closeAndFocus(): void {
    if (this.open()) {
      this.open.set(false);
      this.toggleButton().nativeElement.focus();
    }
  }

  protected closeIfOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected color(project: ProjectLink): string {
    return projectColor(project.id, project.color);
  }

  protected async load(): Promise<void> {
    this.state.set(this.list().length > 0 ? 'ready' : 'loading');
    try {
      this.list.set(await this.projects.list());
      this.state.set('ready');
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.state.set('error');
    }
  }
}
