import { Component, computed, inject, signal } from '@angular/core';

import { PrioritiesService, type PriorityTask } from '../data/priorities.service';
import { CLOCK } from '../shared/clock';
import { SCOPE_FILTERS, groupByLevel, toIsoDate, type ScopeFilter } from './all-projects.model';
import { TaskCard } from './task-card';

type LoadState = 'loading' | 'ready' | 'error';

/** View F of docs/viste.md: what to do now, across all projects. Read-only. */
@Component({
  selector: 'app-all-projects-page',
  imports: [TaskCard],
  templateUrl: './all-projects.page.html',
  styleUrl: './all-projects.page.css',
})
export class AllProjectsPage {
  private readonly priorities = inject(PrioritiesService);
  private readonly clock = inject(CLOCK);

  protected readonly filters = SCOPE_FILTERS;
  protected readonly filter = signal<ScopeFilter>('all');
  protected readonly state = signal<LoadState>('loading');
  protected readonly today = signal(toIsoDate(this.clock()));

  private readonly tasks = signal<PriorityTask[]>([]);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly groups = computed(() => groupByLevel(this.tasks(), this.filter()));

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const tasks = await this.priorities.load();
      this.tasks.set(tasks);
      this.today.set(toIsoDate(this.clock()));
      this.state.set('ready');
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.state.set('error');
    }
  }

  protected isExpanded(projectId: string): boolean {
    return this.expanded().has(projectId);
  }

  protected toggle(projectId: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(projectId)) {
        next.add(projectId);
      }
      return next;
    });
  }
}
