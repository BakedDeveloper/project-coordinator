import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

/** The statuses a task can be moved to on the board. */
export type MovableStatus = 'todo' | 'in_progress' | 'on_hold' | 'done' | 'cancelled';

/** Raised when a task cannot be updated. It carries no database data. */
export class TaskUpdateError extends Error {
  constructor() {
    super('Task update failed');
    this.name = 'TaskUpdateError';
  }
}

/**
 * Writes to tasks. Only the status: the database triggers fill `completed_at`,
 * `updated_at` and `last_changed_by = 'manual'` (CLAUDE.md, "Regole sui dati").
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
}
