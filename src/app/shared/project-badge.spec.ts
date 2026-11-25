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

const FLEET: ProjectBadgeData = {
  name: 'Reply - Fleet',
  shortName: 'Fleet',
  icon: 'truck',
  logoUrl: 'https://signed/clients/enel.svg',
};

describe('ProjectBadge', () => {
  it('shows the logo, the short name with its icon, and the full name for screen readers', async () => {
    const element = await render(FLEET);

    const logo = element.querySelector<HTMLImageElement>('.badge__logo-img')!;
    expect(logo.getAttribute('src')).toBe('https://signed/clients/enel.svg');
    expect(logo.getAttribute('alt')).toBe('');
    expect(element.querySelector('.badge__name')?.textContent).toBe('Fleet');
    expect(element.querySelector('.badge__name')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.visually-hidden')?.textContent).toBe('Reply - Fleet');
    expect(element.querySelector('svg.badge__icon')).not.toBeNull();
    expect(element.querySelector('.badge__initials')).toBeNull();
    expect(element.querySelector<HTMLElement>('.badge__tag')!.style.backgroundColor).toBe(
      'rgb(47, 95, 147)',
    );
  });

  it('shows the full name and the initials when there is no short name and no known icon', async () => {
    const element = await render({ ...FLEET, shortName: null, icon: 'not-an-icon', logoUrl: null });

    expect(element.querySelector('.badge__logo')).toBeNull();
    expect(element.querySelector('.badge__name')?.textContent).toBe('Reply - Fleet');
    expect(element.querySelector('.badge__name')?.hasAttribute('aria-hidden')).toBe(false);
    expect(element.querySelector('.visually-hidden')).toBeNull();
    expect(element.querySelector('.badge__initials')?.textContent).toBe('RF');
    expect(element.querySelector('.badge__initials')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('works without badge data: name and initials in the project colour', async () => {
    const element = await render(null, 'Casa');

    expect(element.querySelector('.badge__name')?.textContent).toBe('Casa');
    expect(element.querySelector('.badge__initials')?.textContent).toBe('CA');
  });
});
