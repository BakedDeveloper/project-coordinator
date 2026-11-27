import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../app.routes';
import { BoardService, type BoardTask, type PausedProject } from '../data/board.service';
import { CLOCK } from '../shared/clock';
import { boardTask } from '../../testing/board-task.fixture';
import { BoardPage } from './board.page';

const TASKS: BoardTask[] = [
  boardTask({ id: 'a', title: 'Preventivo', status: 'todo', priorityRank: 1 }),
  boardTask({
    id: 'b',
    title: 'Spesa',
    status: 'todo',
    priorityRank: 2,
    projectId: 'p2',
    projectName: 'Casa',
    projectScope: 'personal',
  }),
  boardTask({ id: 'c', title: 'Demo', status: 'in_progress', isBlocked: true, priorityRank: 3 }),
  boardTask({
    id: 'd',
    title: 'Contratto',
    status: 'done',
    priorityRank: null,
    completedAt: '2026-11-24T16:00:00+00:00',
  }),
];

async function setup(
  load: () => Promise<BoardTask[]>,
  pausedProjects: () => Promise<PausedProject[]> = () => Promise.resolve([]),
) {
  const board = { load: vi.fn(load), pausedProjects: vi.fn(pausedProjects) };
  await TestBed.configureTestingModule({
    imports: [BoardPage],
    providers: [
      provideRouter([]),
      { provide: BoardService, useValue: board },
      { provide: CLOCK, useValue: () => new Date(2026, 10, 25, 9, 0) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoardPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const click = async (button: HTMLButtonElement) => {
    button.click();
    await fixture.whenStable();
  };
  const button = (text: string, scope: ParentNode = element) =>
    Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
  return { fixture, element, board, click, button };
}

const column = (element: HTMLElement, key: string) =>
  element.querySelector<HTMLElement>(`[data-column="${key}"]`)!;
const titles = (element: HTMLElement, key: string) =>
  Array.from(column(element, key).querySelectorAll('h3')).map((h) => h.textContent);
const header = (element: HTMLElement, key: string) =>
  column(element, key).querySelector('h2')!.textContent!.replace(/\s+/g, ' ').trim();

describe('BoardPage', () => {
  it('is the home page after login', async () => {
    const shell = routes.find((r) => r.path === '' && r.children)!;
    const home = shell.children!.find((r) => r.path === '')!;

    expect(await home.loadComponent!()).toBe(BoardPage);
  });

  it('asks the service for the done tasks of the last 14 days', async () => {
    const { board } = await setup(async () => TASKS);

    expect(board.load).toHaveBeenCalledWith(new Date(2026, 10, 12, 0, 0));
  });

  it('shows the four columns with their counts and a blocked task in Bloccato', async () => {
    const { element } = await setup(async () => TASKS);

    expect(header(element, 'todo')).toBe('Da fare 2 task');
    expect(header(element, 'in_progress')).toBe('In corso 0 task');
    expect(header(element, 'blocked')).toBe('Bloccato 1 task');
    expect(header(element, 'done')).toBe('Fatto 1 task');
    expect(titles(element, 'todo')).toEqual(['Preventivo', 'Spesa']);
    expect(titles(element, 'blocked')).toEqual(['Demo']);
  });

  it('suggests the next task to start when In corso is empty', async () => {
    const { element } = await setup(async () => TASKS);

    expect(column(element, 'in_progress').textContent).toContain(
      'Niente in corso. Il prossimo da iniziare: Preventivo',
    );
  });

  it('says when a column is empty', async () => {
    const { element } = await setup(async () => [boardTask({ status: 'in_progress' })]);

    expect(column(element, 'todo').textContent).toContain('Nessun task.');
  });

  it('shows the completion day on done cards instead of the due date', async () => {
    const { element } = await setup(async () => TASKS);

    expect(column(element, 'done').querySelector('.card__done')?.textContent).toBe(
      'fatto il 24 nov',
    );
  });

  it('filters by scope and by project', async () => {
    const { element, fixture, button, click } = await setup(async () => TASKS);

    await click(button('Personale'));
    expect(button('Personale').getAttribute('aria-pressed')).toBe('true');
    expect(titles(element, 'todo')).toEqual(['Spesa']);

    await click(button('Tutti'));
    const select = element.querySelector<HTMLSelectElement>('.project-filter__select')!;
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      'Tutti i progetti',
      'Casa',
      'Progetto 1',
    ]);
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(titles(element, 'todo')).toEqual(['Spesa']);
    expect(titles(element, 'blocked')).toEqual([]);
  });

  it('resets the project when the scope no longer includes it', async () => {
    const { element, fixture, button, click } = await setup(async () => TASKS);
    const select = element.querySelector<HTMLSelectElement>('.project-filter__select')!;
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    await click(button('Lavoro'));

    expect(titles(element, 'todo')).toEqual(['Preventivo']);
  });

  it('chooses the column shown on a phone with pressed tabs', async () => {
    const { element, button, click } = await setup(async () => TASKS);
    const tabs = element.querySelector<HTMLElement>('.column-tabs')!;

    expect(button('Da fare', tabs).getAttribute('aria-pressed')).toBe('true');
    expect(button('Da fare', tabs).textContent).toContain('2');
    expect(column(element, 'todo').classList).toContain('column--current');

    await click(button('Bloccato', tabs));

    expect(button('Bloccato', tabs).getAttribute('aria-pressed')).toBe('true');
    expect(column(element, 'blocked').classList).toContain('column--current');
    expect(column(element, 'todo').classList).not.toContain('column--current');
  });

  it('shows an error without details and retries', async () => {
    let fail = true;
    const { element, board, button, click } = await setup(async () => {
      if (fail) throw new Error('secret project data');
      return TASKS;
    });

    const alert = element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Non riesco a caricare la board.');
    expect(alert.textContent).not.toContain('secret');

    fail = false;
    await click(button('Riprova'));

    expect(board.load).toHaveBeenCalledTimes(2);
    expect(titles(element, 'todo')).toEqual(['Preventivo', 'Spesa']);
  });
});
