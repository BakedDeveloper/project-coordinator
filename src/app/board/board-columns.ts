import {
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
  type CdkDrag as Drag,
  type CdkDragDrop,
  type CdkDropList as DropList,
} from '@angular/cdk/drag-drop';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideLock } from '@lucide/angular';

import { TaskCard } from '../all-projects/task-card';
import { ColumnsMenu } from './columns-menu';
import { DeleteDialog } from './delete-dialog';
import { PausedProjectEntry } from './paused-project';
import { ProjectGroup } from './project-group';
import type { BoardTask, PausedProject } from '../data/board.service';
import { ProjectService } from '../data/project.service';
import { PreferencesService } from '../data/preferences.service';
import { TaskHasHoursError, TaskService } from '../data/task.service';
import { CLOCK } from '../shared/clock';
import {
  BOARD_COLUMNS,
  DEFAULT_GROUPED_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  groupByProject,
  moveTargets,
  withMove,
  type BoardColumn,
  type ColumnKey,
  type TargetColumn,
  type TaskGroup,
} from './board.model';

/** A list inside a column: all its tasks, or the tasks of one project. */
interface Section {
  key: string;
  group: TaskGroup | null;
  tasks: BoardTask[];
}

const LABELS = new Map(BOARD_COLUMNS.map((c) => [c.key, c.label]));

/**
 * The board columns (docs/viste.md, "Colonne"), shared by the shared board and the
 * project board. On a phone only one column shows, chosen with the column tabs. The
 * "Colonne" menu chooses which columns to show; the choice is saved in the preferences.
 *
 * A card moves by dragging it or with its "Sposta in…" menu (keyboard and touch). The card
 * moves at once; if the database write fails it goes back and a message says so.
 */
@Component({
  selector: 'app-board-columns',
  imports: [
    TaskCard,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    LucideLock,
    DeleteDialog,
    PausedProjectEntry,
    ColumnsMenu,
    ProjectGroup,
  ],
  templateUrl: './board-columns.html',
  styleUrl: './board-columns.css',
})
export class BoardColumns {
  private readonly taskService = inject(TaskService);
  private readonly clock = inject(CLOCK);
  private readonly preferences = inject(PreferencesService);
  private readonly injector = inject(Injector);
  private readonly projects = inject(ProjectService);

  readonly columns = input.required<BoardColumn[]>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag on the cards. Off on a project board. */
  readonly showProject = input(true);
  /** Suspended projects, shown at the top of Sospeso instead of their tasks. */
  readonly pausedProjects = input<PausedProject[]>([]);

  /** A task changed status in the database: the page reloads to get the new order. */
  readonly moved = output<void>();

  /** The columns to show, in board order. */
  protected readonly visible = signal<readonly ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);

  /** The columns grouped by project (only on the shared board). */
  protected readonly grouped = signal<readonly ColumnKey[]>(DEFAULT_GROUPED_COLUMNS);

  /** The open project cards of the grouped columns, as `column:project`. Closed by default. */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** The column chosen on a phone, where only one fits. */
  protected readonly current = signal<ColumnKey>('todo');
  /** The chosen phone column, or the first visible one when it was hidden. */
  protected readonly currentKey = computed(() => {
    const visible = this.visible();
    return visible.includes(this.current()) ? this.current() : (visible[0] ?? 'todo');
  });
  /** The task whose "Sposta in…" menu is open. */
  protected readonly menuFor = signal<string | null>(null);
  /** Tasks being written, shown already moved. Reset when the page gives new columns. */
  private readonly pending = linkedSignal<BoardColumn[], ReadonlyMap<string, TargetColumn>>({
    source: this.columns,
    computation: () => new Map(),
  });
  protected readonly error = signal<string | null>(null);
  /** The project whose resume is being written. */
  protected readonly resuming = signal<string | null>(null);
  /** Tasks deleted, hidden until the page gives new columns. */
  private readonly removed = linkedSignal<BoardColumn[], ReadonlySet<string>>({
    source: this.columns,
    computation: () => new Set(),
  });

  /** The task in the delete confirmation. */
  protected readonly toDelete = signal<BoardTask | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  /** The task has logged hours: it cannot be deleted, only cancelled. */
  protected readonly hasHours = signal(false);
  private readonly deleteDialog = viewChild.required(DeleteDialog);
  private deleteReturnFocus: HTMLElement | null = null;

  protected readonly shown = computed(() => {
    let columns = this.columns();
    for (const [taskId, to] of this.pending()) {
      columns = withMove(columns, taskId, to, this.clock());
    }
    const removed = this.removed();
    return removed.size === 0
      ? columns
      : columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => !removed.has(t.id)) }));
  });

  /** The columns on screen: the visible ones, with the moves being written. */
  protected readonly displayed = computed(() =>
    this.shown().filter((column) => this.visible().includes(column.key)),
  );

  constructor() {
    this.preferences.loadBoardColumns().then(
      (saved) => {
        if (saved !== null) {
          this.visible.set(saved);
        }
      },
      // No saved choice can be read: the default columns stay.
      () => undefined,
    );
    this.preferences.loadGroupedColumns().then(
      (saved) => {
        if (saved !== null) {
          this.grouped.set(saved);
        }
      },
      () => undefined,
    );
  }

  protected isGrouped(key: ColumnKey): boolean {
    return this.grouped().includes(key);
  }

  protected toggleGrouped(key: ColumnKey): void {
    const next = BOARD_COLUMNS.map((c) => c.key).filter((k) =>
      k === key ? !this.isGrouped(key) : this.isGrouped(k),
    );
    this.grouped.set(next);
    this.preferences.saveGroupedColumns(next).then(
      () => this.error.set(null),
      () => this.error.set('Non sono riuscito a salvare il raggruppamento. Riprova.'),
    );
  }

  /**
   * The lists of a column: when it is grouped (only on the shared board, where cards of
   * several projects meet) one card per project, closed until Simone opens it; else a single
   * list.
   */
  protected sections(column: BoardColumn): Section[] {
    if (!this.showProject() || !this.isGrouped(column.key)) {
      return [{ key: column.key, group: null, tasks: column.tasks }];
    }
    return groupByProject(column.tasks).map((group) => ({
      key: group.projectId,
      group,
      tasks: group.tasks,
    }));
  }

  protected isExpanded(column: ColumnKey, projectId: string): boolean {
    return this.expanded().has(`${column}:${projectId}`);
  }

  protected toggleExpanded(column: ColumnKey, projectId: string): void {
    const key = `${column}:${projectId}`;
    this.expanded.update((open) => {
      const next = new Set(open);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  protected toggleColumn(key: ColumnKey, show: boolean): void {
    const next = BOARD_COLUMNS.map((c) => c.key).filter((k) =>
      k === key ? show : this.visible().includes(k),
    );
    if (next.length === 0) {
      return;
    }
    this.visible.set(next);
    this.preferences.saveBoardColumns(next).then(
      () => this.error.set(null),
      () => this.error.set('Non sono riuscito a salvare la scelta delle colonne. Riprova.'),
    );
  }

  /** Shown in an empty In corso: the first task of Da fare. */
  protected readonly nextToStart = computed(
    () => this.shown().find((c) => c.key === 'todo')?.tasks[0] ?? null,
  );

  protected targets(task: BoardTask): { key: TargetColumn; label: string }[] {
    if (this.pending().has(task.id)) {
      return [];
    }
    return moveTargets(task).map((key) => ({ key, label: LABELS.get(key) ?? key }));
  }

  protected isPending(task: BoardTask): boolean {
    return this.pending().has(task.id);
  }

  protected canDrag(task: BoardTask): boolean {
    return this.targets(task).length > 0;
  }

  /** A card may enter its own column (to go back) or one of its targets. */
  protected readonly canEnter = (drag: Drag<BoardTask>, drop: DropList<ColumnKey>): boolean =>
    moveTargets(drag.data).some((key) => key === drop.data);

  protected dropped(event: CdkDragDrop<ColumnKey, ColumnKey, BoardTask>): void {
    const to = event.container.data;
    if (event.previousContainer === event.container || to === 'blocked') {
      return;
    }
    void this.move(event.item.data, to);
  }

  protected toggleMenu(task: BoardTask): void {
    this.menuFor.update((id) => (id === task.id ? null : task.id));
  }

  protected closeMenu(trigger: HTMLButtonElement): void {
    this.menuFor.set(null);
    trigger.focus();
  }

  protected chooseTarget(task: BoardTask, to: TargetColumn): void {
    this.menuFor.set(null);
    void this.move(task, to);
  }

  protected askDelete(task: BoardTask, trigger: HTMLElement): void {
    this.menuFor.set(null);
    this.deleteReturnFocus = trigger;
    this.deleteError.set(null);
    this.hasHours.set(false);
    this.toDelete.set(task);
    // After the content is drawn, so the dialog focuses its Annulla button.
    afterNextRender(() => this.deleteDialog().open(), {
      injector: this.injector,
    });
  }

  protected closeDelete(): void {
    this.deleteDialog().close();
  }

  /** The dialog closed, by a button or Escape: back to where Simone was. */
  protected deleteClosed(): void {
    this.toDelete.set(null);
    this.deleting.set(false);
    this.deleteReturnFocus?.focus();
    this.deleteReturnFocus = null;
  }

  protected async confirmDelete(task: BoardTask): Promise<void> {
    if (this.deleting() || task.fromGithub) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.taskService.delete(task.id);
      this.removed.update((r) => new Set(r).add(task.id));
      // The card is gone: the focus goes to the board, not to a removed button.
      this.deleteReturnFocus = null;
      this.closeDelete();
      this.moved.emit();
    } catch (e) {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      if (e instanceof TaskHasHoursError) {
        this.hasHours.set(true);
        this.deleteError.set(
          'Ha ore registrate: non si può eliminare. Puoi spostarlo in Annullato.',
        );
      } else {
        this.deleteError.set('Non sono riuscito a eliminare il task. Riprova.');
      }
    } finally {
      this.deleting.set(false);
    }
  }

  protected cancelInstead(task: BoardTask): void {
    this.closeDelete();
    void this.move(task, 'cancelled');
  }

  /** Resumes a suspended project: its tasks come back where they were. */
  protected async resume(project: PausedProject): Promise<void> {
    if (this.resuming() !== null) {
      return;
    }
    this.resuming.set(project.id);
    this.error.set(null);
    try {
      await this.projects.setStatus(project.id, 'active');
      this.moved.emit();
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.error.set(`Non sono riuscito a riprendere «${project.name}». Riprova.`);
    } finally {
      this.resuming.set(null);
    }
  }

  async move(task: BoardTask, to: TargetColumn): Promise<void> {
    if (!moveTargets(task).includes(to) || this.pending().has(task.id)) {
      return;
    }
    this.error.set(null);
    this.pending.update((p) => new Map(p).set(task.id, to));
    try {
      await this.taskService.setStatus(task.id, to);
      this.moved.emit();
    } catch {
      // No details: they could contain project data (CLAUDE.md, Sicurezza).
      this.pending.update((p) => {
        const next = new Map(p);
        next.delete(task.id);
        return next;
      });
      this.error.set(`Non sono riuscito a spostare «${task.title}». Riprova.`);
    }
  }
}
