import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

/** What the badge of a project shows, besides its colour. */
export interface ProjectBadgeData {
  name: string;
  /** `projects.short_name`; null: the badge shows the full name. */
  shortName: string | null;
  /** `projects.icon`, a Lucide name; the app may not know it. */
  icon: string | null;
  /** Signed URL of the project logo, else of its client logo; null when there is none. */
  logoUrl: string | null;
}

const BUCKET = 'logos';
/** Signed URLs last an hour; the badges are read again before they expire. */
const URL_SECONDS = 60 * 60;
const REFRESH_MS = 50 * 60 * 1000;

/**
 * Reads the badges of every project: short name, icon and logo. Logos live in the private
 * `logos` bucket and are shown through signed URLs, never public links. The result is
 * shared by every badge on the page and read again after 50 minutes.
 *
 * Logos are optional: if they cannot be signed, the badges come without them.
 */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  private readonly supabase = inject(SUPABASE);
  private cached: { at: number; badges: Promise<ReadonlyMap<string, ProjectBadgeData>> } | null =
    null;

  badges(now = Date.now()): Promise<ReadonlyMap<string, ProjectBadgeData>> {
    if (this.cached === null || now - this.cached.at > REFRESH_MS) {
      const badges = this.load();
      this.cached = { at: now, badges };
      // A failed read is not kept: the next badge asks again.
      badges.catch(() => {
        if (this.cached?.badges === badges) {
          this.cached = null;
        }
      });
    }
    return this.cached.badges;
  }

  private async load(): Promise<ReadonlyMap<string, ProjectBadgeData>> {
    const [projects, clients] = await Promise.all([
      this.supabase.from('projects').select('id, name, short_name, icon, logo_path, client'),
      this.supabase.from('clients').select('name, logo_path'),
    ]);
    if (projects.error || clients.error) {
      throw new Error('Badges unavailable');
    }

    const clientLogos = new Map(clients.data.map((c) => [c.name, c.logo_path]));
    const paths = new Map<string, string>();
    for (const p of projects.data) {
      const path = p.logo_path ?? (p.client === null ? null : (clientLogos.get(p.client) ?? null));
      if (path !== null) {
        paths.set(p.id, path);
      }
    }
    const urls = await this.sign([...new Set(paths.values())]);

    return new Map(
      projects.data.map((p) => {
        const path = paths.get(p.id);
        return [
          p.id,
          {
            name: p.name,
            shortName: p.short_name,
            icon: p.icon,
            logoUrl: path === undefined ? null : (urls.get(path) ?? null),
          },
        ];
      }),
    );
  }

  private async sign(paths: string[]): Promise<ReadonlyMap<string, string>> {
    if (paths.length === 0) {
      return new Map();
    }
    try {
      const { data, error } = await this.supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, URL_SECONDS);
      if (error) {
        return new Map();
      }
      return new Map(
        data.flatMap((d) =>
          d.error === null && d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [],
        ),
      );
    } catch {
      return new Map();
    }
  }
}
