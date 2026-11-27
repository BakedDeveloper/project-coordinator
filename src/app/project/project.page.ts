import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { formatShortDate, projectColor, toIsoDate } from '../all-projects/all-projects.model';
import { TaskCard } from '../all-projects/task-card';
import { BoardColumns } from '../board/board-columns';
import { NewTask } from '../board/new-task';
import { ProjectBadge } from '../shared/project-badge';
import { buildColumns, doneSince, projectBoardTasks } from '../board/board.model';
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
/** The tab of the project page, from the `vista` query parameter. */
export type ProjectTab = 'board' | 'cronologia';

const APP_NAME = 'Coordinatore';

/**
 * One project (docs/viste.md): its board, and the Cronologia tab with the open tasks by date
 * (former view G).
 */
@Component({
  selector: 'app-project-page',
  imports: [TaskCard, BoardColumns, NewTask, RouterLink, ProjectBadge],
  templateUrl: './project.page.html',
  styleUrl: './project.page.css',
  host: { '[class.narrow]': "tab() === 'cronologia'" },
})
export class ProjectPage {
  private readonly projects = inject(ProjectService);
  private readonly clock = inject(CLOCK);
  private readonly title = inject(Title);

  private readonly route = inject(ActivatedRoute);
  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );
  protected readonly tab = toSignal(
    this.route.queryParamMap.pipe(
      map((params): ProjectTab => (params.get('vista') === 'cronologia' ? 'cronologia' : 'board')),
    ),
    { initialValue: 'board' as ProjectTab },
  );

  protected readonly columns = COLUMNS;
  protected readonly state = signal<LoadState>('loading');
  protected readonly today = signal(toIsoDate(this.clock()));
  protected readonly detail = signal<ProjectDetail | null>(null);
  private readonly since = signal(doneSince(this.clock()));

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
  /** Suspending or resuming is being written. */
  protected readonly statusBusy = signal(false);
  protected readonly statusError = signal<string | null>(null);

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

  protected readonly boardColumns = computed(() => {
    const detail = this.detail();
    return detail
      ? buildColumns(projectBoardTasks(detail), { scope: 'all', projectId: null }, this.since())
      : [];
  });

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

  /** After a move: reads again without the loading message, so the board stays in place. */
  protected async refresh(): Promise<void> {
    const id = this.id();
    const current = ++this.loadCount;
    const now = this.clock();
    try {
      const detail = await this.projects.load(id, doneSince(now));
      if (current === this.loadCount && detail !== null) {
        this.detail.set(detail);
        this.today.set(toIsoDate(now));
        this.since.set(doneSince(now));
      }
    } catch {
      // The move is saved; the board keeps the moved card until the next load.
    }
  }

  /** Suspends an active project, or resumes a paused one; the tasks stay as they are. */
  protected async toggleStatus(): Promise<void> {
    const p = this.project();
    if (!p || p.status === 'closed' || this.statusBusy()) {
      return;
    }
    this.statusBusy.set(true);
    this.statusError.set(null);
    try {
      await this.projects.setStatus(p.id, p.status === 'active' ? 'paused' : 'active');
      await this.refresh();
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.statusError.set(
        p.status === 'active'
          ? 'Non sono riuscito a sospendere il progetto. Riprova.'
          : 'Non sono riuscito a riprendere il progetto. Riprova.',
      );
    } finally {
      this.statusBusy.set(false);
    }
  }

  protected shortDate(isoDate: string): string {
    return formatShortDate(isoDate);
  }

  private async load(id: string): Promise<void> {
    const current = ++this.loadCount;
    this.state.set('loading');
    this.detail.set(null);
    const now = this.clock();
    try {
      const detail = await this.projects.load(id, doneSince(now));
      if (current !== this.loadCount) {
        return;
      }
      this.today.set(toIsoDate(now));
      this.since.set(doneSince(now));
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
