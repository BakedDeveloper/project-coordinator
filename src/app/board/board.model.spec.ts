import { boardTask } from '../../testing/board-task.fixture';
import {
  buildColumns,
  columnOf,
  doneSince,
  projectOptions,
  type BoardFilter,
  type ColumnKey,
} from './board.model';

const ALL: BoardFilter = { scope: 'all', projectId: null };
// 25 November 2026, 9:00 local time.
const NOW = new Date(2026, 10, 25, 9, 0);
const SINCE = doneSince(NOW);

const ids = (filter: BoardFilter, tasks = TASKS) =>
  Object.fromEntries(
    buildColumns(tasks, filter, SINCE).map((c) => [c.key, c.tasks.map((t) => t.id)]),
  ) as Record<ColumnKey, string[]>;

const TASKS = [
  boardTask({ id: 'todo-2', status: 'todo', priorityRank: 2 }),
  boardTask({ id: 'todo-1', status: 'todo', priorityRank: 1 }),
  boardTask({ id: 'doing', status: 'in_progress', priorityRank: 3 }),
  boardTask({ id: 'blocked-doing', status: 'in_progress', isBlocked: true, priorityRank: 5 }),
  boardTask({ id: 'blocked-todo', status: 'todo', isBlocked: true, priorityRank: 4 }),
  boardTask({
    id: 'done-old',
    status: 'done',
    priorityRank: null,
    // Half an hour before the first day of Fatto.
    completedAt: new Date(2026, 10, 11, 23, 30).toISOString(),
  }),
  boardTask({
    id: 'done-recent',
    status: 'done',
    priorityRank: null,
    completedAt: '2026-11-24T16:00:00+00:00',
  }),
  boardTask({
    id: 'done-first-day',
    status: 'done',
    priorityRank: null,
    completedAt: new Date(2026, 10, 12, 0, 30).toISOString(),
  }),
];

describe('board model', () => {
  it('starts Fatto 13 days before today, at local midnight', () => {
    expect(doneSince(NOW)).toEqual(new Date(2026, 10, 12, 0, 0));
  });

  it('puts a blocked open task in Bloccato whatever its status', () => {
    expect(columnOf(boardTask({ status: 'in_progress', isBlocked: true }))).toBe('blocked');
    expect(columnOf(boardTask({ status: 'todo', isBlocked: true }))).toBe('blocked');
    expect(columnOf(boardTask({ status: 'in_progress' }))).toBe('in_progress');
    expect(columnOf(boardTask({ status: 'done', isBlocked: true }))).toBe('done');
  });

  it('returns the four columns in order, open ones by priority_rank', () => {
    const columns = buildColumns(TASKS, ALL, SINCE);

    expect(columns.map((c) => c.label)).toEqual(['Da fare', 'In corso', 'Bloccato', 'Fatto']);
    expect(ids(ALL)).toMatchObject({
      todo: ['todo-1', 'todo-2'],
      in_progress: ['doing'],
      blocked: ['blocked-todo', 'blocked-doing'],
    });
  });

  it('shows in Fatto only the last 14 days, the most recent first', () => {
    expect(ids(ALL).done).toEqual(['done-recent', 'done-first-day']);
  });

  it('filters by scope and by project', () => {
    const tasks = [
      boardTask({ id: 'w1', projectId: 'p1', projectScope: 'work', priorityRank: 1 }),
      boardTask({ id: 'w2', projectId: 'p2', projectScope: 'work', priorityRank: 2 }),
      boardTask({ id: 'p', projectId: 'p3', projectScope: 'personal', priorityRank: 3 }),
    ];

    expect(ids({ scope: 'work', projectId: null }, tasks).todo).toEqual(['w1', 'w2']);
    expect(ids({ scope: 'personal', projectId: null }, tasks).todo).toEqual(['p']);
    expect(ids({ scope: 'all', projectId: 'p2' }, tasks).todo).toEqual(['w2']);
    expect(ids({ scope: 'personal', projectId: 'p2' }, tasks).todo).toEqual([]);
  });

  it('lists the projects of the scope once each, by name', () => {
    const tasks = [
      boardTask({ projectId: 'p2', projectName: 'Reply - Fleet', projectScope: 'work' }),
      boardTask({ projectId: 'p1', projectName: 'Acquisto notebook', projectScope: 'personal' }),
      boardTask({ projectId: 'p2', projectName: 'Reply - Fleet', projectScope: 'work' }),
    ];

    expect(projectOptions(tasks, 'all')).toEqual([
      { id: 'p1', name: 'Acquisto notebook' },
      { id: 'p2', name: 'Reply - Fleet' },
    ]);
    expect(projectOptions(tasks, 'work')).toEqual([{ id: 'p2', name: 'Reply - Fleet' }]);
  });
});
