import type { BoardTask } from '../data/board.service';
import type { BoardColumnKey } from '../data/preferences.service';
import type { ProjectDetail } from '../data/project.service';
import type { ScopeFilter } from '../all-projects/all-projects.model';

export type ColumnKey = BoardColumnKey;

/** The board columns, always in this order (docs/viste.md, "Colonne"). */
export const BOARD_COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: 'todo', label: 'Da fare' },
  { key: 'in_progress', label: 'In corso' },
  { key: 'blocked', label: 'Bloccato' },
  { key: 'on_hold', label: 'Sospeso' },
  { key: 'done', label: 'Fatto' },
  { key: 'cancelled', label: 'Annullato' },
];

/** The columns shown until Simone chooses: all but Annullato. */
export const DEFAULT_VISIBLE_COLUMNS: readonly ColumnKey[] = BOARD_COLUMNS.map((c) => c.key).filter(
  (key) => key !== 'cancelled',
);

/** Fatto shows the tasks completed today and in the 13 days before. */
export const DONE_DAYS = 14;

export interface BoardFilter {
  scope: ScopeFilter;
  /** One project, or null for all of them. */
  projectId: string | null;
}

export interface BoardColumn {
  key: ColumnKey;
  label: string;
  tasks: BoardTask[];
}

export interface ProjectOption {
  id: string;
  name: string;
}

/** Start of the first day shown in Fatto, local time. */
export function doneSince(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DONE_DAYS - 1));
}

/**
 * Done and cancelled tasks go to Fatto and Annullato. Any other blocked task goes to Bloccato,
 * also when it is on hold: it still waits for another task.
 */
export function columnOf(task: BoardTask): ColumnKey {
  if (task.status === 'done' || task.status === 'cancelled') {
    return task.status;
  }
  return task.isBlocked ? 'blocked' : task.status;
}

/** The columns a card can be moved to: Bloccato never, it needs a reason (a block). */
export type TargetColumn = Exclude<ColumnKey, 'blocked'>;

/**
 * Where a task can be moved. GitHub tasks nowhere: GitHub decides their status. A blocked
 * task only to Fatto or Annullato: anywhere else it would stay blocked, so in Bloccato.
 */
export function moveTargets(task: BoardTask): TargetColumn[] {
  if (task.fromGithub) {
    return [];
  }
  const from = columnOf(task);
  if (from === 'blocked') {
    return ['done', 'cancelled'];
  }
  return TARGETS.filter((key) => key !== from);
}

const TARGETS: readonly TargetColumn[] = ['todo', 'in_progress', 'on_hold', 'done', 'cancelled'];

/**
 * The columns with one task moved, while the database is being written: the task goes at
 * the top of Fatto, Sospeso and Annullato (the most recent first) or at the bottom of an open
 * column. The next reload puts it back in `priority_rank` order.
 */
export function withMove(
  columns: readonly BoardColumn[],
  taskId: string,
  to: TargetColumn,
  now: Date,
): BoardColumn[] {
  const task = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
  if (!task) {
    return [...columns];
  }
  const moved: BoardTask =
    to === 'done'
      ? { ...task, status: 'done', completedAt: now.toISOString() }
      : { ...task, status: to, completedAt: null };
  return columns.map((column) => {
    const tasks = column.tasks.filter((t) => t.id !== taskId);
    if (column.key === to) {
      if (to === 'todo' || to === 'in_progress') {
        tasks.push(moved);
      } else {
        tasks.unshift(moved);
      }
    }
    return { ...column, tasks };
  });
}

/**
 * Splits the tasks into the board columns. Open columns follow `priority_rank` from the
 * database; Fatto shows the tasks completed since `since`, the most recent first; Sospeso and
 * Annullato keep the order of the database (latest change first).
 */
export function buildColumns(
  tasks: readonly BoardTask[],
  filter: BoardFilter,
  since: Date,
): BoardColumn[] {
  const visible = tasks.filter(
    (t) =>
      (filter.scope === 'all' || t.projectScope === filter.scope) &&
      (filter.projectId === null || t.projectId === filter.projectId) &&
      (t.status !== 'done' || (t.completedAt !== null && new Date(t.completedAt) >= since)),
  );

  return BOARD_COLUMNS.map(({ key, label }) => {
    const columnTasks = visible.filter((t) => columnOf(t) === key);
    if (key === 'done') {
      columnTasks.sort(byCompletedAtDesc);
    } else if (key !== 'on_hold' && key !== 'cancelled') {
      columnTasks.sort(byPriorityRank);
    }
    return { key, label, tasks: columnTasks };
  });
}

/** The projects that have tasks on the board within the scope, by name. */
export function projectOptions(tasks: readonly BoardTask[], scope: ScopeFilter): ProjectOption[] {
  const byId = new Map<string, string>();
  for (const t of tasks) {
    if (scope === 'all' || t.projectScope === scope) {
      byId.set(t.projectId, t.projectName);
    }
  }
  return [...byId]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/**
 * The tasks of one project as board tasks. A paused or closed project has no priorities:
 * its open tasks come in order of creation (the board keeps that order for equal ranks).
 */
export function projectBoardTasks(detail: ProjectDetail): BoardTask[] {
  const { project } = detail;
  const open = [...detail.tasks]
    .sort(
      (a, b) =>
        (a.priorityRank ?? Number.MAX_SAFE_INTEGER) - (b.priorityRank ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .map((task) => ({ ...task, projectScope: project.scope, completedAt: null }));
  const done = detail.doneTasks.map((task) => ({
    ...task,
    projectScope: project.scope,
    priorityRank: null,
  }));
  const parked = detail.parkedTasks.map((task) => ({
    ...task,
    projectScope: project.scope,
    priorityRank: null,
    completedAt: null,
  }));
  return [...open, ...done, ...parked];
}

function byPriorityRank(a: BoardTask, b: BoardTask): number {
  return (a.priorityRank ?? Number.MAX_SAFE_INTEGER) - (b.priorityRank ?? Number.MAX_SAFE_INTEGER);
}

function byCompletedAtDesc(a: BoardTask, b: BoardTask): number {
  return Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? '');
}
