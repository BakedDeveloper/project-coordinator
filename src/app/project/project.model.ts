import type { ProjectScope } from '../data/priorities.service';
import type { Checkpoint, ProjectStatus, ProjectTask } from '../data/project.service';

export type ColumnKey = 'in_progress' | 'todo' | 'blocked';

export const COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: 'in_progress', label: 'In corso' },
  { key: 'todo', label: 'Da fare' },
  { key: 'blocked', label: 'Bloccato' },
];

export const SCOPE_LABELS: Record<ProjectScope, string> = {
  work: 'Lavoro',
  personal: 'Personale',
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Attivo',
  paused: 'In pausa',
  closed: 'Chiuso',
};

export type Cells = Record<ColumnKey, ProjectTask[]>;

/** One line of the page, top to bottom: a date with its tasks, or a horizontal line. */
export type TimelineItem =
  | { kind: 'row'; date: string; cells: Cells }
  | { kind: 'today'; date: string }
  | { kind: 'checkpoint'; date: string; id: string; name: string };

/** A blocked task goes to "Bloccato" whatever its status. */
export function columnOf(task: ProjectTask): ColumnKey {
  if (task.isBlocked) {
    return 'blocked';
  }
  return task.status === 'in_progress' ? 'in_progress' : 'todo';
}

/**
 * The database order (`priority_rank` from `v_priorities`), never recomputed. Tasks
 * without a rank (paused or closed project) follow, by creation.
 */
export function compareByRank(a: ProjectTask, b: ProjectTask): number {
  if (a.priorityRank !== null && b.priorityRank !== null) {
    return a.priorityRank - b.priorityRank;
  }
  if (a.priorityRank !== null) {
    return -1;
  }
  if (b.priorityRank !== null) {
    return 1;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

function compareByDate(a: ProjectTask, b: ProjectTask): number {
  return (a.effectiveDueDate ?? '').localeCompare(b.effectiveDueDate ?? '') || compareByRank(a, b);
}

function emptyCells(): Cells {
  return { in_progress: [], todo: [], blocked: [] };
}

function toCells(tasks: readonly ProjectTask[]): Cells {
  const cells = emptyCells();
  for (const task of tasks) {
    cells[columnOf(task)].push(task);
  }
  return cells;
}

/** Where a line goes on its day: today before that day's tasks, a checkpoint after them. */
const SLOT = { today: 0, row: 1, checkpoint: 2 } as const;

/**
 * The tasks with a date, one row per date, with the lines of today and of the open
 * checkpoints placed between the rows by date. A task due today is below the today line;
 * a task due on the checkpoint day is above the checkpoint line.
 */
export function buildTimeline(
  tasks: readonly ProjectTask[],
  checkpoints: readonly Checkpoint[],
  today: string,
): TimelineItem[] {
  const dated = tasks.filter((t) => t.effectiveDueDate !== null).sort(compareByDate);

  const rows = new Map<string, ProjectTask[]>();
  for (const task of dated) {
    const date = task.effectiveDueDate!;
    rows.set(date, [...(rows.get(date) ?? []), task]);
  }

  const items: TimelineItem[] = [
    ...[...rows].map(([date, dayTasks]): TimelineItem => ({
      kind: 'row',
      date,
      cells: toCells(dayTasks),
    })),
    { kind: 'today', date: today },
    ...checkpoints.map((c): TimelineItem => ({
      kind: 'checkpoint',
      date: c.dueDate,
      id: c.id,
      name: c.name,
    })),
  ];

  // Stable sort: checkpoints on the same day keep the database order.
  return items.sort((a, b) => a.date.localeCompare(b.date) || SLOT[a.kind] - SLOT[b.kind]);
}

/** The tasks without a date, by column, in the database order. */
export function undatedCells(tasks: readonly ProjectTask[]): Cells {
  return toCells(tasks.filter((t) => t.effectiveDueDate === null).sort(compareByRank));
}

/** The first task of "Da fare" in page order: dated ones first, then undated. */
export function nextToStart(tasks: readonly ProjectTask[]): ProjectTask | null {
  const todo = tasks.filter((t) => columnOf(t) === 'todo');
  const dated = todo.filter((t) => t.effectiveDueDate !== null).sort(compareByDate);
  const undated = todo.filter((t) => t.effectiveDueDate === null).sort(compareByRank);
  return dated[0] ?? undated[0] ?? null;
}

export function hasTasks(cells: Cells): boolean {
  return COLUMNS.some((c) => cells[c.key].length > 0);
}
