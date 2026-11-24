import type { PriorityTask } from '../app/data/priorities.service';

/** A priority task for tests: neutral values, override what the test is about. */
export function task(overrides: Partial<PriorityTask> = {}): PriorityTask {
  return {
    id: 't',
    title: 'Task',
    nextAction: null,
    projectId: 'p1',
    projectName: 'Progetto 1',
    projectScope: 'work',
    projectColor: '#2f5f93',
    priorityLevel: 1,
    priorityRank: 1,
    effectiveDueDate: null,
    checkpointName: null,
    blocksOthers: false,
    isBlocked: false,
    isWaiting: false,
    hasQuestionToAsk: false,
    waitingOn: null,
    ...overrides,
  };
}
