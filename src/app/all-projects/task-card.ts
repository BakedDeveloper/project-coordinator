import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProjectBadge } from '../shared/project-badge';

import {
  dueLabel,
  formatShortDate,
  projectColor,
  toIsoDate,
  waitingLabel,
  type CardTask,
} from './all-projects.model';

@Component({
  selector: 'app-task-card',
  imports: [RouterLink, ProjectBadge],
  templateUrl: './task-card.html',
  styleUrl: './task-card.css',
})
export class TaskCard {
  readonly task = input.required<CardTask>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag, a link to the project page. Off on the project page itself. */
  readonly showProject = input(true);
  /** Completion time (ISO) of a done task: the rail shows it instead of the due date. */
  readonly doneAt = input<string | null>(null);

  protected readonly color = computed(() =>
    projectColor(this.task().projectId, this.task().projectColor),
  );
  protected readonly due = computed(() =>
    this.doneAt() === null ? dueLabel(this.task().effectiveDueDate, this.today()) : null,
  );
  protected readonly done = computed(() => {
    const doneAt = this.doneAt();
    return doneAt === null ? null : `fatto il ${formatShortDate(toIsoDate(new Date(doneAt)))}`;
  });
  protected readonly waiting = computed(() => waitingLabel(this.task()));
}
