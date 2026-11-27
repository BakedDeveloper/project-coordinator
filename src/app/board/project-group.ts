import { Component, computed, input, output } from '@angular/core';

import { projectColor } from '../all-projects/all-projects.model';
import type { TaskGroup } from './board.model';
import { ProjectBadge } from '../shared/project-badge';

/**
 * One card standing for all the tasks of a project in a grouped column: the badge and how
 * many tasks it holds. It is a button that opens and closes the list under it.
 */
@Component({
  selector: 'app-project-group',
  imports: [ProjectBadge],
  templateUrl: './project-group.html',
  styleUrl: './project-group.css',
})
export class ProjectGroup {
  readonly group = input.required<TaskGroup>();
  readonly expanded = input(false);
  readonly toggled = output<void>();

  protected readonly color = computed(() =>
    projectColor(this.group().projectId, this.group().projectColor),
  );
  protected readonly count = computed(() => {
    const n = this.group().tasks.length;
    return n === 1 ? '1 task' : `${n} task`;
  });
}
