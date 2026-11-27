import { TestBed } from '@angular/core/testing';

import { SUPABASE } from './supabase.client';
import { TaskService, TaskUpdateError } from './task.service';

interface Result {
  data: unknown[] | null;
  error: unknown;
}

/** A fake supabase-js query builder: records every call, resolves to the given result. */
function setup(result: Result | Promise<never>) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['update', 'eq', 'neq', 'select']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  const from = vi.fn(() => builder);
  TestBed.configureTestingModule({
    providers: [
      { provide: TaskService, useClass: TaskService },
      { provide: SUPABASE, useValue: { from } },
    ],
  });
  return { service: TestBed.inject(TaskService), from, calls };
}

describe('TaskService', () => {
  it('updates the status only, of that task, never of a GitHub task', async () => {
    const { service, from, calls } = setup({ data: [{ id: 't1' }], error: null });

    await service.setStatus('t1', 'in_progress');

    expect(from).toHaveBeenCalledWith('tasks');
    expect(calls).toContainEqual(['update', { status: 'in_progress' }]);
    expect(calls).toContainEqual(['eq', 'id', 't1']);
    expect(calls).toContainEqual(['neq', 'origin', 'github']);
  });

  it('fails when no task changed, e.g. a GitHub task', async () => {
    const { service } = setup({ data: [], error: null });

    await expect(service.setStatus('t1', 'done')).rejects.toBeInstanceOf(TaskUpdateError);
  });

  it('fails without database details on an error or a network failure', async () => {
    const withError = setup({ data: null, error: { message: 'secret detail' } });
    await expect(withError.service.setStatus('t1', 'done')).rejects.toThrow('Task update failed');

    TestBed.resetTestingModule();
    const offline = setup(Promise.reject(new Error('offline')));
    await expect(offline.service.setStatus('t1', 'todo')).rejects.toBeInstanceOf(TaskUpdateError);
  });
});
