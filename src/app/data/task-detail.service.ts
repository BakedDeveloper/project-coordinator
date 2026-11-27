import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';
import type { TaskImpact } from './task.service';

export type TaskStatus = 'todo' | 'in_progress' | 'on_hold' | 'done' | 'cancelled';

/** An open waiting item of the task: something asked to, or still to ask, a person. */
export interface TaskWaiting {
  person: string;
  description: string;
  /** `question` or `material`. */
  kind: string;
  /** False: the question is still to ask (`asked_at` empty). */
  asked: boolean;
  /** ISO date (`YYYY-MM-DD`) by which to ask; null when none. */
  askBy: string | null;
}

/** Everything the detail popup shows about a task. */
export interface TaskDetail {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
  fromGithub: boolean;
  nextAction: string | null;
  description: string | null;
  impact: TaskImpact;
  /** The task's own due date (`YYYY-MM-DD`), the editable one. */
  dueDate: string | null;
  /** The due date that counts: the task's, or its open checkpoint's. */
  effectiveDueDate: string | null;
  checkpointName: string | null;
  /** Open tasks this task waits for. */
  blockedBy: string[];
  /** Tasks and people this task blocks. */
  blocks: string[];
  /** Open waiting items (`received_at` empty). */
  waiting: TaskWaiting[];
  /** Hours logged on the task. */
  hours: number;
}

/** Raised when the details cannot be read. It carries no database data. */
export class TaskDetailUnavailableError extends Error {
  constructor() {
    super('Task detail unavailable');
    this.name = 'TaskDetailUnavailableError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_COLUMNS =
  'id, title, status, project_id, project_name, origin, next_action, description, impact, due_date, effective_due_date, checkpoint_name';

/** Reads the details of one task for the popup. Read only; writes go through TaskService. */
@Injectable({ providedIn: 'root' })
export class TaskDetailService {
  private readonly supabase = inject(SUPABASE);

  /** The task with its blocks, open waiting items and logged hours; null when it is gone. */
  async load(id: string): Promise<TaskDetail | null> {
    // The id goes into an or() filter: only a uuid, never free text.
    if (!UUID.test(id)) {
      return null;
    }
    const [task, blocks, waiting, hours] = await Promise.all([
      this.supabase.from('v_tasks').select(DETAIL_COLUMNS).eq('id', id).maybeSingle(),
      this.supabase
        .from('blocks')
        .select('blocking_task_id, blocked_task_id, blocked_person_id')
        .or(`blocking_task_id.eq.${id},blocked_task_id.eq.${id}`),
      this.supabase
        .from('waiting_items')
        .select('person_id, description, kind, asked_at, ask_by')
        .eq('task_id', id)
        .is('received_at', null)
        .order('created_at'),
      this.supabase.from('time_entries').select('hours').eq('task_id', id),
    ]).catch(() => {
      throw new TaskDetailUnavailableError();
    });
    if (task.error || blocks.error || waiting.error || hours.error) {
      throw new TaskDetailUnavailableError();
    }
    const row = task.data;
    if (row === null || row.id === null || row.project_id === null || !isStatus(row.status)) {
      return null;
    }

    // Names of the other tasks and of the people, read in one go each.
    const taskIds = new Set<string>();
    const personIds = new Set<string>();
    for (const b of blocks.data) {
      taskIds.add(b.blocking_task_id === id ? (b.blocked_task_id ?? '') : b.blocking_task_id);
      if (b.blocked_person_id !== null) {
        personIds.add(b.blocked_person_id);
      }
    }
    taskIds.delete('');
    for (const w of waiting.data) {
      personIds.add(w.person_id);
    }
    const [tasks, people] = await Promise.all([
      taskIds.size === 0
        ? Promise.resolve({ data: [], error: null })
        : this.supabase
            .from('tasks')
            .select('id, title, status')
            .in('id', [...taskIds]),
      personIds.size === 0
        ? Promise.resolve({ data: [], error: null })
        : this.supabase
            .from('people')
            .select('id, name')
            .in('id', [...personIds]),
    ]).catch(() => {
      throw new TaskDetailUnavailableError();
    });
    if (tasks.error || people.error) {
      throw new TaskDetailUnavailableError();
    }
    const taskById = new Map(tasks.data.map((t) => [t.id, t]));
    const personName = new Map(people.data.map((p) => [p.id, p.name]));

    const blockedBy: string[] = [];
    const blocksOthers: string[] = [];
    for (const b of blocks.data) {
      if (b.blocked_task_id === id) {
        const other = taskById.get(b.blocking_task_id);
        // Only open blockers still block.
        if (other && other.status !== 'done' && other.status !== 'cancelled') {
          blockedBy.push(other.title);
        }
      } else if (b.blocked_task_id !== null) {
        const other = taskById.get(b.blocked_task_id);
        if (other) {
          blocksOthers.push(other.title);
        }
      } else if (b.blocked_person_id !== null) {
        blocksOthers.push(personName.get(b.blocked_person_id) ?? '');
      }
    }

    return {
      id: row.id,
      title: row.title ?? '',
      status: row.status,
      projectId: row.project_id,
      projectName: row.project_name ?? '',
      fromGithub: row.origin === 'github',
      nextAction: row.next_action,
      description: row.description,
      impact: isImpact(row.impact) ? row.impact : 'medium',
      dueDate: row.due_date,
      effectiveDueDate: row.effective_due_date,
      checkpointName: row.checkpoint_name,
      blockedBy,
      blocks: blocksOthers.filter((name) => name !== ''),
      waiting: waiting.data.map((w) => ({
        person: personName.get(w.person_id) ?? '',
        description: w.description,
        kind: w.kind,
        asked: w.asked_at !== null,
        askBy: w.ask_by,
      })),
      hours: hours.data.reduce((sum, h) => sum + Number(h.hours), 0),
    };
  }
}

function isStatus(value: string | null): value is TaskStatus {
  return (
    value === 'todo' ||
    value === 'in_progress' ||
    value === 'on_hold' ||
    value === 'done' ||
    value === 'cancelled'
  );
}

function isImpact(value: string | null): value is TaskImpact {
  return value === 'high' || value === 'medium' || value === 'low';
}
