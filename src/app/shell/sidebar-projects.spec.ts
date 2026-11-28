import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ProjectService, type ProjectLink } from '../data/project.service';
import { groupProjects } from './projects-menu.model';
import { SidebarProjects } from './sidebar-projects';

const PROJECTS: ProjectLink[] = [
  { id: 'z', name: 'Zeta', scope: 'work', status: 'active', color: '#2f5f93' },
  { id: 'old', name: 'Archivio', scope: 'work', status: 'closed', color: null },
  { id: 'a', name: 'alfa', scope: 'personal', status: 'active', color: null },
  { id: 'p', name: 'Pausa', scope: 'personal', status: 'paused', color: '#7a3b69' },
];

describe('groupProjects', () => {
  it('puts active first, then paused, then closed, by name inside each group', () => {
    expect(groupProjects(PROJECTS).map((g) => [g.label, g.projects.map((p) => p.name)])).toEqual([
      ['Attivi', ['alfa', 'Zeta']],
      ['In pausa', ['Pausa']],
      ['Chiusi', ['Archivio']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupProjects([PROJECTS[0]]).map((g) => g.status)).toEqual(['active']);
  });
});

@Component({ template: '' })
class Blank {}

async function setup(list: () => Promise<ProjectLink[]> = async () => PROJECTS, collapsed = false) {
  const projects = { list: vi.fn(list) };
  await TestBed.configureTestingModule({
    imports: [SidebarProjects],
    providers: [
      provideRouter([{ path: 'progetti/:id', component: Blank }]),
      { provide: ProjectService, useValue: projects },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SidebarProjects);
  fixture.componentRef.setInput('collapsed', collapsed);
  await fixture.whenStable();
  await fixture.whenStable();
  return { fixture, projects, element: fixture.nativeElement as HTMLElement };
}

const links = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>('.projects__link'));

describe('SidebarProjects', () => {
  it('lists the active projects, paused and closed ones folded away', async () => {
    const { element } = await setup();

    expect(
      links(element).map((a) => [
        a.querySelector('.badge__name')?.textContent,
        a.getAttribute('href'),
      ]),
    ).toEqual([
      ['alfa', '/progetti/a'],
      ['Zeta', '/progetti/z'],
      ['Pausa', '/progetti/p'],
      ['Archivio', '/progetti/old'],
    ]);
    const folded = Array.from(element.querySelectorAll('details'));
    expect(
      folded.map((d) => d.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['In pausa 1', 'Chiusi 1']);
    expect(folded.every((d) => !d.open)).toBe(true);
  });

  it('marks the current project with aria-current', async () => {
    const { fixture, element } = await setup();
    await TestBed.inject(Router).navigateByUrl('/progetti/z');
    await fixture.whenStable();

    const current = links(element).filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/progetti/z']);
  });

  it('keeps only the active tiles when reduced, names left to screen readers', async () => {
    const { element } = await setup(undefined, true);

    expect(element.querySelector('details')).toBeNull();
    expect(links(element).map((a) => a.title)).toEqual(['alfa', 'Zeta']);
    expect(element.querySelector('.badge__name')).toBeNull();
    expect(links(element)[0].textContent).toContain('alfa');
  });

  it('shows an error without details and retries', async () => {
    let fail = true;
    const { fixture, element, projects } = await setup(async () => {
      if (fail) throw new Error('secret');
      return PROJECTS;
    });

    expect(element.querySelector('[role="alert"] p')?.textContent).toBe(
      'Non riesco a caricare i progetti.',
    );
    expect(element.textContent).not.toContain('secret');

    fail = false;
    element.querySelector<HTMLButtonElement>('.projects__retry')!.click();
    await fixture.whenStable();
    expect(projects.list).toHaveBeenCalledTimes(2);
    expect(links(element)).toHaveLength(4);
  });

  it('shows only work or personal projects when asked, and remembers it', async () => {
    localStorage.clear();
    const { fixture, element } = await setup();
    const scope = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.projects__scope')).find(
        (b) => b.textContent?.trim() === label,
      )!;
    expect(scope('Tutti').getAttribute('aria-pressed')).toBe('true');

    scope('Lavoro').click();
    await fixture.whenStable();

    expect(scope('Lavoro').getAttribute('aria-pressed')).toBe('true');
    expect(links(element).map((a) => a.getAttribute('href'))).toEqual([
      '/progetti/z',
      '/progetti/old',
    ]);
    expect(localStorage.getItem('coordinator.menuScope')).toBe('work');
    localStorage.clear();
  });
});
