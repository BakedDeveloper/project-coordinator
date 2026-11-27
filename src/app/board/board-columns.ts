import {
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
  type CdkDrag as Drag,
  type CdkDragDrop,
  type CdkDropList as DropList,
} from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { LucideLock } from '@lucide/angular';

import { TaskCard } from '../all-projects/task-card';
import type { BoardTask } from '../data/board.service';
import { TaskService } from '../data/task.service';
import { CLOCK } from '../shared/clock';
import {
  BOARD_COLUMNS,
  moveTargets,
  withMove,
  type BoardColumn,
  type ColumnKey,
  type TargetColumn,
} from './board.model';

const LABELS = new Map(BOARD_COLUMNS.map((c) => [c.key, c.label]));

/**
 * The four board columns (docs/viste.md, "Colonne"), shared by the shared board and the
 * project board. On a phone only one column shows, chosen with the column tabs.
 *
 * A card moves by dragging it or with its "Sposta in…" menu (keyboard and touch). The card
 * moves at once; if the database write fails it goes back and a message says so.
 */
@Component({
  selector: 'app-board-columns',
  imports: [TaskCard, CdkDropListGroup, CdkDropList, CdkDrag, LucideLock],
  templateUrl: './board-columns.html',
  styleUrl: './board-columns.css',
})
export class BoardColumns {
  private readonly taskService = inject(TaskService);
  private readonly clock = inject(CLOCK);

  readonly columns = input.required<BoardColumn[]>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag on the cards. Off on a project board. */
  readonly showProject = input(true);

  /** A task changed status in the database: the page reloads to get the new order. */
  readonly moved = output<void>();

  /** The column shown on a phone, where only one fits. */
  protected readonly current = signal<ColumnKey>('todo');
  /** The task whose "Sposta in…" menu is open. */
  protected readonly menuFor = signal<string | null>(null);
  /** Tasks being written, shown already moved. Reset when the page gives new columns. */
  private readonly pending = linkedSignal<BoardColumn[], ReadonlyMap<string, TargetColumn>>({
    source: this.columns,
    computation: () => new Map(),
  });
  protected readonly error = signal<string | null>(null);

  protected readonly shown = computed(() => {
    let columns = this.columns();
    for (const [taskId, to] of this.pending()) {
      columns = withMove(columns, taskId, to, this.clock());
    }
    return columns;
  });

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
