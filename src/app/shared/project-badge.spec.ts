import { TestBed } from '@angular/core/testing';

import { BadgeService, type ProjectBadgeData } from '../data/badge.service';
import { ProjectBadge } from './project-badge';

async function render(badge: ProjectBadgeData | null, name = 'Reply - Fleet') {
  const badges = new Map(badge ? [['p1', badge]] : []);
  await TestBed.configureTestingModule({
    imports: [ProjectBadge],
    providers: [{ provide: BadgeService, useValue: { badges: () => Promise.resolve(badges) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectBadge);
  fixture.componentRef.setInput('projectId', 'p1');
  fixture.componentRef.setInput('name', name);
  fixture.componentRef.setInput('color', '#2f5f93');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const SVG = 'data:image/svg+xml;base64,PHN2Zy8+';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const FLEET: ProjectBadgeData = {
  name: 'Reply - Fleet',
  shortName: 'Fleet',
  icon: 'truck',
  logo: SVG,
  clientLogo: PNG,
};

describe('ProjectBadge', () => {
  it('shows the client logo, the project logo, the short name and the full name for screen readers', async () => {
    const element = await render(FLEET);

    const client = element.querySelector<HTMLImageElement>('.badge__client-img')!;
    expect(client.getAttribute('src')).toBe(PNG);
    expect(client.getAttribute('alt')).toBe('');
    const logo = element.querySelector<HTMLImageElement>('.badge__tag .badge__logo-img')!;
    expect(logo.getAttribute('src')).toBe(SVG);
    expect(logo.getAttribute('alt')).toBe('');
    // The project logo replaces the drawn icon.
    expect(element.querySelector('svg.badge__icon')).toBeNull();
    expect(element.querySelector('.badge__name')?.textContent).toBe('Fleet');
    expect(element.querySelector('.badge__name')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.visually-hidden')?.textContent).toBe('Reply - Fleet');
    expect(element.querySelector<HTMLElement>('.badge__tag')!.style.backgroundColor).toBe(
      'rgb(47, 95, 147)',
    );
  });

  it('uses the drawn icon when the project has no logo, and no client tile without a client logo', async () => {
    const element = await render({ ...FLEET, logo: null, clientLogo: null });

    expect(element.querySelector('.badge__client')).toBeNull();
    expect(element.querySelector('.badge__logo')).toBeNull();
    expect(element.querySelector('svg.badge__icon')).not.toBeNull();
    expect(element.querySelector('.badge__initials')).toBeNull();
  });

  it('shows the generic icon, never initials, next to a client logo without project logo or icon', async () => {
    const element = await render({ ...FLEET, logo: null, icon: null });

    expect(element.querySelector('.badge__client-img')).not.toBeNull();
    expect(element.querySelector('.badge__tag svg.badge__icon')).not.toBeNull();
    expect(element.querySelector('.badge__initials')).toBeNull();
    expect(element.querySelector('.badge__name')?.textContent).toBe('Fleet');
  });

  it('shows the full name and the generic icon without logo, short name or known icon', async () => {
    const element = await render({
      ...FLEET,
      shortName: null,
      icon: 'not-an-icon',
      logo: null,
      clientLogo: null,
    });

    expect(element.querySelector('.badge__name')?.textContent).toBe('Reply - Fleet');
    expect(element.querySelector('.badge__name')?.hasAttribute('aria-hidden')).toBe(false);
    expect(element.querySelector('.visually-hidden')).toBeNull();
    expect(element.querySelector('svg.badge__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.badge__initials')).toBeNull();
  });

  it('works without badge data: name and generic icon in the project colour', async () => {
    const element = await render(null, 'Casa');

    expect(element.querySelector('.badge__name')?.textContent).toBe('Casa');
    expect(element.querySelector('svg.badge__icon')).not.toBeNull();
    expect(element.textContent).not.toContain('CA');
  });
});
