import { TestBed } from '@angular/core/testing';

import { BadgeService } from './badge.service';
import { SUPABASE } from './supabase.client';

const PROJECTS = [
  // Own logo: wins over the client logo.
  {
    id: 'n',
    name: 'Nutrirea',
    short_name: null,
    icon: 'apple',
    logo_path: 'projects/nutrirea.svg',
    client: null,
  },
  // Client logo.
  {
    id: 'f',
    name: 'Reply - Fleet',
    short_name: 'Fleet',
    icon: 'truck',
    logo_path: null,
    client: 'Enel',
  },
  // Client without a logo.
  {
    id: 'c',
    name: 'Reply - Tool AI Bandi Gara',
    short_name: null,
    icon: null,
    logo_path: null,
    client: 'CBI',
  },
  // Client not in the clients table.
  { id: 'x', name: 'Altro', short_name: null, icon: null, logo_path: null, client: 'Sconosciuto' },
];
const CLIENTS = [
  { name: 'Enel', logo_path: 'clients/enel.svg' },
  { name: 'CBI', logo_path: null },
];

function setup(
  sign: (paths: string[]) => Promise<{ data: unknown[] | null; error: unknown }> = async (
    paths,
  ) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
    error: null,
  }),
  tables: Record<string, { data: unknown; error: unknown }> = {
    projects: { data: PROJECTS, error: null },
    clients: { data: CLIENTS, error: null },
  },
) {
  const select = vi.fn();
  const from = vi.fn((table: string) => ({
    select: () => (select(table), Promise.resolve(tables[table])),
  }));
  const createSignedUrls = vi.fn(sign);
  const storageFrom = vi.fn(() => ({ createSignedUrls }));
  TestBed.configureTestingModule({
    providers: [
      { provide: BadgeService, useClass: BadgeService },
      { provide: SUPABASE, useValue: { from, storage: { from: storageFrom } } },
    ],
  });
  return { service: TestBed.inject(BadgeService), from, storageFrom, createSignedUrls };
}

describe('BadgeService', () => {
  it('uses the project logo, else the client logo, through signed URLs of the private bucket', async () => {
    const { service, storageFrom, createSignedUrls } = setup();

    const badges = await service.badges();

    expect(storageFrom).toHaveBeenCalledWith('logos');
    expect(createSignedUrls).toHaveBeenCalledWith(
      ['projects/nutrirea.svg', 'clients/enel.svg'],
      3600,
    );
    expect(badges.get('n')).toEqual({
      name: 'Nutrirea',
      shortName: null,
      icon: 'apple',
      logoUrl: 'https://signed/projects/nutrirea.svg',
    });
    expect(badges.get('f')).toEqual({
      name: 'Reply - Fleet',
      shortName: 'Fleet',
      icon: 'truck',
      logoUrl: 'https://signed/clients/enel.svg',
    });
    expect(badges.get('c')?.logoUrl).toBeNull();
    expect(badges.get('x')?.logoUrl).toBeNull();
  });

  it('keeps the badges without logos when the URLs cannot be signed', async () => {
    const { service } = setup(async () => ({ data: null, error: { message: 'boom' } }));

    const badges = await service.badges();

    expect(badges.get('f')).toMatchObject({ shortName: 'Fleet', logoUrl: null });
  });

  it('skips a logo whose file is missing from the bucket', async () => {
    const { service } = setup(async () => ({
      data: [
        { path: 'projects/nutrirea.svg', signedUrl: '', error: 'Object not found' },
        { path: 'clients/enel.svg', signedUrl: 'https://signed/enel', error: null },
      ],
      error: null,
    }));

    const badges = await service.badges();

    expect(badges.get('n')?.logoUrl).toBeNull();
    expect(badges.get('f')?.logoUrl).toBe('https://signed/enel');
  });

  it('reads once and shares the result, then reads again after 50 minutes', async () => {
    const { service, from } = setup();

    await service.badges(0);
    await service.badges(49 * 60 * 1000);
    expect(from).toHaveBeenCalledTimes(2); // projects and clients, once

    await service.badges(51 * 60 * 1000);
    expect(from).toHaveBeenCalledTimes(4);
  });

  it('fails when the tables cannot be read, and asks again next time', async () => {
    const { service, from } = setup(undefined, {
      projects: { data: null, error: { message: 'boom' } },
      clients: { data: CLIENTS, error: null },
    });

    await expect(service.badges()).rejects.toThrow('Badges unavailable');
    await expect(service.badges()).rejects.toThrow();
    expect(from).toHaveBeenCalledTimes(4);
  });
});
