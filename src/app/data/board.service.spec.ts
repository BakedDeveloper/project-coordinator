import { TestBed } from '@angular/core/testing';

import { BoardService, BoardUnavailableError } from './board.service';
import { SUPABASE } from './supabase.client';

interface Result {
  data: unknown[] | null;
  error: unknown;
}

function openRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Scrivere il preventivo',
    next_action: 'Chiedere i numeri a Marco',
    status: 'in_progress',
    project_id: 'p1',
    project_name: 'Reply - Fleet',
    project_scope: 'work',
    priority_rank: 1,
    effective_due_date: '2026-11-26',
    checkpoint_name: 'Consegna',
    blocks_others: true,
    is_blocked: false,
    is_waiting: false,
    has_question_to_ask: false,
    waiting_on: null,
    origin: 'coordinator',
    ...overrides,
  };
}

function doneRow(overrides: Record<string, unknown> = {}) {
  // v_tasks has no priority_rank: the extra key is harmless for the service.
  return {
    ...openRow({ id: 'd1', status: 'done' }),
    completed_at: '2026-11-24T16:00:00+00:00',
    ...overrides,
  };
}

/** A fake supabase-js query builder: records every call, resolves to the given result. */
function query(result: Result | Promise<never>) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

function setup(
  open: Result | Promise<never>,
  done: Result,
  projects: Result,
  parked: Result = { data: [], error: null },
) {
  const queries = {
    v_priorities: query(open),
    v_tasks: query(done),
    parked: query(parked),
    projects: query(projects),
  };
  // v_tasks is read twice: first the done tasks, then the parked ones.
  let vTasksReads = 0;
  const from = vi.fn((table: 'v_priorities' | 'v_tasks' | 'projects') =>
    table === 'v_tasks' && vTasksReads++ > 0 ? queries.parked.builder : queries[table].builder,
  );
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { from } }] });
  return { service: TestBed.inject(BoardService), queries };
}

const COLORS: Result = { data: [{ id: 'p1', color: '#2f5f93' }], error: null };
const SINCE = new Date('2026-11-12T00:00:00Z');

describe('BoardService', () => {
  it('reads open tasks by priority_rank and recent done tasks of active projects', async () => {
    const { service, queries } = setup(
      { data: [openRow()], error: null },
      { data: [doneRow({ origin: 'github' })], error: null },
      COLORS,
    );

    const tasks = await service.load(SINCE);

    expect(queries.v_priorities.calls).toContainEqual(['order', 'priority_rank']);
    expect(queries.v_tasks.calls).toEqual(
      expect.arrayContaining([
        ['eq', 'status', 'done'],
        ['eq', 'project_status', 'active'],
        ['gte', 'completed_at', '2026-11-12T00:00:00.000Z'],
        ['order', 'completed_at', { ascending: false }],
      ]),
    );
    expect(tasks).toEqual([
      expect.objectContaining({
        id: 't1',
        status: 'in_progress',
        priorityRank: 1,
        projectColor: '#2f5f93',
        fromGithub: false,
        completedAt: null,
      }),
      expect.objectContaining({
        id: 'd1',
        status: 'done',
        priorityRank: null,
        fromGithub: true,
        completedAt: '2026-11-24T16:00:00+00:00',
      }),
    ]);
  });

  it('reads every task on hold or cancelled of the active projects, latest change first', async () => {
    const { service, queries } = setup(
      { data: [], error: null },
      { data: [], error: null },
      COLORS,
      {
        data: [
          openRow({ id: 'h1', status: 'on_hold' }),
          openRow({ id: 'c1', status: 'cancelled' }),
          openRow({ id: 'x', status: 'todo' }),
        ],
        error: null,
      },
    );

    const tasks = await service.load(SINCE);

    expect(queries.parked.calls).toEqual(
      expect.arrayContaining([
        ['in', 'status', ['on_hold', 'cancelled']],
        ['eq', 'project_status', 'active'],
        ['order', 'updated_at', { ascending: false }],
      ]),
    );
    expect(tasks.map((t) => [t.id, t.status, t.priorityRank])).toEqual([
      ['h1', 'on_hold', null],
      ['c1', 'cancelled', null],
    ]);
  });

  it('skips rows with missing keys or unknown values', async () => {
    const { service } = setup(
      {
        data: [
          openRow({ id: null }),
          openRow({ id: 'x', status: 'cancelled' }),
          openRow({ id: 'y', project_scope: 'other' }),
          openRow({ id: 'ok' }),
        ],
        error: null,
      },
      { data: [doneRow({ completed_at: null })], error: null },
      COLORS,
    );

    expect((await service.load(SINCE)).map((t) => t.id)).toEqual(['ok']);
  });

  it('fails without details when a query fails or the network is down', async () => {
    const failing = setup(
      { data: null, error: { message: 'boom' } },
      { data: [], error: null },
      COLORS,
    );
    await expect(failing.service.load(SINCE)).rejects.toBeInstanceOf(BoardUnavailableError);

    TestBed.resetTestingModule();
    const offline = setup(
      Promise.reject(new TypeError('Failed to fetch')),
      { data: [], error: null },
      COLORS,
    );
    await expect(offline.service.load(SINCE)).rejects.toBeInstanceOf(BoardUnavailableError);
  });
});
