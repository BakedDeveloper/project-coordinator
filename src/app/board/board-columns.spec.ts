import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { boardTask } from '../../testing/board-task.fixture';
import type { BoardTask } from '../data/board.service';
import { PreferencesService, type BoardColumnKey } from '../data/preferences.service';
import { ProjectService } from '../data/project.service';
import { TaskHasHoursError, TaskService } from '../data/task.service';
import { TaskDetailService, type TaskDetail } from '../data/task-detail.service';
import { CLOCK } from '../shared/clock';
import { BoardColumns } from './board-columns';
import { buildColumns, doneSince } from './board.model';

// 25 November 2026, 9:00 local time.
const NOW = new Date(2026, 10, 25, 9, 0);

interface Preferences {
  loadBoardColumns: () => Promise<BoardColumnKey[] | null>;
  saveBoardColumns: (columns: readonly BoardColumnKey[]) => Promise<void>;
  loadGroupedColumns?: () => Promise<BoardColumnKey[] | null>;
  saveGroupedColumns?: (columns: readonly BoardColumnKey[]) => Promise<void>;
}

async function render(
  tasks: BoardTask[],
  setStatus = vi.fn(() => Promise.resolve()),
  preferences: Preferences = {
    loadBoardColumns: vi.fn(() => Promise.resolve(null)),
    saveBoardColumns: vi.fn(() => Promise.resolve()),
  },
  remove = vi.fn(() => Promise.resolve()),
  setProjectStatus = vi.fn(() => Promise.resolve()),
  setManualRanks = vi.fn(() => Promise.resolve()),
  clearManualRank = vi.fn(() => Promise.resolve()),
) {
  await TestBed.configureTestingModule({
    imports: [BoardColumns],
    providers: [
      provideRouter([]),
      {
        provide: TaskService,
        useValue: { setStatus, delete: remove, setManualRanks, clearManualRank },
      },
      {
        provide: PreferencesService,
        useValue: {
          loadGroupedColumns: () => Promise.resolve(null),
          saveGroupedColumns: () => Promise.resolve(),
          ...preferences,
        },
      },
      { provide: ProjectService, useValue: { setStatus: setProjectStatus } },
      {
        provide: TaskDetailService,
        useValue: {
          load: (id: string) => {
            const task = tasks.find((x) => x.id === id);
            return Promise.resolve(task ? detailOf(task) : null);
          },
        },
      },
      { provide: CLOCK, useValue: () => NOW },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoardColumns);
  fixture.componentRef.setInput(
    'columns',
    buildColumns(tasks, { scope: 'all', projectId: null }, doneSince(NOW)),
  );
  fixture.componentRef.setInput('today', '2026-11-25');
  const moved = vi.fn();
  fixture.componentInstance.moved.subscribe(moved);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  document.body.appendChild(element);
  return {
    fixture,
    element,
    setStatus,
    moved,
    preferences,
    remove,
    setProjectStatus,
    setManualRanks,
    clearManualRank,
  };
}

/** The details the popup reads, made from the card. */
function detailOf(task: BoardTask): TaskDetail {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    projectId: task.projectId,
    projectName: task.projectName,
    fromGithub: task.fromGithub,
    nextAction: task.nextAction,
    description: null,
    impact: 'medium',
    dueDate: null,
    effectiveDueDate: task.effectiveDueDate,
    checkpointName: task.checkpointName,
    blockedBy: [],
    blocks: [],
    waiting: [],
    hours: 0,
  };
}

/** Clicks the card with that title and waits for its popup to read the details. */
async function openCard(
  fixture: { whenStable: () => Promise<unknown> },
  element: HTMLElement,
  title: string,
): Promise<HTMLButtonElement> {
  const card = [...element.querySelectorAll<HTMLButtonElement>('button.card')].find(
    (b) => b.querySelector('.card__title')?.textContent?.trim() === title,
  );
  if (!card) {
    throw new Error(`No card "${title}"`);
  }
  card.click();
  await fixture.whenStable();
  await fixture.whenStable();
  return card;
}

/** A button of the move and delete row of the open popup. */
function detailButton(element: HTMLElement, label: string): HTMLButtonElement {
  const found = [...element.querySelectorAll<HTMLButtonElement>('.detail__move button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!found) {
    throw new Error(`No popup button "${label}"`);
  }
  return found;
}

function shownColumns(element: HTMLElement): string[] {
  return [...element.querySelectorAll<HTMLElement>('.column')].map(
    (c) => c.dataset['column'] ?? '',
  );
}

function checkbox(element: HTMLElement, label: string): HTMLInputElement {
  const found = [...element.querySelectorAll('.columns-menu__option')].find(
    (o) => (o.textContent ?? '').trim() === label,
  );
  if (!found) {
    throw new Error(`No column option "${label}"`);
  }
  return found.querySelector('input')!;
}

function column(element: HTMLElement, key: string): string[] {
  return [...element.querySelectorAll(`[data-column="${key}"] .card__title`)].map(
    (e) => e.textContent ?? '',
  );
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
  const found = [...element.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').trim().startsWith(text),
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found;
}

describe('BoardColumns', () => {
  afterEach(() => document.body.querySelectorAll('app-board-columns').forEach((e) => e.remove()));

  it('deletes a task after a confirmation that names it', async () => {
    const { fixture, element, remove, moved } = await render([
      boardTask({ id: 't1', title: 'Creato per sbaglio' }),
    ]);

    await openCard(fixture, element, 'Creato per sbaglio');
    detailButton(element, 'Elimina').click();
    await fixture.whenStable();
    const dialog = element.querySelector('app-delete-dialog dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('«Creato per sbaglio» sparisce per sempre');
    expect(remove).not.toHaveBeenCalled();

    button(dialog as HTMLElement, 'Elimina per sempre').click();
    await fixture.whenStable();

    expect(remove).toHaveBeenCalledWith('t1');
    expect(column(element, 'todo')).toEqual([]);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('keeps a task with logged hours and offers Annullato instead', async () => {
    const { fixture, element, setStatus } = await render(
      [boardTask({ id: 't1', title: 'Con ore' })],
      undefined,
      undefined,
      vi.fn(() => Promise.reject(new TaskHasHoursError())),
    );

    await openCard(fixture, element, 'Con ore');
    detailButton(element, 'Elimina').click();
    await fixture.whenStable();
    const dialog = element.querySelector<HTMLElement>('app-delete-dialog dialog')!;
    button(dialog, 'Elimina per sempre').click();
    await fixture.whenStable();

    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Ha ore registrate');
    expect(column(element, 'todo')).toEqual(['Con ore']);

    button(dialog, 'Sposta in Annullato').click();
    await fixture.whenStable();
    expect(setStatus).toHaveBeenCalledWith('t1', 'cancelled');
  });

  it('closes the confirmation with Annulla and gives the focus back to the card', async () => {
    const { fixture, element, remove } = await render([boardTask({ id: 't1', title: 'Uno' })]);

    const card = await openCard(fixture, element, 'Uno');
    detailButton(element, 'Elimina').click();
    await fixture.whenStable();
    const dialog = element.querySelector<HTMLElement>('app-delete-dialog dialog')!;
    button(dialog, 'Annulla').click();
    await fixture.whenStable();

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(card);
  });

  it('shows a suspended project at the top of Sospeso and resumes it', async () => {
    const { fixture, element, moved, setProjectStatus } = await render([
      boardTask({ id: 'h1', title: 'Messo da parte', status: 'on_hold', priorityRank: null }),
    ]);
    fixture.componentRef.setInput('pausedProjects', [
      { id: 'p9', name: 'Casa', scope: 'personal', color: null, openTasks: 3 },
    ]);
    await fixture.whenStable();

    const onHold = element.querySelector('[data-column="on_hold"]')!;
    const entry = onHold.querySelector('app-paused-project')!;
    expect(entry.textContent).toContain('Progetto sospeso · 3 task aperti');
    // The entry comes before the tasks of the column.
    expect(
      entry.compareDocumentPosition(onHold.querySelector('.card__title')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    button(entry as HTMLElement, 'Riprendi').click();
    await fixture.whenStable();

    expect(setProjectStatus).toHaveBeenCalledWith('p9', 'active');
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('shows Fatto as one closed card per project by default, in the column order; not the other columns', async () => {
    const { fixture, element } = await render([
      boardTask({ id: 'a', title: 'A1', projectId: 'pa', projectName: 'Alfa' }),
      boardTask({ id: 'b', title: 'B1', projectId: 'pb', projectName: 'Beta', priorityRank: 2 }),
      boardTask({
        id: 'd1',
        title: 'Fatto B',
        projectId: 'pb',
        projectName: 'Beta',
        status: 'done',
        priorityRank: null,
        completedAt: '2026-11-24T16:00:00Z',
      }),
      boardTask({
        id: 'd2',
        title: 'Fatto A',
        projectId: 'pa',
        projectName: 'Alfa',
        status: 'done',
        priorityRank: null,
        completedAt: '2026-11-23T16:00:00Z',
      }),
      boardTask({
        id: 'd3',
        title: 'Fatto B2',
        projectId: 'pb',
        projectName: 'Beta',
        status: 'done',
        priorityRank: null,
        completedAt: '2026-11-20T16:00:00Z',
      }),
    ]);

    const done = element.querySelector('[data-column="done"]')!;
    const groups = [...done.querySelectorAll('.group')].map((g) =>
      (g.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    // Beta has the latest completion: its group comes first, with both its tasks.
    expect(groups).toEqual(['Beta 2 task', 'Alfa 1 task']);
    // One closed card per project: its tasks show only when it is opened.
    expect(column(element, 'done')).toEqual([]);
    const beta = done.querySelector<HTMLButtonElement>('.group')!;
    expect(beta.getAttribute('aria-expanded')).toBe('false');
    beta.click();
    await fixture.whenStable();
    expect(beta.getAttribute('aria-expanded')).toBe('true');
    expect(column(element, 'done')).toEqual(['Fatto B', 'Fatto B2']);
    expect(done.querySelector('.column__group')!.getAttribute('aria-pressed')).toBe('true');

    const todo = element.querySelector('[data-column="todo"]')!;
    expect(todo.querySelector('.group')).toBeNull();
    expect(todo.querySelector('.column__group')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('groups a column on request and saves the choice', async () => {
    const saveGroupedColumns = vi.fn(() => Promise.resolve());
    const { fixture, element } = await render(
      [boardTask({ id: 'a', title: 'A1', projectId: 'pa', projectName: 'Alfa' })],
      undefined,
      {
        loadBoardColumns: () => Promise.resolve(null),
        saveBoardColumns: () => Promise.resolve(),
        loadGroupedColumns: () => Promise.resolve<BoardColumnKey[]>([]),
        saveGroupedColumns,
      },
    );

    const toggle = element.querySelector<HTMLButtonElement>('[data-column="todo"] .column__group')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await fixture.whenStable();

    expect(saveGroupedColumns).toHaveBeenCalledWith(['todo']);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[data-column="todo"] .group')?.textContent).toContain('Alfa');
  });

  it('never groups on a project board', async () => {
    const { fixture, element } = await render([
      boardTask({
        id: 'd',
        status: 'done',
        priorityRank: null,
        completedAt: '2026-11-24T16:00:00Z',
      }),
    ]);
    fixture.componentRef.setInput('showProject', false);
    await fixture.whenStable();

    expect(element.querySelector('.column__group')).toBeNull();
    expect(element.querySelector('.group')).toBeNull();
  });

  it('offers no move to another column and no delete for a GitHub task, and says why', async () => {
    const { fixture, element } = await render([
      boardTask({ id: 'g1', title: 'Da GitHub', fromGithub: true }),
    ]);

    // It drags only to change its place in Da fare: the order is the coordinator's.
    expect(element.querySelector('.item')!.classList).not.toContain('cdk-drag-disabled');
    await openCard(fixture, element, 'Da GitHub');
    expect(element.querySelector('.detail__move')).toBeNull();
    expect(element.querySelector('.field__hint')?.textContent).toContain('GitHub');
    expect(element.querySelector<HTMLInputElement>('.detail input')!.readOnly).toBe(true);
  });

  it('moves a card from its popup and tells the page', async () => {
    const { fixture, element, setStatus, moved } = await render([
      boardTask({ id: 't1', title: 'Preventivo' }),
    ]);

    await openCard(fixture, element, 'Preventivo');
    // Bloccato is never offered, nor the column the card is in.
    const targets = [...element.querySelectorAll('.detail__move button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(targets).toEqual(['In corso', 'Sospeso', 'Fatto', 'Annullato', 'Elimina']);

    detailButton(element, 'In corso').click();
    await fixture.whenStable();

    expect(setStatus).toHaveBeenCalledWith('t1', 'in_progress');
    expect(column(element, 'in_progress')).toEqual(['Preventivo']);
    expect(column(element, 'todo')).toEqual([]);
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('moves a card to Sospeso with status on_hold', async () => {
    const { fixture, element, setStatus } = await render([
      boardTask({ id: 't1', title: 'Preventivo' }),
    ]);

    await openCard(fixture, element, 'Preventivo');
    detailButton(element, 'Sospeso').click();
    await fixture.whenStable();

    expect(setStatus).toHaveBeenCalledWith('t1', 'on_hold');
    expect(column(element, 'on_hold')).toEqual(['Preventivo']);
  });

  it('shows every column but Annullato until a choice is saved', async () => {
    const { fixture, element } = await render([]);

    expect(shownColumns(element)).toEqual(['todo', 'in_progress', 'blocked', 'on_hold', 'done']);
    button(element, 'Colonne').click();
    await fixture.whenStable();
    expect(checkbox(element, 'Annullato').checked).toBe(false);
    expect(checkbox(element, 'Sospeso').checked).toBe(true);
  });

  it('shows the saved columns', async () => {
    const { element } = await render([], undefined, {
      loadBoardColumns: vi.fn(() => Promise.resolve<BoardColumnKey[]>(['todo', 'cancelled'])),
      saveBoardColumns: vi.fn(() => Promise.resolve()),
    });

    expect(shownColumns(element)).toEqual(['todo', 'cancelled']);
  });

  it('saves the choice made in the Colonne menu and keeps one column at least', async () => {
    const saveBoardColumns = vi.fn(() => Promise.resolve());
    const { fixture, element } = await render([], undefined, {
      loadBoardColumns: vi.fn(() => Promise.resolve<BoardColumnKey[]>(['todo', 'done'])),
      saveBoardColumns,
    });

    const trigger = button(element, 'Colonne');
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    checkbox(element, 'Annullato').click();
    await fixture.whenStable();
    expect(saveBoardColumns).toHaveBeenLastCalledWith(['todo', 'done', 'cancelled']);
    expect(shownColumns(element)).toEqual(['todo', 'done', 'cancelled']);

    checkbox(element, 'Da fare').click();
    checkbox(element, 'Fatto').click();
    await fixture.whenStable();
    expect(shownColumns(element)).toEqual(['cancelled']);
    expect(checkbox(element, 'Annullato').disabled).toBe(true);
  });

  it('says so when the column choice cannot be saved', async () => {
    const { fixture, element } = await render([], undefined, {
      loadBoardColumns: vi.fn(() => Promise.resolve(null)),
      saveBoardColumns: vi.fn(() => Promise.reject(new Error('offline'))),
    });

    button(element, 'Colonne').click();
    await fixture.whenStable();
    checkbox(element, 'Annullato').click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Non sono riuscito a salvare la scelta delle colonne',
    );
  });

  it('closes the popup and gives the focus back to the card', async () => {
    const { fixture, element } = await render([boardTask({ id: 't1', title: 'Uno' })]);

    const card = await openCard(fixture, element, 'Uno');
    const popup = element.querySelector('app-task-detail-dialog dialog')!;
    expect(popup.hasAttribute('open')).toBe(true);
    button(popup as HTMLElement, 'Chiudi').click();
    await fixture.whenStable();

    expect(popup.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(card);
  });

  it('puts the card back and shows a message when the write fails', async () => {
    const { fixture, element, moved } = await render(
      [boardTask({ id: 't1', title: 'Preventivo' })],
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    await openCard(fixture, element, 'Preventivo');
    detailButton(element, 'In corso').click();
    await fixture.whenStable();

    expect(column(element, 'todo')).toEqual(['Preventivo']);
    expect(column(element, 'in_progress')).toEqual([]);
    expect(element.querySelector('.move-error')?.textContent).toContain(
      'Non sono riuscito a spostare «Preventivo»',
    );
    expect(moved).not.toHaveBeenCalled();
  });

  it('shows the card already moved while the database is written', async () => {
    let finish: () => void = () => undefined;
    const { fixture, element } = await render(
      [boardTask({ id: 't1', title: 'Preventivo' })],
      vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    );

    await openCard(fixture, element, 'Preventivo');
    detailButton(element, 'In corso').click();
    fixture.detectChanges();

    expect(column(element, 'in_progress')).toEqual(['Preventivo']);
    expect(element.querySelector('.card__date')?.textContent).toContain('Salvo');
    finish();
    await fixture.whenStable();
  });

  it('moves a card up with the keyboard from its popup and saves the new order', async () => {
    const { fixture, element, setManualRanks, moved } = await render([
      boardTask({ id: 'a', title: 'Primo', priorityRank: 1 }),
      boardTask({ id: 'b', title: 'Secondo', priorityRank: 2 }),
    ]);

    await openCard(fixture, element, 'Secondo');
    const order = element.querySelector<HTMLElement>('.detail__order')!;
    expect(button(order, 'Giù').disabled).toBe(true);
    button(order, 'Su').click();
    await fixture.whenStable();

    expect(setManualRanks).toHaveBeenCalledWith(['b', 'a']);
    expect(column(element, 'todo')).toEqual(['Secondo', 'Primo']);
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('gives a card ranked by hand back to the automatic order', async () => {
    const { fixture, element, clearManualRank } = await render([
      boardTask({ id: 'a', title: 'A mano', manualRank: 1 }),
    ]);

    await openCard(fixture, element, 'A mano');
    button(element.querySelector<HTMLElement>('.detail__order')!, 'Torna automatico').click();
    await fixture.whenStable();

    expect(clearManualRank).toHaveBeenCalledWith('a');
  });

  it('puts the old order back when the new one cannot be saved', async () => {
    const { fixture, element } = await render(
      [
        boardTask({ id: 'a', title: 'Primo', priorityRank: 1 }),
        boardTask({ id: 'b', title: 'Secondo', priorityRank: 2 }),
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    await openCard(fixture, element, 'Secondo');
    button(element.querySelector<HTMLElement>('.detail__order')!, 'Su').click();
    await fixture.whenStable();

    expect(column(element, 'todo')).toEqual(['Primo', 'Secondo']);
    expect(element.querySelector('.move-error')?.textContent).toContain('nuovo ordine');
  });

  it('offers no manual order in a column without priority', async () => {
    const { fixture, element } = await render([
      boardTask({ id: 'h', title: 'Sospeso', status: 'on_hold', priorityRank: null }),
    ]);

    await openCard(fixture, element, 'Sospeso');
    expect(element.querySelector('.detail__order')).toBeNull();
  });
});
