import { boardTask } from '../../testing/board-task.fixture';
import { doneProjectTask, projectTask } from '../../testing/project-task.fixture';
import {
  DEFAULT_VISIBLE_COLUMNS,
  buildColumns,
  columnOf,
  doneSince,
  moveTargets,
  projectBoardTasks,
  projectOptions,
  withMove,
  type BoardColumn,
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

const columnIds = (columns: BoardColumn[]) =>
  Object.fromEntries(columns.map((c) => [c.key, c.tasks.map((t) => t.id)])) as Record<
    ColumnKey,
    string[]
  >;

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

  it('puts on hold tasks in Sospeso, unless blocked, and cancelled ones in Annullato', () => {
    expect(columnOf(boardTask({ status: 'on_hold' }))).toBe('on_hold');
    expect(columnOf(boardTask({ status: 'on_hold', isBlocked: true }))).toBe('blocked');
    expect(columnOf(boardTask({ status: 'cancelled', isBlocked: true }))).toBe('cancelled');
    // Waiting for someone is a label, not a column.
    expect(columnOf(boardTask({ status: 'todo', isWaiting: true }))).toBe('todo');
  });

  it('shows every column but Annullato until Simone chooses', () => {
    expect(DEFAULT_VISIBLE_COLUMNS).toEqual(['todo', 'in_progress', 'blocked', 'on_hold', 'done']);
  });

  it('returns the six columns in order, open ones by priority_rank', () => {
    const columns = buildColumns(TASKS, ALL, SINCE);

    expect(columns.map((c) => c.label)).toEqual([
      'Da fare',
      'In corso',
      'Bloccato',
      'Sospeso',
      'Fatto',
      'Annullato',
    ]);
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

  it('turns a project into board tasks: by rank, then by creation, with the done ones', () => {
    const project = {
      id: 'p1',
      name: 'Casa',
      scope: 'personal' as const,
      status: 'paused' as const,
      color: null,
      weeklyHours: null,
    };
    const tasks = projectBoardTasks({
      project,
      checkpoints: [],
      tasks: [
        projectTask({ id: 'late', priorityRank: null, createdAt: '2026-11-20T09:00:00Z' }),
        projectTask({ id: 'early', priorityRank: null, createdAt: '2026-11-02T09:00:00Z' }),
        projectTask({ id: 'ranked', priorityRank: 7 }),
      ],
      doneTasks: [doneProjectTask({ id: 'done', completedAt: '2026-11-24T16:00:00Z' })],
      parkedTasks: [{ ...projectTask({ id: 'held' }), status: 'on_hold' }],
    });

    expect(tasks.map((t) => t.id)).toEqual(['ranked', 'early', 'late', 'done', 'held']);
    expect(tasks[4]).toMatchObject({ status: 'on_hold', priorityRank: null, completedAt: null });
    expect(tasks.every((t) => t.projectScope === 'personal')).toBe(true);
    expect(tasks[3]).toMatchObject({
      status: 'done',
      priorityRank: null,
      completedAt: '2026-11-24T16:00:00Z',
    });
    expect(tasks[0].completedAt).toBeNull();
  });

  it('moves a task to the other columns, never to Bloccato', () => {
    expect(moveTargets(boardTask({ status: 'todo' }))).toEqual([
      'in_progress',
      'on_hold',
      'done',
      'cancelled',
    ]);
    expect(moveTargets(boardTask({ status: 'on_hold' }))).toEqual([
      'todo',
      'in_progress',
      'done',
      'cancelled',
    ]);
    expect(moveTargets(boardTask({ status: 'cancelled' }))).toEqual([
      'todo',
      'in_progress',
      'on_hold',
      'done',
    ]);
  });

  it('moves a blocked task only to Fatto or Annullato: elsewhere it would stay blocked', () => {
    expect(moveTargets(boardTask({ status: 'in_progress', isBlocked: true }))).toEqual([
      'done',
      'cancelled',
    ]);
  });

  it('keeps Sospeso and Annullato in the database order, the latest change first', () => {
    const columns = buildColumns(
      [
        boardTask({ id: 'h2', status: 'on_hold', priorityRank: null }),
        boardTask({ id: 'h1', status: 'on_hold', priorityRank: null }),
        boardTask({ id: 'c1', status: 'cancelled', priorityRank: null }),
      ],
      ALL,
      SINCE,
    );
    expect(columnIds(columns)).toMatchObject({ on_hold: ['h2', 'h1'], cancelled: ['c1'] });
  });

  it('never moves a GitHub task', () => {
    expect(moveTargets(boardTask({ fromGithub: true }))).toEqual([]);
    expect(moveTargets(boardTask({ fromGithub: true, isBlocked: true }))).toEqual([]);
  });

  it('shows a moving task at the bottom of an open column, or at the top of Fatto', () => {
    const columns = buildColumns(
      [
        boardTask({ id: 'a', priorityRank: 1 }),
        boardTask({ id: 'b', priorityRank: 2, status: 'in_progress' }),
        boardTask({
          id: 'd',
          status: 'done',
          priorityRank: null,
          completedAt: '2026-11-24T16:00:00Z',
        }),
      ],
      ALL,
      doneSince(NOW),
    );

    const toProgress = withMove(columns, 'a', 'in_progress', NOW);
    expect(columnIds(toProgress)).toEqual({
      todo: [],
      in_progress: ['b', 'a'],
      blocked: [],
      on_hold: [],
      done: ['d'],
      cancelled: [],
    });
    expect(toProgress[1].tasks[1]).toMatchObject({ status: 'in_progress', completedAt: null });

    const toDone = withMove(columns, 'b', 'done', NOW);
    expect(columnIds(toDone).done).toEqual(['b', 'd']);
    expect(toDone[4].tasks[0]).toMatchObject({ status: 'done', completedAt: NOW.toISOString() });

    const toHold = withMove(columns, 'a', 'on_hold', NOW);
    expect(columnIds(toHold).on_hold).toEqual(['a']);
    expect(toHold[3].tasks[0]).toMatchObject({ status: 'on_hold', completedAt: null });

    expect(withMove(columns, 'missing', 'done', NOW)).toEqual(columns);
  });
});
