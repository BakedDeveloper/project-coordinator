import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { dueLabel, projectColor, waitingLabel, type CardTask } from './all-projects.model';

@Component({
  selector: 'app-task-card',
  imports: [RouterLink],
  templateUrl: './task-card.html',
  styleUrl: './task-card.css',
})
export class TaskCard {
  readonly task = input.required<CardTask>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();
  /** The project tag, a link to the project page. Off on the project page itself. */
  readonly showProject = input(true);

  protected readonly color = computed(() =>
    projectColor(this.task().projectId, this.task().projectColor),
  );
  protected readonly due = computed(() => dueLabel(this.task().effectiveDueDate, this.today()));
  protected readonly waiting = computed(() => waitingLabel(this.task()));
}
