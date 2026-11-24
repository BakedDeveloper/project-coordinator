import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

export type ProjectScope = 'work' | 'personal';
export type PriorityLevel = 1 | 2 | 3;

/** One open task of an active project, as `v_priorities` computes it. */
export interface PriorityTask {
  id: string;
  title: string;
  nextAction: string | null;
  projectId: string;
  projectName: string;
  projectScope: ProjectScope;
  /** `projects.color` (dark, white text on top); null when the project has none. */
  projectColor: string | null;
  priorityLevel: PriorityLevel;
  priorityRank: number;
  /** ISO date (`YYYY-MM-DD`). */
  effectiveDueDate: string | null;
  checkpointName: string | null;
  blocksOthers: boolean;
  isBlocked: boolean;
  isWaiting: boolean;
  hasQuestionToAsk: boolean;
  waitingOn: string | null;
}

/** Raised when the priorities cannot be read. It carries no database data. */
export class PrioritiesUnavailableError extends Error {
  constructor() {
    super('Priorities unavailable');
    this.name = 'PrioritiesUnavailableError';
  }
}

// One literal string: supabase-js derives the row type from it.
const PRIORITY_COLUMNS =
  'id, title, next_action, project_id, project_name, project_scope, priority_level, priority_rank, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on';

/**
 * Reads the priorities. The database computes them (`v_priorities`): the app orders by
 * `priority_rank` and recomputes nothing.
 */
@Injectable({ providedIn: 'root' })
export class PrioritiesService {
  private readonly supabase = inject(SUPABASE);

  async load(): Promise<PriorityTask[]> {
    const [priorities, projects] = await Promise.all([
      this.supabase.from('v_priorities').select(PRIORITY_COLUMNS).order('priority_rank'),
      this.supabase.from('projects').select('id, color'),
    ]).catch(() => {
      throw new PrioritiesUnavailableError();
    });

    if (priorities.error || projects.error) {
      throw new PrioritiesUnavailableError();
    }

    const colors = new Map(projects.data.map((p) => [p.id, p.color]));
    const tasks: PriorityTask[] = [];
    for (const row of priorities.data) {
      if (
        row.id === null ||
        row.project_id === null ||
        row.priority_rank === null ||
        !isLevel(row.priority_level) ||
        !isScope(row.project_scope)
      ) {
        continue;
      }
      tasks.push({
        id: row.id,
        title: row.title ?? '',
        nextAction: row.next_action,
        projectId: row.project_id,
        projectName: row.project_name ?? '',
        projectScope: row.project_scope,
        projectColor: colors.get(row.project_id) ?? null,
        priorityLevel: row.priority_level,
        priorityRank: row.priority_rank,
        effectiveDueDate: row.effective_due_date,
        checkpointName: row.checkpoint_name,
        blocksOthers: row.blocks_others ?? false,
        isBlocked: row.is_blocked ?? false,
        isWaiting: row.is_waiting ?? false,
        hasQuestionToAsk: row.has_question_to_ask ?? false,
        waitingOn: row.waiting_on,
      });
    }
    return tasks;
  }
}

function isLevel(value: number | null): value is PriorityLevel {
  return value === 1 || value === 2 || value === 3;
}

function isScope(value: string | null): value is ProjectScope {
  return value === 'work' || value === 'personal';
}
