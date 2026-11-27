import { Component, computed, input, output } from '@angular/core';
import {
  LucideHourglass,
  LucideKeyRound,
  LucideLock,
  LucideMessageCircleQuestionMark,
} from '@lucide/angular';

import {
  dueLabel,
  formatShortDate,
  projectColor,
  toIsoDate,
} from '../all-projects/all-projects.model';
import type { BoardTask } from '../data/board.service';
import { ProjectBadge } from '../shared/project-badge';

/**
 * The compact card of the board (issue #57): project badge, title (two lines at most), date
 * and signal icons, all cards the same height. The whole card is a button that opens the
 * detail popup; dragging stays on the list item around it.
 */
@Component({
  selector: 'app-board-card',
  imports: [
    ProjectBadge,
    LucideHourglass,
    LucideKeyRound,
    LucideLock,
    LucideMessageCircleQuestionMark,
  ],
  templateUrl: './board-card.html',
  styleUrl: './board-card.css',
})
export class BoardCard {
  readonly task = input.required<BoardTask>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project badge. Off on a project board. */
  readonly showProject = input(true);
  /** The status is being written. */
  readonly busy = input(false);
  readonly opened = output<HTMLButtonElement>();

  protected readonly color = computed(() =>
    projectColor(this.task().projectId, this.task().projectColor),
  );
  protected readonly date = computed(() => {
    const task = this.task();
    if (task.completedAt !== null) {
      return {
        text: `fatto il ${formatShortDate(toIsoDate(new Date(task.completedAt)))}`,
        overdue: false,
      };
    }
    return dueLabel(task.effectiveDueDate, this.today());
  });
}
