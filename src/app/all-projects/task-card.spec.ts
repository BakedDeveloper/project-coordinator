import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PriorityTask } from '../data/priorities.service';
import { task } from '../../testing/priority-task.fixture';
import { TaskCard } from './task-card';

async function render(overrides: Partial<PriorityTask>, today = '2026-11-24', showProject = true) {
  await TestBed.configureTestingModule({
    imports: [TaskCard],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(TaskCard);
  fixture.componentRef.setInput('task', task(overrides));
  fixture.componentRef.setInput('today', today);
  fixture.componentRef.setInput('showProject', showProject);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const labels = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('.label')).map((l) => l.textContent?.trim());

describe('TaskCard', () => {
  it('shows title, next action and the project tag in the project colour', async () => {
    const element = await render({
      title: 'Preparare la demo',
      nextAction: 'Scrivere lo script',
      projectName: 'Reply - Fleet',
      projectColor: '#2f5f93',
    });

    expect(element.querySelector('h3')?.textContent).toBe('Preparare la demo');
    expect(element.querySelector('.card__next')?.textContent).toContain('Scrivere lo script');
    expect(element.querySelector('.card__project .badge__name')?.textContent).toBe('Reply - Fleet');
    const tag = element.querySelector<HTMLElement>('.card__project .badge__tag')!;
    expect(tag.style.backgroundColor).toBe('rgb(47, 95, 147)');
  });

  it('links the project tag to the project page', async () => {
    const element = await render({ projectId: 'p7' });

    const tag = element.querySelector<HTMLAnchorElement>('a.card__project')!;
    expect(tag.getAttribute('href')).toBe('/progetti/p7');
  });

  it('hides the project tag on the project page', async () => {
    const element = await render({}, '2026-11-24', false);

    expect(element.querySelector('.card__project')).toBeNull();
  });

  it('uses the fallback palette when the project has no colour', async () => {
    const element = await render({ projectColor: null });

    expect(
      element.querySelector<HTMLElement>('.card__project .badge__tag')!.style.backgroundColor,
    ).not.toBe('');
  });

  it('hides the next action when there is none', async () => {
    const element = await render({ nextAction: null });

    expect(element.querySelector('.card__next')).toBeNull();
  });

  it('shows the due date and the checkpoint in the rail', async () => {
    const element = await render({ effectiveDueDate: '2026-11-26', checkpointName: 'Consegna' });

    const due = element.querySelector('.card__due')!;
    expect(due.textContent?.trim()).toBe('scade 26 nov');
    expect(due.classList).not.toContain('card__due--overdue');
    expect(element.querySelector('.card__checkpoint')?.textContent).toBe('Consegna');
  });

  it('shows a past date in red as overdue', async () => {
    const element = await render({ effectiveDueDate: '2026-11-20' });

    const due = element.querySelector('.card__due')!;
    expect(due.textContent?.trim()).toBe('scaduto il 20 nov');
    expect(due.classList).toContain('card__due--overdue');
  });

  it('leaves the rail empty without a date or checkpoint', async () => {
    const element = await render({});

    expect(element.querySelector('.card__rail')?.textContent?.trim()).toBe('');
  });

  it.each<[string, Partial<PriorityTask>, string[]]>([
    ['no flags', {}, []],
    ['unblocks others', { blocksOthers: true }, ['sblocca altri']],
    ['blocked', { isBlocked: true }, ['bloccato']],
    [
      'question to ask (also waiting)',
      { hasQuestionToAsk: true, isWaiting: true, waitingOn: 'Marco' },
      ['domanda da fare · Marco'],
    ],
    ['already asked', { isWaiting: true, waitingOn: 'Sara' }, ['aspetta Sara']],
    [
      'everything',
      {
        blocksOthers: true,
        isBlocked: true,
        hasQuestionToAsk: true,
        isWaiting: true,
        waitingOn: 'Marco',
      },
      ['sblocca altri', 'domanda da fare · Marco', 'bloccato'],
    ],
  ])('labels: %s', async (_name, flags, expected) => {
    const element = await render(flags);

    expect(labels(element)).toEqual(expected);
  });

  it('marks a blocked task with the dashed border', async () => {
    expect((await render({ isBlocked: true })).querySelector('.card--blocked')).not.toBeNull();
    TestBed.resetTestingModule();
    expect((await render({})).querySelector('.card--blocked')).toBeNull();
  });
});
