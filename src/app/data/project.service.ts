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
  createdAt: string;
  /** From `v_priorities`: null when the project is not active (no priorities). */
  priorityRank: number | null;
}

export interface Checkpoint {
  id: string;
  name: string;
  /** ISO date (`YYYY-MM-DD`). */
  dueDate: string;
}

export interface ProjectDetail {
  project: Project;
  tasks: ProjectTask[];
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

// Literal strings: supabase-js derives the row types from them.
const PROJECT_COLUMNS = 'id, name, scope, status, color, weekly_hours';
const TASK_COLUMNS =
  'id, title, next_action, status, effective_due_date, checkpoint_name, blocks_others, is_blocked, is_waiting, has_question_to_ask, waiting_on, created_at';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads one project with its open tasks and checkpoints. Priorities come from the database. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly supabase = inject(SUPABASE);

  /** The project, or null when no project has this id. */
  async load(id: string): Promise<ProjectDetail | null> {
    // Not a uuid: Postgres would reject the filter, and no project can have it.
    if (!UUID.test(id)) {
      return null;
    }

    const [project, tasks, checkpoints, priorities] = await Promise.all([
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
    ]).catch(() => {
      throw new ProjectUnavailableError();
    });

    if (project.error || tasks.error || checkpoints.error || priorities.error) {
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
        createdAt: row.created_at ?? '',
        priorityRank: ranks.get(row.id) ?? null,
      });
    }

    return {
      project: p,
      tasks: projectTasks,
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
