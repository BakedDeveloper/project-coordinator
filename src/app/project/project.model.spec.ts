import { projectTask as task } from '../../testing/project-task.fixture';
import {
  buildTimeline,
  columnOf,
  nextToStart,
  undatedCells,
  type TimelineItem,
} from './project.model';

const TODAY = '2026-11-25';

/** The timeline as short strings: "row 2026-11-20: a,b", "today", "checkpoint X". */
function describeTimeline(items: TimelineItem[]): string[] {
  return items.map((item) => {
    switch (item.kind) {
      case 'row': {
        const ids = [...item.cells.in_progress, ...item.cells.todo, ...item.cells.blocked].map(
          (t) => t.id,
        );
        return `row ${item.date}: ${ids.join(',')}`;
      }
      case 'today':
        return 'today';
      case 'checkpoint':
        return `checkpoint ${item.name}`;
    }
  });
}

describe('columnOf', () => {
  it.each([
    ['todo', false, 'todo'],
    ['in_progress', false, 'in_progress'],
    ['todo', true, 'blocked'],
    ['in_progress', true, 'blocked'],
  ] as const)('%s, blocked %s → %s', (status, isBlocked, column) => {
    expect(columnOf(task({ status, isBlocked }))).toBe(column);
  });
});

describe('buildTimeline', () => {
  it('orders rows by date, ties by priority_rank, and puts each task in its column', () => {
    const items = buildTimeline(
      [
        task({ id: 'late', effectiveDueDate: '2026-12-10', priorityRank: 1 }),
        task({ id: 'b', effectiveDueDate: '2026-12-01', priorityRank: 3 }),
        task({ id: 'a', effectiveDueDate: '2026-12-01', priorityRank: 2 }),
        task({ id: 'blk', effectiveDueDate: '2026-12-01', priorityRank: 1, isBlocked: true }),
        task({ id: 'nodate', priorityRank: 0 }),
      ],
      [],
      TODAY,
    );

    expect(describeTimeline(items)).toEqual([
      'today',
      'row 2026-12-01: a,b,blk',
      'row 2026-12-10: late',
    ]);
    const row = items[1] as Extract<TimelineItem, { kind: 'row' }>;
    expect(row.cells.blocked.map((t) => t.id)).toEqual(['blk']);
    expect(row.cells.todo.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('breaks date ties by creation when there are no priorities', () => {
    const items = buildTimeline(
      [
        task({
          id: 'new',
          effectiveDueDate: '2026-12-01',
          priorityRank: null,
          createdAt: '2026-11-10',
        }),
        task({
          id: 'old',
          effectiveDueDate: '2026-12-01',
          priorityRank: null,
          createdAt: '2026-11-02',
        }),
      ],
      [],
      TODAY,
    );

    expect(describeTimeline(items)).toEqual(['today', 'row 2026-12-01: old,new']);
  });

  it('puts overdue rows above today and rows due today below it', () => {
    const items = buildTimeline(
      [
        task({ id: 'due-today', effectiveDueDate: TODAY }),
        task({ id: 'overdue', effectiveDueDate: '2026-11-20' }),
      ],
      [],
      TODAY,
    );

    expect(describeTimeline(items)).toEqual([
      'row 2026-11-20: overdue',
      'today',
      `row ${TODAY}: due-today`,
    ]);
  });

  it('places checkpoints before, between and after the rows, after the tasks of their day', () => {
    const items = buildTimeline(
      [
        task({ id: 'x', effectiveDueDate: '2026-12-01' }),
        task({ id: 'y', effectiveDueDate: '2026-12-15' }),
      ],
      [
        { id: 'c3', name: 'Dopo', dueDate: '2027-01-10' },
        { id: 'c0', name: 'Scaduto', dueDate: '2026-11-22' },
        { id: 'c1', name: 'Prima', dueDate: '2026-11-28' },
        { id: 'c2', name: 'Stesso giorno', dueDate: '2026-12-15' },
      ],
      TODAY,
    );

    expect(describeTimeline(items)).toEqual([
      'checkpoint Scaduto',
      'today',
      'checkpoint Prima',
      'row 2026-12-01: x',
      'row 2026-12-15: y',
      'checkpoint Stesso giorno',
      'checkpoint Dopo',
    ]);
  });

  it('on the same day: today, then the tasks, then the checkpoint', () => {
    const items = buildTimeline(
      [task({ id: 'z', effectiveDueDate: TODAY })],
      [{ id: 'c', name: 'Oggi', dueDate: TODAY }],
      TODAY,
    );

    expect(describeTimeline(items)).toEqual(['today', `row ${TODAY}: z`, 'checkpoint Oggi']);
  });

  it('shows only the today line when there is nothing dated', () => {
    expect(describeTimeline(buildTimeline([task()], [], TODAY))).toEqual(['today']);
  });
});

describe('undatedCells', () => {
  it('keeps only undated tasks, by priority_rank', () => {
    const cells = undatedCells([
      task({ id: 'c', priorityRank: 3 }),
      task({ id: 'a', priorityRank: 1 }),
      task({ id: 'dated', priorityRank: 0, effectiveDueDate: '2026-12-01' }),
      task({ id: 'b', priorityRank: 2, status: 'in_progress' }),
    ]);

    expect(cells.todo.map((t) => t.id)).toEqual(['a', 'c']);
    expect(cells.in_progress.map((t) => t.id)).toEqual(['b']);
  });

  it('orders by creation when there are no priorities', () => {
    const cells = undatedCells([
      task({ id: 'new', priorityRank: null, createdAt: '2026-11-10' }),
      task({ id: 'old', priorityRank: null, createdAt: '2026-11-02' }),
    ]);

    expect(cells.todo.map((t) => t.id)).toEqual(['old', 'new']);
  });
});

describe('nextToStart', () => {
  it('is the first "Da fare" task: dated first, blocked ones excluded', () => {
    expect(
      nextToStart([
        task({ id: 'undated', priorityRank: 1 }),
        task({ id: 'blocked', effectiveDueDate: '2026-11-26', isBlocked: true }),
        task({ id: 'later', effectiveDueDate: '2026-12-20', priorityRank: 2 }),
        task({ id: 'sooner', effectiveDueDate: '2026-12-02', priorityRank: 3 }),
      ])?.id,
    ).toBe('sooner');
  });

  it('falls back to undated tasks, and to null when there is nothing to start', () => {
    expect(nextToStart([task({ id: 'u' })])?.id).toBe('u');
    expect(nextToStart([task({ isBlocked: true })])).toBeNull();
  });
});
