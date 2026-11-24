import { task } from '../../testing/priority-task.fixture';
import {
  FALLBACK_PROJECT_COLORS,
  dueLabel,
  formatShortDate,
  groupByLevel,
  projectColor,
  toIsoDate,
  waitingLabel,
} from './all-projects.model';

function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

describe('groupByLevel', () => {
  const tasks = [
    task({ id: 'a', priorityLevel: 1, priorityRank: 1, projectScope: 'work' }),
    task({ id: 'b', priorityLevel: 1, priorityRank: 2, projectScope: 'personal', projectId: 'p2' }),
    task({ id: 'c', priorityLevel: 2, priorityRank: 3, projectScope: 'work' }),
    task({
      id: 'd',
      priorityLevel: 3,
      priorityRank: 4,
      projectId: 'p2',
      projectName: 'Progetto 2',
      projectScope: 'personal',
    }),
    task({ id: 'e', priorityLevel: 3, priorityRank: 5, projectId: 'p1', projectScope: 'work' }),
    task({
      id: 'f',
      priorityLevel: 3,
      priorityRank: 6,
      projectId: 'p2',
      projectName: 'Progetto 2',
      projectScope: 'personal',
    }),
  ];

  it('groups by level with the rule and the count, keeping the rank order', () => {
    const groups = groupByLevel(tasks, 'all');

    expect(groups.map((g) => [g.level, g.count])).toEqual([
      [1, 2],
      [2, 1],
      [3, 3],
    ]);
    expect(groups[0].rule).toBe('Sbloccano altri o scadono entro 7 giorni');
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('summarizes level 3 by project, in order of each project first task', () => {
    const level3 = groupByLevel(tasks, 'all')[2];

    expect(level3.tasks).toEqual([]);
    expect(level3.projects.map((p) => [p.projectName, p.tasks.map((t) => t.id)])).toEqual([
      ['Progetto 2', ['d', 'f']],
      ['Progetto 1', ['e']],
    ]);
  });

  it('filters by scope and recounts, leaving out empty levels', () => {
    const groups = groupByLevel(tasks, 'personal');

    expect(groups.map((g) => [g.level, g.count])).toEqual([
      [1, 1],
      [3, 2],
    ]);
  });

  it('returns no groups without tasks', () => {
    expect(groupByLevel([], 'all')).toEqual([]);
  });
});

describe('projectColor', () => {
  it('uses the database colour when there is one', () => {
    expect(projectColor('p1', '#a8336a')).toBe('#a8336a');
  });

  it('falls back to a stable colour from the palette', () => {
    const color = projectColor('0b9a3c1e-0000-4000-8000-000000000001', null);

    expect(FALLBACK_PROJECT_COLORS).toContain(color);
    expect(projectColor('0b9a3c1e-0000-4000-8000-000000000001', null)).toBe(color);
  });

  it('keeps white text readable on every fallback colour', () => {
    for (const color of FALLBACK_PROJECT_COLORS) {
      expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('waitingLabel', () => {
  it('shows the question to ask, not the wait', () => {
    expect(
      waitingLabel(task({ hasQuestionToAsk: true, isWaiting: true, waitingOn: 'Marco' })),
    ).toBe('domanda da fare · Marco');
  });

  it('shows the wait when the question was already asked', () => {
    expect(waitingLabel(task({ isWaiting: true, waitingOn: 'Marco, Sara' }))).toBe(
      'aspetta Marco, Sara',
    );
  });

  it('shows nothing without waits', () => {
    expect(waitingLabel(task())).toBeNull();
  });
});

describe('dates', () => {
  it('formats a short Italian date', () => {
    expect(formatShortDate('2026-11-24')).toBe('24 nov');
    expect(formatShortDate('2027-01-03')).toBe('3 gen');
  });

  it('reads today in the local time zone', () => {
    expect(toIsoDate(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
    expect(toIsoDate(new Date(2027, 0, 3, 0, 1))).toBe('2027-01-03');
  });

  it('says when a task is due, today included', () => {
    expect(dueLabel('2026-11-24', '2026-11-24')).toEqual({ text: 'scade 24 nov', overdue: false });
    expect(dueLabel('2026-12-01', '2026-11-24')).toEqual({ text: 'scade 1 dic', overdue: false });
  });

  it('marks a past date as overdue', () => {
    expect(dueLabel('2026-11-23', '2026-11-24')).toEqual({
      text: 'scaduto il 23 nov',
      overdue: true,
    });
  });

  it('shows nothing without a date', () => {
    expect(dueLabel(null, '2026-11-24')).toBeNull();
  });
});
