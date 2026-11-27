import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

/** The statuses a task can be moved to on the board. */
export type MovableStatus = 'todo' | 'in_progress' | 'on_hold' | 'done' | 'cancelled';

/** The statuses a new task can start in. */
export type StartStatus = 'todo' | 'in_progress' | 'on_hold';

export type TaskImpact = 'high' | 'medium' | 'low';

/** A task created from the app: only what Simone fills in. */
export interface NewTask {
  projectId: string;
  title: string;
  status: StartStatus;
  impact: TaskImpact;
  nextAction: string | null;
  /** ISO date (`YYYY-MM-DD`). */
  dueDate: string | null;
}

/** Raised when a task cannot be updated. It carries no database data. */
export class TaskUpdateError extends Error {
  constructor() {
    super('Task update failed');
    this.name = 'TaskUpdateError';
  }
}

/** Raised when a task cannot be deleted. It carries no database data. */
export class TaskDeleteError extends Error {
  constructor() {
    super('Task delete failed');
    this.name = 'TaskDeleteError';
  }
}

/** Raised when a task has logged hours: the database keeps it (time_entries). */
export class TaskHasHoursError extends TaskDeleteError {
  constructor() {
    super();
    this.name = 'TaskHasHoursError';
  }
}

/** Raised when a task cannot be created. It carries no database data. */
export class TaskCreateError extends Error {
  constructor() {
    super('Task create failed');
    this.name = 'TaskCreateError';
  }
}

/**
 * Writes to tasks: the status of a task, new tasks and deletions. The database fills the rest:
 * `id`, `origin = 'coordinator'`, `created_at`, `updated_at`, `completed_at` and
 * `last_changed_by = 'manual'` (CLAUDE.md, "Regole sui dati").
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly supabase = inject(SUPABASE);

  /**
   * Sets the status of a task. GitHub tasks are left alone, even if asked: GitHub decides
   * whether they are open or closed. Fails when no task was changed.
   */
  async setStatus(id: string, status: MovableStatus): Promise<void> {
    const result = await this.supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .neq('origin', 'github')
      .select('id')
      .then(
        (r) => r,
        () => null,
      );
    if (result === null || result.error || result.data.length !== 1) {
      throw new TaskUpdateError();
    }
  }

  /** Creates a task with the fields Simone filled in; returns its id. */
  async create(task: NewTask): Promise<string> {
    const title = task.title.trim();
    if (title === '') {
      throw new TaskCreateError();
    }
    const result = await this.supabase
      .from('tasks')
      .insert({
        project_id: task.projectId,
        title,
        status: task.status,
        impact: task.impact,
        next_action: emptyToNull(task.nextAction),
        due_date: task.dueDate,
      })
      .select('id')
      .single()
      .then(
        (r) => r,
        () => null,
      );
    if (result === null || result.error) {
      throw new TaskCreateError();
    }
    return result.data.id;
  }

  /**
   * Deletes a task for good, with its blocks and waiting items. Never a GitHub task. A task
   * with logged hours stays: the database refuses and this throws TaskHasHoursError.
   */
  async delete(id: string): Promise<void> {
    const result = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .neq('origin', 'github')
      .select('id')
      .then(
        (r) => r,
        () => null,
      );
    if (result?.error?.code === FOREIGN_KEY_VIOLATION) {
      throw new TaskHasHoursError();
    }
    if (result === null || result.error || result.data.length !== 1) {
      throw new TaskDeleteError();
    }
  }
}

/** Postgres foreign_key_violation: here, hours logged on the task. */
const FOREIGN_KEY_VIOLATION = '23503';

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
