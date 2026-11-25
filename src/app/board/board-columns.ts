import { Component, computed, input, signal } from '@angular/core';

import { TaskCard } from '../all-projects/task-card';
import type { BoardColumn, ColumnKey } from './board.model';

/**
 * The four board columns (docs/viste.md, "Colonne"), shared by the shared board and the
 * project board. On a phone only one column shows, chosen with the column tabs.
 */
@Component({
  selector: 'app-board-columns',
  imports: [TaskCard],
  templateUrl: './board-columns.html',
  styleUrl: './board-columns.css',
})
export class BoardColumns {
  readonly columns = input.required<BoardColumn[]>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag on the cards. Off on a project board. */
  readonly showProject = input(true);

  /** The column shown on a phone, where only one fits. */
  protected readonly current = signal<ColumnKey>('todo');

  /** Shown in an empty In corso: the first task of Da fare. */
  protected readonly nextToStart = computed(
    () => this.columns().find((c) => c.key === 'todo')?.tasks[0] ?? null,
  );
}
