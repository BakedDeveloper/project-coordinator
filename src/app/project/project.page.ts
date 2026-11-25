import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { formatShortDate, projectColor, toIsoDate } from '../all-projects/all-projects.model';
import { TaskCard } from '../all-projects/task-card';
import { ProjectService, type ProjectDetail } from '../data/project.service';
import { CLOCK } from '../shared/clock';
import {
  COLUMNS,
  SCOPE_LABELS,
  STATUS_LABELS,
  buildTimeline,
  columnOf,
  hasTasks,
  nextToStart,
  undatedCells,
} from './project.model';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const APP_NAME = 'Coordinatore';

/** View G of docs/viste.md: the open tasks of one project, by date. Read-only. */
@Component({
  selector: 'app-project-page',
  imports: [TaskCard],
  templateUrl: './project.page.html',
  styleUrl: './project.page.css',
})
export class ProjectPage {
  private readonly projects = inject(ProjectService);
  private readonly clock = inject(CLOCK);
  private readonly title = inject(Title);

  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly columns = COLUMNS;
  protected readonly state = signal<LoadState>('loading');
  protected readonly today = signal(toIsoDate(this.clock()));
  protected readonly detail = signal<ProjectDetail | null>(null);

  protected readonly project = computed(() => this.detail()?.project ?? null);
  protected readonly color = computed(() => {
    const p = this.project();
    return p ? projectColor(p.id, p.color) : '';
  });
  protected readonly meta = computed(() => {
    const p = this.project();
    return p ? `${SCOPE_LABELS[p.scope]} · ${STATUS_LABELS[p.status]}` : '';
  });
  protected readonly unprioritized = computed(() => {
    const status = this.project()?.status;
    return status === 'paused' || status === 'closed';
  });
  protected readonly hasPlan = computed(() => (this.project()?.weeklyHours ?? null) !== null);

  private readonly tasks = computed(() => this.detail()?.tasks ?? []);
  protected readonly timeline = computed(() =>
    buildTimeline(this.tasks(), this.detail()?.checkpoints ?? [], this.today()),
  );
  protected readonly undated = computed(() => undatedCells(this.tasks()));
  protected readonly hasUndated = computed(() => hasTasks(this.undated()));
  protected readonly nothingInProgress = computed(
    () => !this.tasks().some((t) => columnOf(t) === 'in_progress'),
  );
  protected readonly next = computed(() => nextToStart(this.tasks()));
  protected readonly todayLabel = computed(() => formatShortDate(this.today()));

  /** Counts the loads, so a slow answer for a previous project is dropped. */
  private loadCount = 0;

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected shortDate(isoDate: string): string {
    return formatShortDate(isoDate);
  }

  private async load(id: string): Promise<void> {
    const current = ++this.loadCount;
    this.state.set('loading');
    this.detail.set(null);
    try {
      const detail = await this.projects.load(id);
      if (current !== this.loadCount) {
        return;
      }
      this.today.set(toIsoDate(this.clock()));
      if (detail === null) {
        this.title.setTitle(`Progetto non trovato · ${APP_NAME}`);
        this.state.set('not-found');
        return;
      }
      this.detail.set(detail);
      this.title.setTitle(`${detail.project.name} · ${APP_NAME}`);
      this.state.set('ready');
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      if (current === this.loadCount) {
        this.state.set('error');
      }
    }
  }
}
