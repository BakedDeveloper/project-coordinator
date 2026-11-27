import { Injectable, inject } from '@angular/core';

import type { ProjectScope } from './priorities.service';
import { SUPABASE } from './supabase.client';

export type BoardTaskStatus = 'todo' | 'in_progress' | 'on_hold' | 'done' | 'cancelled';

/**
 * One task of the shared board: open (from `v_priorities`), or from `v_tasks` when it has
 * no priority: done recently, on hold (Sospeso) or cancelled (Annullato).
 */
export interface BoardTask {
  id: string;
  title: string;
  nextAction: string | null;
  status: BoardTaskStatus;
  projectId: string;
  projectName: string;
  projectScope: ProjectScope;
  /** `projects.color` (dark, white text on top); null when the project has none. */
  projectColor: string | null;
  /** From `v_priorities`; null for done, on hold and cancelled tasks, which have no priority. */
  priorityRank: number | null;
  /** ISO date (`YYYY-MM-DD`). */
  effectiveDueDate: string | null;
  checkpointName: string | null;
  blocksOthers: boolean;
  isBlocked: boolean;
  isWaiting: boolean;
  hasQuestionToAsk: boolean;
  waitingOn: string | null;
  /** `origin = 'github'`: GitHub decides title and open/closed, the app does not move it. */
  fromGithub: boolean;
  /** ISO timestamp; set only for done tasks. */
  completedAt: string | null;
}

/** A suspended project (`status = 'paused'`): one entry on the board instead of its tasks. */
export interface PausedProject {
  id: string;
  name: string;
  scope: ProjectScope;
  /** `projects.color`; null when the project has none. */
  color: string | null;
  /** Tasks still open (to do, in progress, on hold), waiting for the project to resume. */
  openTasks: number;
}

/** Raised when the board cannot be read. It carries no database data. */
export class BoardUnavailableError extends Error {
  constructor() {
    super('Board unavailable');
    this.name = 'BoardUnavailableError';
  }
}

// Literal strings: supabase-js derives the row types from them.
const OPEN_COLUMNS =
  'id, title, next_action, status, project_id, project_name, project_scope, priority_rank, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, origin';
const PARKED_COLUMNS =
  'id, title, next_action, status, project_id, project_name, project_scope, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, origin';
const DONE_COLUMNS =
  'id, title, next_action, status, project_id, project_name, project_scope, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, origin, completed_at';

/**
 * Reads the shared board: the open tasks of the active projects in `priority_rank` order
 * (computed by the database, never recomputed here), the tasks done since `doneSince`, and
 * every task on hold or cancelled, the most recently changed first.
 */
@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly supabase = inject(SUPABASE);

  async load(doneSince: Date): Promise<BoardTask[]> {
    const [open, done, parked, projects] = await Promise.all([
      this.supabase.from('v_priorities').select(OPEN_COLUMNS).order('priority_rank'),
      this.supabase
        .from('v_tasks')
        .select(DONE_COLUMNS)
        .eq('status', 'done')
        .eq('project_status', 'active')
        .gte('completed_at', doneSince.toISOString())
        .order('completed_at', { ascending: false }),
      this.supabase
        .from('v_tasks')
        .select(PARKED_COLUMNS)
        .in('status', ['on_hold', 'cancelled'])
        .eq('project_status', 'active')
        .order('updated_at', { ascending: false }),
      this.supabase.from('projects').select('id, color'),
    ]).catch(() => {
      throw new BoardUnavailableError();
    });

    if (open.error || done.error || parked.error || projects.error) {
      throw new BoardUnavailableError();
    }

    const colors = new Map(projects.data.map((p) => [p.id, p.color]));
    const tasks: BoardTask[] = [];

    for (const row of open.data) {
      const status = row.status;
      if (
        row.id === null ||
        row.project_id === null ||
        row.priority_rank === null ||
        (status !== 'todo' && status !== 'in_progress') ||
        !isScope(row.project_scope)
      ) {
        continue;
      }
      tasks.push({
        ...common(row, row.id, row.project_id, row.project_scope, colors),
        status,
        priorityRank: row.priority_rank,
        completedAt: null,
      });
    }

    for (const row of done.data) {
      if (
        row.id === null ||
        row.project_id === null ||
        row.completed_at === null ||
        !isScope(row.project_scope)
      ) {
        continue;
      }
      tasks.push({
        ...common(row, row.id, row.project_id, row.project_scope, colors),
        status: 'done',
        priorityRank: null,
        completedAt: row.completed_at,
      });
    }

    for (const row of parked.data) {
      const status = row.status;
      if (
        row.id === null ||
        row.project_id === null ||
        (status !== 'on_hold' && status !== 'cancelled') ||
        !isScope(row.project_scope)
      ) {
        continue;
      }
      tasks.push({
        ...common(row, row.id, row.project_id, row.project_scope, colors),
        status,
        priorityRank: null,
        completedAt: null,
      });
    }

    return tasks;
  }

  /** The suspended projects, by name, with the number of their open tasks. */
  async pausedProjects(): Promise<PausedProject[]> {
    const [projects, tasks] = await Promise.all([
      this.supabase
        .from('projects')
        .select('id, name, scope, color')
        .eq('status', 'paused')
        .order('name'),
      this.supabase
        .from('v_tasks')
        .select('project_id')
        .eq('project_status', 'paused')
        .in('status', ['todo', 'in_progress', 'on_hold']),
    ]).catch(() => {
      throw new BoardUnavailableError();
    });
    if (projects.error || tasks.error) {
      throw new BoardUnavailableError();
    }

    const open = new Map<string, number>();
    for (const row of tasks.data) {
      if (row.project_id !== null) {
        open.set(row.project_id, (open.get(row.project_id) ?? 0) + 1);
      }
    }
    return projects.data.flatMap((p) =>
      isScope(p.scope)
        ? [
            {
              id: p.id,
              name: p.name,
              scope: p.scope,
              color: p.color,
              openTasks: open.get(p.id) ?? 0,
            },
          ]
        : [],
    );
  }
}

interface CommonRow {
  title: string | null;
  next_action: string | null;
  project_name: string | null;
  effective_due_date: string | null;
  checkpoint_name: string | null;
  blocks_others: boolean | null;
  is_blocked: boolean | null;
  is_waiting: boolean | null;
  has_question_to_ask: boolean | null;
  waiting_on: string | null;
  origin: string | null;
}

function common(
  row: CommonRow,
  id: string,
  projectId: string,
  projectScope: ProjectScope,
  colors: ReadonlyMap<string, string | null>,
) {
  return {
    id,
    title: row.title ?? '',
    nextAction: row.next_action,
    projectId,
    projectName: row.project_name ?? '',
    projectScope,
    projectColor: colors.get(projectId) ?? null,
    effectiveDueDate: row.effective_due_date,
    checkpointName: row.checkpoint_name,
    blocksOthers: row.blocks_others ?? false,
    isBlocked: row.is_blocked ?? false,
    isWaiting: row.is_waiting ?? false,
    hasQuestionToAsk: row.has_question_to_ask ?? false,
    waitingOn: row.waiting_on,
    fromGithub: row.origin === 'github',
  };
}

function isScope(value: string | null): value is ProjectScope {
  return value === 'work' || value === 'personal';
}
