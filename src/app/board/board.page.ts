import { Component, computed, inject, signal } from '@angular/core';

import { SCOPE_FILTERS, toIsoDate, type ScopeFilter } from '../all-projects/all-projects.model';
import { BoardService, type BoardTask, type PausedProject } from '../data/board.service';
import { CLOCK } from '../shared/clock';
import { BoardColumns } from './board-columns';
import { NewTask } from './new-task';
import { buildColumns, doneSince, projectOptions } from './board.model';

type LoadState = 'loading' | 'ready' | 'error';

/** Shared board of docs/viste.md: every task of every active project, by status. */
@Component({
  selector: 'app-board-page',
  imports: [BoardColumns, NewTask],
  templateUrl: './board.page.html',
  styleUrl: './board.page.css',
})
export class BoardPage {
  private readonly board = inject(BoardService);
  private readonly clock = inject(CLOCK);

  protected readonly scopes = SCOPE_FILTERS;
  protected readonly scope = signal<ScopeFilter>('all');
  protected readonly projectId = signal<string | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly today = signal(toIsoDate(this.clock()));

  private readonly tasks = signal<BoardTask[]>([]);
  private readonly paused = signal<PausedProject[]>([]);
  private readonly since = signal(doneSince(this.clock()));

  protected readonly projects = computed(() => projectOptions(this.tasks(), this.scope()));
  protected readonly columns = computed(() =>
    buildColumns(this.tasks(), { scope: this.scope(), projectId: this.projectId() }, this.since()),
  );

  /** The suspended projects within the filters, for the top of Sospeso. */
  protected readonly pausedProjects = computed(() =>
    this.paused().filter(
      (p) =>
        (this.scope() === 'all' || p.scope === this.scope()) &&
        (this.projectId() === null || p.id === this.projectId()),
    ),
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const now = this.clock();
    try {
      const [tasks, paused] = await Promise.all([
        this.board.load(doneSince(now)),
        this.readPaused(),
      ]);
      this.tasks.set(tasks);
      this.paused.set(paused);
      this.today.set(toIsoDate(now));
      this.since.set(doneSince(now));
      this.state.set('ready');
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.state.set('error');
    }
  }

  /** After a move: reads again without the loading message, so the board stays in place. */
  protected async refresh(): Promise<void> {
    const now = this.clock();
    try {
      const [tasks, paused] = await Promise.all([
        this.board.load(doneSince(now)),
        this.readPaused(),
      ]);
      this.tasks.set(tasks);
      this.paused.set(paused);
      this.today.set(toIsoDate(now));
      this.since.set(doneSince(now));
    } catch {
      // The move is saved; the board keeps the moved card until the next load.
    }
  }

  /** Without the suspended projects the board still works: they just do not show. */
  private readPaused(): Promise<PausedProject[]> {
    return this.board.pausedProjects().catch(() => []);
  }

  protected chooseScope(scope: ScopeFilter): void {
    this.scope.set(scope);
    // A project outside the new scope would leave the board empty for no visible reason.
    const id = this.projectId();
    if (id !== null && !this.projects().some((p) => p.id === id)) {
      this.projectId.set(null);
    }
  }

  protected chooseProject(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.projectId.set(value === '' ? null : value);
  }
}
