import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';

import { formatShortDate } from '../all-projects/all-projects.model';
import type { BoardTask } from '../data/board.service';
import { TaskDetailService, type TaskDetail, type TaskStatus } from '../data/task-detail.service';
import { TaskService, type TaskImpact } from '../data/task.service';
import { IMPACTS } from './new-task';
import { BOARD_COLUMNS, moveTargets, type TargetColumn } from './board.model';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Da fare',
  in_progress: 'In corso',
  on_hold: 'Sospeso',
  done: 'Fatto',
  cancelled: 'Annullato',
};
const COLUMN_LABELS = new Map(BOARD_COLUMNS.map((c) => [c.key, c.label]));

/**
 * The detail popup of a task (issue #57): a modal `<dialog>`, full screen on a phone. It reads
 * every detail from the database, edits title (not for GitHub tasks), next action,
 * description, due date and impact, and offers "Sposta in…" and "Elimina". The board does the
 * moving and deleting.
 */
@Component({
  selector: 'app-task-detail-dialog',
  templateUrl: './task-detail-dialog.html',
  styleUrl: './task-detail-dialog.css',
})
export class TaskDetailDialog {
  private readonly details = inject(TaskDetailService);
  private readonly tasks = inject(TaskService);

  /** The card that was opened. */
  readonly task = input<BoardTask | null>(null);
  /** Its column has a priority: Su, Giù and Torna automatico apply. */
  readonly reorderable = input(false);
  readonly canUp = input(false);
  readonly canDown = input(false);
  /** It has an order given by hand. */
  readonly manual = input(false);

  /** The task was saved: the board reads again. */
  readonly saved = output<void>();
  readonly moveTo = output<{ task: BoardTask; to: TargetColumn }>();
  readonly deleteAsked = output<BoardTask>();
  readonly reorder = output<'up' | 'down'>();
  readonly resetRank = output<BoardTask>();
  readonly closed = output<void>();

  protected readonly impacts = IMPACTS;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly detail = signal<TaskDetail | null>(null);

  protected readonly title = signal('');
  protected readonly nextAction = signal('');
  protected readonly description = signal('');
  protected readonly dueDate = signal('');
  protected readonly impact = signal<TaskImpact>('medium');

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Opens the popup and reads the task. */
  open(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    void this.load();
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      return;
    }
    if (typeof dialog.close === 'function') {
      dialog.close(); // fires close, which emits closed
    } else {
      dialog.removeAttribute('open');
      this.closed.emit();
    }
  }

  protected statusLabel(status: TaskStatus): string {
    return STATUS_LABELS[status];
  }

  protected shortDate(iso: string): string {
    return formatShortDate(iso);
  }

  protected targets(): { key: TargetColumn; label: string }[] {
    const task = this.task();
    return task === null
      ? []
      : moveTargets(task).map((key) => ({ key, label: COLUMN_LABELS.get(key) ?? key }));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const detail = this.detail();
    if (detail === null || this.saving()) {
      return;
    }
    if (!detail.fromGithub && this.title().trim() === '') {
      this.error.set('Il titolo non può essere vuoto.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.tasks.update(
        detail.id,
        {
          title: this.title(),
          nextAction: this.nextAction(),
          description: this.description(),
          dueDate: this.dueDate() === '' ? null : this.dueDate(),
          impact: this.impact(),
        },
        detail.fromGithub,
      );
      this.saved.emit();
      this.close();
    } catch {
      // What was typed stays. No details (CLAUDE.md, Sicurezza).
      this.error.set('Non sono riuscito a salvare. Riprova.');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    const task = this.task();
    this.state.set('loading');
    this.detail.set(null);
    this.error.set(null);
    if (task === null) {
      return;
    }
    try {
      const detail = await this.details.load(task.id);
      if (detail === null || this.task()?.id !== task.id) {
        this.state.set('error');
        return;
      }
      this.detail.set(detail);
      this.title.set(detail.title);
      this.nextAction.set(detail.nextAction ?? '');
      this.description.set(detail.description ?? '');
      this.dueDate.set(detail.dueDate ?? '');
      this.impact.set(detail.impact);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
