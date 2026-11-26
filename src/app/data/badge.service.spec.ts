import { TestBed } from '@angular/core/testing';

import { BadgeService } from './badge.service';
import { SUPABASE } from './supabase.client';

const SVG = 'data:image/svg+xml;base64,PHN2Zy8+';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const PROJECTS = [
  // Work project: own logo and client logo, both shown.
  { id: 'f', name: 'Reply - Fleet', short_name: 'Fleet', icon: 'truck', logo: SVG, client: 'Enel' },
  // Client without a logo.
  {
    id: 'c',
    name: 'Reply - Tool AI Bandi Gara',
    short_name: null,
    icon: null,
    logo: null,
    client: 'CBI',
  },
  // Client not in the clients table.
  { id: 'x', name: 'Altro', short_name: null, icon: null, logo: null, client: 'Sconosciuto' },
  // Personal project with a value that is not an image data URL.
  {
    id: 'n',
    name: 'Nutrirea',
    short_name: null,
    icon: 'apple',
    logo: 'https://example.com/logo.svg',
    client: null,
  },
];
const CLIENTS = [
  { name: 'Enel', logo: PNG },
  { name: 'CBI', logo: null },
];

function setup(
  tables: Record<string, { data: unknown; error: unknown }> = {
    projects: { data: PROJECTS, error: null },
    clients: { data: CLIENTS, error: null },
  },
) {
  const from = vi.fn((table: string) => ({ select: () => Promise.resolve(tables[table]) }));
  TestBed.configureTestingModule({
    providers: [
      { provide: BadgeService, useClass: BadgeService },
      { provide: SUPABASE, useValue: { from } },
    ],
  });
  return { service: TestBed.inject(BadgeService), from };
}

describe('BadgeService', () => {
  it('gives each project its own logo and its client logo', async () => {
    const { service } = setup();

    const badges = await service.badges();

    expect(badges.get('f')).toEqual({
      name: 'Reply - Fleet',
      shortName: 'Fleet',
      icon: 'truck',
      logo: SVG,
      clientLogo: PNG,
    });
    expect(badges.get('c')).toMatchObject({ logo: null, clientLogo: null });
    expect(badges.get('x')?.clientLogo).toBeNull();
  });

  it('ignores a logo that is not an image data URL', async () => {
    const { service } = setup();

    expect((await service.badges()).get('n')?.logo).toBeNull();
  });

  it('reads once and shares the result, then reads again after 10 minutes', async () => {
    const { service, from } = setup();

    await service.badges(0);
    await service.badges(9 * 60 * 1000);
    expect(from).toHaveBeenCalledTimes(2); // projects and clients, once

    await service.badges(11 * 60 * 1000);
    expect(from).toHaveBeenCalledTimes(4);
  });

  it('fails when the tables cannot be read, and asks again next time', async () => {
    const { service, from } = setup({
      projects: { data: null, error: { message: 'boom' } },
      clients: { data: CLIENTS, error: null },
    });

    await expect(service.badges()).rejects.toThrow('Badges unavailable');
    await expect(service.badges()).rejects.toThrow();
    expect(from).toHaveBeenCalledTimes(4);
  });
});
