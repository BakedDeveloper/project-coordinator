import type { BoardTask } from '../app/data/board.service';

/** A board task for tests: an open task with neutral values, override what the test is about. */
export function boardTask(overrides: Partial<BoardTask> = {}): BoardTask {
  return {
    id: 't',
    title: 'Task',
    nextAction: null,
    status: 'todo',
    projectId: 'p1',
    projectName: 'Progetto 1',
    projectScope: 'work',
    projectColor: '#2f5f93',
    priorityRank: 1,
    effectiveDueDate: null,
    checkpointName: null,
    blocksOthers: false,
    isBlocked: false,
    isWaiting: false,
    hasQuestionToAsk: false,
    waitingOn: null,
    fromGithub: false,
    completedAt: null,
    ...overrides,
  };
}
