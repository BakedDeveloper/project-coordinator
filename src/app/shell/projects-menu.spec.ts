import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ProjectService, type ProjectLink } from '../data/project.service';
import { groupProjects } from './projects-menu.model';
import { ProjectsMenu } from './projects-menu';

const PROJECTS: ProjectLink[] = [
  { id: 'z', name: 'Zeta', status: 'active', color: '#2f5f93' },
  { id: 'old', name: 'Archivio', status: 'closed', color: null },
  { id: 'a', name: 'alfa', status: 'active', color: null },
  { id: 'p', name: 'Pausa', status: 'paused', color: '#7a3b69' },
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

async function setup(list: () => Promise<ProjectLink[]> = async () => PROJECTS) {
  const projects = { list: vi.fn(list) };
  await TestBed.configureTestingModule({
    imports: [ProjectsMenu],
    providers: [
      provideRouter([{ path: 'progetti/:id', component: Blank }]),
      { provide: ProjectService, useValue: projects },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectsMenu);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const toggle = element.querySelector<HTMLButtonElement>('.menu__toggle')!;
  const stable = () => fixture.whenStable();
  return { fixture, element, toggle, projects, stable };
}

const links = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>('.menu__link'));

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('ProjectsMenu', () => {
  afterEach(() => {
    document.body.querySelectorAll('app-projects-menu, div[id^="root"]').forEach((e) => e.remove());
  });

  it('is a real button, closed at first', async () => {
    const { element, toggle, projects } = await setup();

    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#projects-menu')).toBeNull();
    expect(projects.list).not.toHaveBeenCalled();
  });

  it('opens with the projects grouped, each linking to its page', async () => {
    const { element, toggle, stable } = await setup();

    toggle.click();
    await stable();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(element.querySelectorAll('.menu__group')).map((g) => g.textContent)).toEqual([
      'Attivi',
      'In pausa',
      'Chiusi',
    ]);
    expect(links(element).map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['alfa', '/progetti/a'],
      ['Zeta', '/progetti/z'],
      ['Pausa', '/progetti/p'],
      ['Archivio', '/progetti/old'],
    ]);
    expect(links(element)[3].classList).toContain('menu__link--closed');
    const tag = links(element)[1].querySelector<HTMLElement>('.menu__tag')!;
    expect(tag.style.backgroundColor).toBe('rgb(47, 95, 147)');
    // The fallback palette for a project without colour.
    expect(
      links(element)[0].querySelector<HTMLElement>('.menu__tag')!.style.backgroundColor,
    ).not.toBe('');
  });

  it('marks the current project with aria-current', async () => {
    const { element, toggle, stable } = await setup();
    await TestBed.inject(Router).navigateByUrl('/progetti/z');

    toggle.click();
    await stable();

    const current = links(element).filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Zeta']);
  });

  it('closes with Escape and gives the focus back to the button', async () => {
    const { element, toggle, stable } = await setup();
    toggle.focus();
    toggle.click();
    await stable();
    links(element)[0].focus();

    pressEscape();
    await stable();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#projects-menu')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('Escape does nothing when it is closed', async () => {
    const { toggle, stable } = await setup();
    const focus = vi.spyOn(toggle, 'focus');

    pressEscape();
    await stable();

    expect(focus).not.toHaveBeenCalled();
  });

  it('closes when the button is pressed again, on a click outside and on a link', async () => {
    const { element, toggle, stable } = await setup();

    toggle.click();
    await stable();
    toggle.click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    await stable();
    document.body.click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    await stable();
    links(element)[0].click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows an error without details and retries', async () => {
    let fail = true;
    const { element, toggle, stable, projects } = await setup(async () => {
      if (fail) throw new Error('secret');
      return PROJECTS;
    });

    toggle.click();
    await stable();
    expect(element.querySelector('[role="alert"] p')?.textContent).toBe(
      'Non riesco a caricare i progetti.',
    );
    expect(element.textContent).not.toContain('secret');

    fail = false;
    element.querySelector<HTMLButtonElement>('.menu__retry')!.click();
    await stable();
    expect(projects.list).toHaveBeenCalledTimes(2);
    expect(links(element)).toHaveLength(4);
  });
});
