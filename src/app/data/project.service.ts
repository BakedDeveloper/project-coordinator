import { Injectable, inject } from '@angular/core';

import type { ProjectScope } from './priorities.service';
import { SUPABASE } from './supabase.client';

export type ProjectStatus = 'active' | 'paused' | 'closed';
export type OpenTaskStatus = 'todo' | 'in_progress';

export interface Project {
  id: string;
  name: string;
  scope: ProjectScope;
  status: ProjectStatus;
  /** `projects.color` (dark, white text on top); null when the project has none. */
  color: string | null;
  /** Set only for projects with a plan (today Nutrirea). */
  weeklyHours: number | null;
}

/** One open task of the project, from `v_tasks`. */
export interface ProjectTask {
  id: string;
  title: string;
  nextAction: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  status: OpenTaskStatus;
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
  createdAt: string;
  /** From `v_priorities`: null when the project is not active (no priorities). */
  priorityRank: number | null;
}

/** One entry of the projects menu. */
export interface ProjectLink {
  id: string;
  name: string;
  status: ProjectStatus;
  /** `projects.color`; null when the project has none. */
  color: string | null;
}

export interface Checkpoint {
  id: string;
  name: string;
  /** ISO date (`YYYY-MM-DD`). */
  dueDate: string;
}

/** One task of the project done recently, for the Fatto column of the project board. */
export interface DoneProjectTask extends Omit<ProjectTask, 'status' | 'priorityRank'> {
  status: 'done';
  /** ISO timestamp. */
  completedAt: string;
}

/** One task of the project on hold (Sospeso) or cancelled (Annullato): it has no priority. */
export interface ParkedProjectTask extends Omit<ProjectTask, 'status' | 'priorityRank'> {
  status: 'on_hold' | 'cancelled';
}

export interface ProjectDetail {
  project: Project;
  tasks: ProjectTask[];
  /** Tasks done since the date given to `load`, the most recent first. */
  doneTasks: DoneProjectTask[];
  /** Every task on hold or cancelled, the most recently changed first. */
  parkedTasks: ParkedProjectTask[];
  /** Open checkpoints only (`completed_at is null`), by date. */
  checkpoints: Checkpoint[];
}

/** Raised when the project cannot be read. It carries no database data. */
export class ProjectUnavailableError extends Error {
  constructor() {
    super('Project unavailable');
    this.name = 'ProjectUnavailableError';
  }
}

/** Raised when the status of a project cannot be changed. It carries no database data. */
export class ProjectUpdateError extends Error {
  constructor() {
    super('Project update failed');
    this.name = 'ProjectUpdateError';
  }
}

// Literal strings: supabase-js derives the row types from them.
const PROJECT_COLUMNS = 'id, name, scope, status, color, weekly_hours';
const TASK_COLUMNS =
  'id, title, next_action, status, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, origin, created_at';
const DONE_TASK_COLUMNS =
  'id, title, next_action, status, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, origin, created_at, completed_at';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads one project with its open tasks and checkpoints. Priorities come from the database. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly supabase = inject(SUPABASE);

  /** Every project, any status, by name. */
  /**
   * Suspends (paused) or resumes (active) a project. Only between those two: a closed project
   * stays closed. Writes only the status; the trigger records it as manual.
   */
  async setStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const result = await this.supabase
      .from('projects')
      .update({ status })
      .eq('id', id)
      .in('status', ['active', 'paused'])
      .select('id')
      .then(
        (r) => r,
        () => null,
      );
    if (result === null || result.error || result.data.length !== 1) {
      throw new ProjectUpdateError();
    }
  }

  async list(): Promise<ProjectLink[]> {
    const result = await this.supabase
      .from('projects')
      .select('id, name, status, color')
      .order('name')
      .then(
        (r) => r,
        () => null,
      );
    if (!result || result.error) {
      throw new ProjectUnavailableError();
    }
    return result.data.flatMap((row) =>
      isStatus(row.status)
        ? [{ id: row.id, name: row.name, status: row.status, color: row.color }]
        : [],
    );
  }

  /** The project, or null when no project has this id. Done tasks are read from `doneSince`. */
  async load(id: string, doneSince: Date): Promise<ProjectDetail | null> {
    // Not a uuid: Postgres would reject the filter, and no project can have it.
    if (!UUID.test(id)) {
      return null;
    }

    const [project, tasks, checkpoints, priorities, done, parked] = await Promise.all([
      this.supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle(),
      this.supabase
        .from('v_tasks')
        .select(TASK_COLUMNS)
        .eq('project_id', id)
        .in('status', ['todo', 'in_progress']),
      this.supabase
        .from('checkpoints')
        .select('id, name, due_date')
        .eq('project_id', id)
        .is('completed_at', null)
        .order('due_date'),
      this.supabase.from('v_priorities').select('id, priority_rank').eq('project_id', id),
      this.supabase
        .from('v_tasks')
        .select(DONE_TASK_COLUMNS)
        .eq('project_id', id)
        .eq('status', 'done')
        .gte('completed_at', doneSince.toISOString())
        .order('completed_at', { ascending: false }),
      this.supabase
        .from('v_tasks')
        .select(TASK_COLUMNS)
        .eq('project_id', id)
        .in('status', ['on_hold', 'cancelled'])
        .order('updated_at', { ascending: false }),
    ]).catch(() => {
      throw new ProjectUnavailableError();
    });

    if (
      project.error ||
      tasks.error ||
      checkpoints.error ||
      priorities.error ||
      done.error ||
      parked.error
    ) {
      throw new ProjectUnavailableError();
    }
    if (!project.data || !isScope(project.data.scope) || !isStatus(project.data.status)) {
      return null;
    }

    const p: Project = {
      id: project.data.id,
      name: project.data.name,
      scope: project.data.scope,
      status: project.data.status,
      color: project.data.color,
      weeklyHours: project.data.weekly_hours,
    };

    const ranks = new Map(priorities.data.map((r) => [r.id, r.priority_rank]));
    const projectTasks: ProjectTask[] = [];
    for (const row of tasks.data) {
      if (row.id === null || !isOpenStatus(row.status)) {
        continue;
      }
      projectTasks.push({
        id: row.id,
        title: row.title ?? '',
        nextAction: row.next_action,
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        status: row.status,
        effectiveDueDate: row.effective_due_date,
        checkpointName: row.checkpoint_name,
        blocksOthers: row.blocks_others ?? false,
        isBlocked: row.is_blocked ?? false,
        isWaiting: row.is_waiting ?? false,
        hasQuestionToAsk: row.has_question_to_ask ?? false,
        waitingOn: row.waiting_on,
        fromGithub: row.origin === 'github',
        createdAt: row.created_at ?? '',
        priorityRank: ranks.get(row.id) ?? null,
      });
    }

    const doneTasks: DoneProjectTask[] = [];
    for (const row of done.data) {
      if (row.id === null || !row.completed_at) {
        continue;
      }
      doneTasks.push({
        id: row.id,
        title: row.title ?? '',
        nextAction: row.next_action,
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        status: 'done',
        effectiveDueDate: row.effective_due_date,
        checkpointName: row.checkpoint_name,
        blocksOthers: row.blocks_others ?? false,
        isBlocked: row.is_blocked ?? false,
        isWaiting: row.is_waiting ?? false,
        hasQuestionToAsk: row.has_question_to_ask ?? false,
        waitingOn: row.waiting_on,
        fromGithub: row.origin === 'github',
        createdAt: row.created_at ?? '',
        completedAt: row.completed_at,
      });
    }

    const parkedTasks: ParkedProjectTask[] = [];
    for (const row of parked.data) {
      if (row.id === null || (row.status !== 'on_hold' && row.status !== 'cancelled')) {
        continue;
      }
      parkedTasks.push({
        id: row.id,
        title: row.title ?? '',
        nextAction: row.next_action,
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        status: row.status,
        effectiveDueDate: row.effective_due_date,
        checkpointName: row.checkpoint_name,
        blocksOthers: row.blocks_others ?? false,
        isBlocked: row.is_blocked ?? false,
        isWaiting: row.is_waiting ?? false,
        hasQuestionToAsk: row.has_question_to_ask ?? false,
        waitingOn: row.waiting_on,
        fromGithub: row.origin === 'github',
        createdAt: row.created_at ?? '',
      });
    }

    return {
      project: p,
      tasks: projectTasks,
      doneTasks,
      parkedTasks,
      checkpoints: checkpoints.data.map((c) => ({ id: c.id, name: c.name, dueDate: c.due_date })),
    };
  }
}

function isScope(value: string): value is ProjectScope {
  return value === 'work' || value === 'personal';
}

function isStatus(value: string): value is ProjectStatus {
  return value === 'active' || value === 'paused' || value === 'closed';
}

function isOpenStatus(value: string | null): value is OpenTaskStatus {
  return value === 'todo' || value === 'in_progress';
}
