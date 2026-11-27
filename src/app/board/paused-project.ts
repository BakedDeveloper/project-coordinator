import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { projectColor } from '../all-projects/all-projects.model';
import type { PausedProject } from '../data/board.service';
import { ProjectBadge } from '../shared/project-badge';

/**
 * A suspended project on the board: one entry at the top of Sospeso instead of its tasks,
 * with a link to the project and the "Riprendi" button.
 */
@Component({
  selector: 'app-paused-project',
  imports: [RouterLink, ProjectBadge],
  templateUrl: './paused-project.html',
  styleUrl: './paused-project.css',
})
export class PausedProjectEntry {
  readonly project = input.required<PausedProject>();
  /** The resume is being written. */
  readonly busy = input(false);
  readonly resumeProject = output<PausedProject>();

  protected readonly color = computed(() => projectColor(this.project().id, this.project().color));
  protected readonly count = computed(() => {
    const n = this.project().openTasks;
    return n === 1 ? '1 task aperto' : `${n} task aperti`;
  });
}
