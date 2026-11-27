import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ProjectService, type ProjectLink } from '../data/project.service';
import { TaskService, type StartStatus, type TaskImpact } from '../data/task.service';

export const START_COLUMNS: readonly { value: StartStatus; label: string }[] = [
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'on_hold', label: 'Sospeso' },
];

export const IMPACTS: readonly { value: TaskImpact; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Bassa' },
];

/**
 * The "Nuovo task" button and its form (docs/viste.md, "Creare un task"). On a project board
 * the project is fixed; on the shared board it is chosen among the active projects.
 */
@Component({
  selector: 'app-new-task',
  templateUrl: './new-task.html',
  styleUrl: './new-task.css',
})
export class NewTask {
  private readonly tasks = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly injector = inject(Injector);

  /** The project of a project board; null on the shared board. */
  readonly projectId = input<string | null>(null);
  /** A task was created: the page reads the board again. */
  readonly created = output<void>();

  protected readonly startColumns = START_COLUMNS;
  protected readonly impacts = IMPACTS;

  protected readonly open = signal(false);
  protected readonly projects = signal<ProjectLink[]>([]);
  protected readonly projectsError = signal(false);

  protected readonly chosenProject = signal('');
  protected readonly title = signal('');
  protected readonly status = signal<StartStatus>('todo');
  protected readonly impact = signal<TaskImpact>('medium');
  protected readonly nextAction = signal('');
  protected readonly dueDate = signal('');

  /** Field errors show only after a first attempt to save. */
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly form = viewChild<ElementRef<HTMLFormElement>>('form');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected titleMissing(): boolean {
    return this.title().trim() === '';
  }

  protected projectMissing(): boolean {
    return this.projectId() === null && this.chosenProject() === '';
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    if (this.projectId() === null && this.projects().length === 0) {
      void this.loadProjects();
    }
    // The first field: the project on the shared board, the title on a project board.
    afterNextRender(
      () => this.form()?.nativeElement.querySelector<HTMLElement>('select, input')?.focus(),
      { injector: this.injector },
    );
  }

  protected close(): void {
    this.open.set(false);
    this.reset();
    this.trigger().nativeElement.focus();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    const projectId = this.projectId() ?? this.chosenProject();
    if (this.titleMissing() || projectId === '' || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.tasks.create({
        projectId,
        title: this.title(),
        status: this.status(),
        impact: this.impact(),
        nextAction: this.nextAction(),
        dueDate: this.dueDate() === '' ? null : this.dueDate(),
      });
      this.created.emit();
      this.close();
    } catch {
      // The form stays filled: nothing typed is lost. No details (CLAUDE.md, Sicurezza).
      this.error.set('Non sono riuscito a creare il task. Riprova.');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const all = await this.projectService.list();
      this.projects.set(all.filter((p) => p.status === 'active'));
      this.projectsError.set(false);
    } catch {
      this.projectsError.set(true);
    }
  }

  private reset(): void {
    this.chosenProject.set('');
    this.title.set('');
    this.status.set('todo');
    this.impact.set('medium');
    this.nextAction.set('');
    this.dueDate.set('');
    this.tried.set(false);
    this.error.set(null);
  }
}
