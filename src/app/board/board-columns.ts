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
import { DeleteDialog } from './delete-dialog';
import type { BoardTask } from '../data/board.service';
import { PreferencesService } from '../data/preferences.service';
import { TaskHasHoursError, TaskService } from '../data/task.service';
import { CLOCK } from '../shared/clock';
import {
  BOARD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  moveTargets,
  withMove,
  type BoardColumn,
  type ColumnKey,
  type TargetColumn,
} from './board.model';

const LABELS = new Map(BOARD_COLUMNS.map((c) => [c.key, c.label]));

/**
 * The four board columns (docs/viste.md, "Colonne"), shared by the shared board and the
 * project board. On a phone only one column shows, chosen with the column tabs. The
 * "Colonne" menu chooses which columns to show; the choice is saved in the preferences.
 *
 * A card moves by dragging it or with its "Sposta in…" menu (keyboard and touch). The card
 * moves at once; if the database write fails it goes back and a message says so.
 */
@Component({
  selector: 'app-board-columns',
  imports: [TaskCard, CdkDropListGroup, CdkDropList, CdkDrag, LucideLock, DeleteDialog],
  templateUrl: './board-columns.html',
  styleUrl: './board-columns.css',
})
export class BoardColumns {
  private readonly taskService = inject(TaskService);
  private readonly clock = inject(CLOCK);
  private readonly preferences = inject(PreferencesService);
  private readonly injector = inject(Injector);

  readonly columns = input.required<BoardColumn[]>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag on the cards. Off on a project board. */
  readonly showProject = input(true);

  /** A task changed status in the database: the page reloads to get the new order. */
  readonly moved = output<void>();

  /** Every column, for the "Colonne" menu. */
  protected readonly allColumns = BOARD_COLUMNS;
  /** The columns to show, in board order. */
  protected readonly visible = signal<readonly ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  protected readonly columnsMenuOpen = signal(false);

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
  }

  protected isVisible(key: ColumnKey): boolean {
    return this.visible().includes(key);
  }

  /** The last visible column cannot be hidden: the board would be empty. */
  protected isLastVisible(key: ColumnKey): boolean {
    const visible = this.visible();
    return visible.length === 1 && visible[0] === key;
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

  protected closeColumnsMenu(trigger: HTMLButtonElement): void {
    this.columnsMenuOpen.set(false);
    trigger.focus();
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
