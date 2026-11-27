import { TestBed } from '@angular/core/testing';

import { SUPABASE } from './supabase.client';
import { TaskDetailService, TaskDetailUnavailableError } from './task-detail.service';

const ID = '0b7c1f3e-2a4d-4c6e-8f10-1a2b3c4d5e6f';
const OTHER = '1b7c1f3e-2a4d-4c6e-8f10-1a2b3c4d5e6f';
const LATER = '2b7c1f3e-2a4d-4c6e-8f10-1a2b3c4d5e6f';
const PERSON = '3b7c1f3e-2a4d-4c6e-8f10-1a2b3c4d5e6f';

interface Result {
  data: unknown;
  error: unknown;
}

/** A fake query builder per table: records the calls, resolves to the table's result. */
function setup(results: Record<string, Result | 'reject'>) {
  const calls: Record<string, [string, unknown[]][]> = {};
  const from = vi.fn((table: string) => {
    calls[table] ??= [];
    const result = results[table];
    const builder: Record<string, unknown> = {
      then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) =>
        (result === 'reject' ? Promise.reject(new Error('net')) : Promise.resolve(result)).then(
          ok,
          ko,
        ),
    };
    for (const method of ['select', 'eq', 'in', 'is', 'or', 'order', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => {
        calls[table].push([method, args]);
        return builder;
      };
    }
    return builder;
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: TaskDetailService, useClass: TaskDetailService },
      { provide: SUPABASE, useValue: { from } },
    ],
  });
  return { service: TestBed.inject(TaskDetailService), calls, from };
}

const ok = (data: unknown): Result => ({ data, error: null });

const TASK = {
  id: ID,
  title: 'Preparare la demo',
  status: 'todo',
  project_id: 'p1',
  project_name: 'Reply - Fleet',
  origin: 'coordinator',
  next_action: 'Chiedere i dati',
  description: 'Tutto il resto',
  impact: 'high',
  due_date: '2026-12-04',
  effective_due_date: '2026-12-01',
  checkpoint_name: 'Consegna',
};

describe('TaskDetailService', () => {
  it('reads the task with its blocks, open waiting items and logged hours', async () => {
    const { service, calls } = setup({
      v_tasks: ok(TASK),
      blocks: ok([
        { blocking_task_id: OTHER, blocked_task_id: ID, blocked_person_id: null },
        { blocking_task_id: ID, blocked_task_id: LATER, blocked_person_id: null },
        { blocking_task_id: ID, blocked_task_id: null, blocked_person_id: PERSON },
      ]),
      waiting_items: ok([
        {
          person_id: PERSON,
          description: 'I numeri',
          kind: 'material',
          asked_at: '2026-11-20',
          ask_by: null,
        },
      ]),
      time_entries: ok([{ hours: 1.5 }, { hours: '2' }]),
      tasks: ok([
        { id: OTHER, title: 'Avere il contratto', status: 'in_progress' },
        { id: LATER, title: 'Consegnare', status: 'todo' },
      ]),
      people: ok([{ id: PERSON, name: 'Marco' }]),
    });

    const detail = await service.load(ID);

    expect(detail).toMatchObject({
      title: 'Preparare la demo',
      impact: 'high',
      dueDate: '2026-12-04',
      blockedBy: ['Avere il contratto'],
      blocks: ['Consegnare', 'Marco'],
      waiting: [{ person: 'Marco', description: 'I numeri', asked: true }],
      hours: 3.5,
      fromGithub: false,
    });
    expect(calls['waiting_items']).toContainEqual(['is', ['received_at', null]]);
  });

  it('never puts anything but a uuid in the filter', async () => {
    const { service, from } = setup({});

    await expect(service.load('x),id.neq.0')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('fails without details when a read fails', async () => {
    const { service } = setup({
      v_tasks: { data: null, error: { message: 'secret' } },
      blocks: ok([]),
      waiting_items: ok([]),
      time_entries: ok([]),
    });

    const error = await service.load(ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TaskDetailUnavailableError);
    expect(String(error)).not.toContain('secret');
  });
});
