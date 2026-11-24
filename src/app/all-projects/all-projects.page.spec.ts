import { TestBed } from '@angular/core/testing';

import { PrioritiesService, type PriorityTask } from '../data/priorities.service';
import { CLOCK } from '../shared/clock';
import { task } from '../../testing/priority-task.fixture';
import { AllProjectsPage } from './all-projects.page';

const TASKS: PriorityTask[] = [
  task({
    id: 'a',
    title: 'Lavoro urgente',
    priorityLevel: 1,
    priorityRank: 1,
    projectScope: 'work',
  }),
  task({
    id: 'b',
    title: 'Personale urgente',
    priorityLevel: 1,
    priorityRank: 2,
    projectId: 'p2',
    projectName: 'Nutrirea',
    projectScope: 'personal',
  }),
  task({ id: 'c', title: 'Domanda', priorityLevel: 2, priorityRank: 3, projectScope: 'work' }),
  task({
    id: 'd',
    title: 'Piano 1',
    priorityLevel: 3,
    priorityRank: 4,
    projectId: 'p2',
    projectName: 'Nutrirea',
    projectScope: 'personal',
  }),
  task({
    id: 'e',
    title: 'Piano 2',
    priorityLevel: 3,
    priorityRank: 5,
    projectId: 'p2',
    projectName: 'Nutrirea',
    projectScope: 'personal',
  }),
];

async function setup(load: () => Promise<PriorityTask[]>) {
  const priorities = { load: vi.fn(load) };
  await TestBed.configureTestingModule({
    imports: [AllProjectsPage],
    providers: [
      { provide: PrioritiesService, useValue: priorities },
      { provide: CLOCK, useValue: () => new Date(2026, 10, 24, 9, 0) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AllProjectsPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const click = async (button: HTMLButtonElement) => {
    button.click();
    await fixture.whenStable();
  };
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
  return { fixture, element, priorities, click, button };
}

const headers = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('h2')).map((h) =>
    Array.from(h.children)
      .map((part) => part.textContent?.trim())
      .join(' '),
  );
const titles = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('h3')).map((h) => h.textContent);

describe('AllProjectsPage', () => {
  it('shows a group per level with the rule and the count', async () => {
    const { element } = await setup(async () => TASKS);

    expect(headers(element)).toEqual([
      'Livello 1 Sbloccano altri o scadono entro 7 giorni 2 task',
      'Livello 2 Hanno una domanda ancora da fare 1 task',
      'Livello 3 Il resto, per impatto 2 task',
    ]);
  });

  it('opens levels 1 and 2 in rank order and keeps level 3 collapsed by project', async () => {
    const { element, button } = await setup(async () => TASKS);

    expect(titles(element)).toEqual(['Lavoro urgente', 'Personale urgente', 'Domanda']);
    const summary = button('Nutrirea');
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.textContent).toContain('2 task');
  });

  it('expands and collapses a project of level 3', async () => {
    const { element, button, click } = await setup(async () => TASKS);
    const summary = button('Nutrirea');

    await click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(titles(element)).toEqual([
      'Lavoro urgente',
      'Personale urgente',
      'Domanda',
      'Piano 1',
      'Piano 2',
    ]);
    expect(element.querySelector(`#${summary.getAttribute('aria-controls')}`)).not.toBeNull();

    await click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(titles(element)).not.toContain('Piano 1');
  });

  it('filters by scope with pressed buttons and recounts', async () => {
    const { element, button, click } = await setup(async () => TASKS);
    expect(button('Tutti').getAttribute('aria-pressed')).toBe('true');

    await click(button('Personale'));

    expect(button('Personale').getAttribute('aria-pressed')).toBe('true');
    expect(button('Tutti').getAttribute('aria-pressed')).toBe('false');
    expect(headers(element)).toEqual([
      'Livello 1 Sbloccano altri o scadono entro 7 giorni 1 task',
      'Livello 3 Il resto, per impatto 2 task',
    ]);

    await click(button('Lavoro'));
    expect(titles(element)).toEqual(['Lavoro urgente', 'Domanda']);
  });

  it('passes today to the cards', async () => {
    const { element } = await setup(async () => [
      task({ id: 'x', effectiveDueDate: '2026-11-23' }),
      task({ id: 'y', effectiveDueDate: '2026-11-24' }),
    ]);

    expect(
      Array.from(element.querySelectorAll('.card__due')).map((d) => d.textContent?.trim()),
    ).toEqual(['scaduto il 23 nov', 'scade 24 nov']);
  });

  it('shows a loading state', async () => {
    const { element } = await setup(() => new Promise<PriorityTask[]>(() => undefined));

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Carico le priorità');
  });

  it('says when there is nothing to do', async () => {
    const { element } = await setup(async () => []);

    expect(element.textContent).toContain('Niente da fare.');
    expect(element.querySelector('h2')).toBeNull();
  });

  it('shows an error without details and retries', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    let attempt = 0;
    const { element, priorities, button, click } = await setup(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('secret project detail');
      }
      return TASKS;
    });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Non riesco a caricare le priorità.',
    );
    expect(element.textContent).not.toContain('secret project detail');
    expect(errorSpy).not.toHaveBeenCalled();

    await click(button('Riprova'));

    expect(priorities.load).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(headers(element)).toHaveLength(3);
  });
});
