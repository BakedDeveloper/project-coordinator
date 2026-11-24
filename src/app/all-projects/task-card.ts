import { Component, computed, input } from '@angular/core';

import type { PriorityTask } from '../data/priorities.service';
import { dueLabel, projectColor, waitingLabel } from './all-projects.model';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.html',
  styleUrl: './task-card.css',
})
export class TaskCard {
  readonly task = input.required<PriorityTask>();
  /** Today as an ISO date, to tell due from overdue. */
  readonly today = input.required<string>();

  protected readonly color = computed(() =>
    projectColor(this.task().projectId, this.task().projectColor),
  );
  protected readonly due = computed(() => dueLabel(this.task().effectiveDueDate, this.today()));
  protected readonly waiting = computed(() => waitingLabel(this.task()));
}
