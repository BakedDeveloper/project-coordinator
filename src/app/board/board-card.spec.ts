import { TestBed } from '@angular/core/testing';

import { boardTask } from '../../testing/board-task.fixture';
import type { BoardTask } from '../data/board.service';
import { BoardCard } from './board-card';

async function render(
  task: BoardTask,
  showProject = true,
  extra: { showRank?: boolean; clean?: boolean } = {},
) {
  await TestBed.configureTestingModule({ imports: [BoardCard] }).compileComponents();
  const fixture = TestBed.createComponent(BoardCard);
  fixture.componentRef.setInput('task', task);
  fixture.componentRef.setInput('today', '2026-11-25');
  fixture.componentRef.setInput('showProject', showProject);
  fixture.componentRef.setInput('showRank', extra.showRank ?? false);
  fixture.componentRef.setInput('clean', extra.clean ?? false);
  const opened = vi.fn();
  fixture.componentInstance.opened.subscribe(opened);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, opened };
}

describe('BoardCard', () => {
  it('shows only badge, title, date and signals, as one button', async () => {
    const { element, opened } = await render(
      boardTask({
        title: 'Preparare la demo',
        nextAction: 'Chiedere i dati',
        checkpointName: 'Consegna',
        effectiveDueDate: '2026-11-20',
        blocksOthers: true,
        isWaiting: true,
        isBlocked: true,
      }),
    );

    const card = element.querySelector<HTMLButtonElement>('button.card')!;
    expect(element.querySelector('.card__project app-project-badge')).not.toBeNull();
    expect(element.querySelector('.card__title')?.textContent?.trim()).toBe('Preparare la demo');
    expect(element.querySelector('.card__date--overdue')?.textContent).toBe('scaduto il 20 nov');
    // No next action or checkpoint on the card: they are in the popup.
    expect(card.textContent).not.toContain('Chiedere i dati');
    expect(card.textContent).not.toContain('Consegna');
    expect(element.querySelectorAll('svg.signal')).toHaveLength(3);
    expect(card.textContent).toContain('Sblocca altri.');
    expect(card.textContent).toContain('Aspetta qualcuno.');
    expect(card.textContent).toContain('Bloccato.');

    card.click();
    expect(opened).toHaveBeenCalledWith(card);
  });

  it('shows the completion day in Fatto and no badge on a project board', async () => {
    const { element } = await render(
      boardTask({ status: 'done', completedAt: '2026-11-24T16:00:00Z' }),
      false,
    );

    expect(element.querySelector('.card__date')?.textContent).toBe('fatto il 24 nov');
    expect(element.querySelector('.card__project')).toBeNull();
    expect(element.querySelector('.card')!.classList).toContain('card--no-project');
  });

  it('shows the priority number when asked, with its meaning for screen readers', async () => {
    const shown = await render(boardTask({ priorityRank: 3 }), true, { showRank: true });
    expect(shown.element.querySelector('.card__project .card__rank')?.textContent).toBe(
      '#3 in priorità.',
    );

    TestBed.resetTestingModule();
    const hidden = await render(boardTask({ priorityRank: 3 }), true, { showRank: false });
    expect(hidden.element.querySelector('.card__rank')).toBeNull();
  });

  it('puts the number in the foot on a project board, none without a priority', async () => {
    const { element } = await render(boardTask({ priorityRank: 2 }), false, { showRank: true });
    expect(element.querySelector('.card__foot .card__rank')?.textContent).toContain('#2');

    TestBed.resetTestingModule();
    const done = await render(boardTask({ priorityRank: null }), true, { showRank: true });
    expect(done.element.querySelector('.card__rank')).toBeNull();
  });

  it('uses the plain style when asked', async () => {
    const { element } = await render(boardTask(), true, { clean: true });
    expect(element.querySelector('.card')!.classList).toContain('card--clean');
    expect(element.querySelector('.badge')!.classList).toContain('badge--plain');
  });
});
