import type { BoardTask } from '../data/board.service';
import type { ProjectDetail } from '../data/project.service';
import type { ScopeFilter } from '../all-projects/all-projects.model';

export type ColumnKey = 'todo' | 'in_progress' | 'blocked' | 'done';

/** The board columns, always in this order (docs/viste.md, "Colonne"). */
export const BOARD_COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: 'todo', label: 'Da fare' },
  { key: 'in_progress', label: 'In corso' },
  { key: 'blocked', label: 'Bloccato' },
  { key: 'done', label: 'Fatto' },
];

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

/** A blocked open task goes to Bloccato whatever its status; done tasks always go to Fatto. */
export function columnOf(task: BoardTask): ColumnKey {
  if (task.status === 'done') {
    return 'done';
  }
  return task.isBlocked ? 'blocked' : task.status;
}

/**
 * Splits the tasks into the four columns. Open columns follow `priority_rank` from the
 * database; Fatto shows the tasks completed since `since`, the most recent first.
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
    columnTasks.sort(key === 'done' ? byCompletedAtDesc : byPriorityRank);
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
  return [...open, ...done];
}

function byPriorityRank(a: BoardTask, b: BoardTask): number {
  return (a.priorityRank ?? Number.MAX_SAFE_INTEGER) - (b.priorityRank ?? Number.MAX_SAFE_INTEGER);
}

function byCompletedAtDesc(a: BoardTask, b: BoardTask): number {
  return Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? '');
}
