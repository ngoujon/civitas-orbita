import { describe, expect, it } from 'vitest';
import { Ring } from './Ring';
import { WorldMap } from './WorldMap';
import { canBuildAt } from './Placement';
import { isSpokeClearForPort, resolvePortPlacementSector, spokeKeys } from './SeaAccess';
import { sectorKey } from './Sector';
import { sectorsInRing, BEACH_SNAP_MARGIN } from '@/config/rings';

describe('Ring', () => {
  it('a 1 secteur au centre, puis 4, 8, 12, 16...', () => {
    expect(sectorsInRing(0)).toBe(1);
    expect(sectorsInRing(1)).toBe(4);
    expect(sectorsInRing(2)).toBe(8);
    expect(sectorsInRing(3)).toBe(12);
    expect(sectorsInRing(4)).toBe(16);
  });

  it('rayons croissants et coherents', () => {
    const r1 = new Ring(1);
    const r2 = new Ring(2);
    expect(r1.innerRadius).toBeLessThan(r1.outerRadius);
    expect(r1.outerRadius).toBe(r2.innerRadius);
  });

  it('retrouve le secteur a partir de l angle', () => {
    const ring = new Ring(1); // 4 secteurs : quadrants
    expect(ring.sectorAtAngle(0)).toBe(0);
    expect(ring.sectorAtAngle(Math.PI / 2)).toBe(1);
    expect(ring.sectorAtAngle(Math.PI)).toBe(2);
    expect(ring.sectorAtAngle((3 * Math.PI) / 2)).toBe(3);
  });
});

describe('WorldMap', () => {
  it('compte correctement le total de secteurs', () => {
    const map = new WorldMap(3); // centre + 4 + 8 + 12
    expect(map.totalSectors).toBe(1 + 4 + 8 + 12);
  });

  it('convertit un point-monde en secteur', () => {
    const map = new WorldMap(4);
    const center = map.sectorAtPoint(0, 0);
    expect(center).toEqual({ ring: 0, index: 0 });

    // Un point loin sur l axe +x doit tomber dans le secteur 0 d un anneau exterieur.
    const ring = map.getRing(2)!;
    const pt = map.sectorAtPoint(ring.midRadius, 0.001);
    expect(pt?.ring).toBe(2);
    expect(pt?.index).toBe(0);
  });

  it('rattache un clic sur la plage au secteur de lisiere', () => {
    const map = new WorldMap(4);
    const outer = map.getRing(4)!;
    const beachR = outer.outerRadius + BEACH_SNAP_MARGIN * 0.5;
    const pt = map.sectorAtPoint(beachR, 0);
    expect(pt).toEqual({ ring: 4, index: 0 });
  });

  it('le centre est voisin de tout l anneau 1', () => {
    const map = new WorldMap(2);
    const n = map.neighbors({ ring: 0, index: 0 });
    expect(n).toHaveLength(4);
  });

  it('les voisins intra-anneau bouclent (wrap)', () => {
    const map = new WorldMap(2);
    const n = map.neighbors({ ring: 1, index: 0 });
    const keys = n.map(sectorKey);
    expect(keys).toContain('1:3'); // voisin precedent (wrap)
    expect(keys).toContain('1:1'); // voisin suivant
  });
});

describe('Placement', () => {
  it('refuse le centre et exige l adjacence + terrain prepare', () => {
    const map = new WorldMap(3);
    const occupied = new Set<string>([sectorKey({ ring: 0, index: 0 })]);
    const emptyPrepared = {} as Record<string, true>;

    expect(canBuildAt(map, occupied, emptyPrepared, { ring: 0, index: 0 }).reason).toBe(
      'center_reserved',
    );
    expect(canBuildAt(map, occupied, emptyPrepared, { ring: 1, index: 0 }).reason).toBe(
      'not_prepared',
    );

    const prepared = { [sectorKey({ ring: 1, index: 0 })]: true as const };
    expect(canBuildAt(map, occupied, prepared, { ring: 1, index: 0 }).ok).toBe(true);
    expect(canBuildAt(map, occupied, prepared, { ring: 2, index: 0 }).reason).toBe('not_prepared');

    const preparedWide = {
      [sectorKey({ ring: 1, index: 0 })]: true as const,
      [sectorKey({ ring: 2, index: 5 })]: true as const,
    };
    expect(canBuildAt(map, occupied, preparedWide, { ring: 2, index: 5 }).reason).toBe('not_adjacent');
  });

  it('refuse un secteur deja occupe', () => {
    const map = new WorldMap(3);
    const key = sectorKey({ ring: 1, index: 0 });
    const occupied = new Set<string>([sectorKey({ ring: 0, index: 0 }), key]);
    const prepared = { [key]: true as const };
    expect(canBuildAt(map, occupied, prepared, { ring: 1, index: 0 }).reason).toBe('occupied');
  });

  it('refuse les secteurs reserves pour l acces mer', () => {
    const map = new WorldMap(3);
    const occupied = new Set<string>([sectorKey({ ring: 0, index: 0 })]);
    const prepared = {
      [sectorKey({ ring: 1, index: 0 })]: true as const,
      [sectorKey({ ring: 2, index: 1 })]: true as const,
    };
    const blocked = new Set<string>([sectorKey({ ring: 2, index: 1 })]);
    expect(
      canBuildAt(map, occupied, prepared, { ring: 2, index: 1 }, blocked).reason,
    ).toBe('sea_access_reserved');
  });
});

describe('SeaAccess', () => {
  it('aligne les secteurs d une meme ligne radiale', () => {
    const map = new WorldMap(4);
    const anchor = { ring: 4, index: 0 };
    const keys = spokeKeys(map, anchor);
    expect(keys.length).toBeGreaterThan(1);
    expect(keys).toContain('4:0');
    expect(keys).toContain('1:0');
  });

  it('detecte une ligne occupee incompatible avec un port', () => {
    const map = new WorldMap(4);
    const occupied = new Set<string>([
      sectorKey({ ring: 0, index: 0 }),
      sectorKey({ ring: 2, index: 0 }),
    ]);
    expect(isSpokeClearForPort(map, occupied, { ring: 4, index: 0 })).toBe(false);
    expect(isSpokeClearForPort(map, occupied, { ring: 4, index: 2 })).toBe(true);
  });

  it('bascule le port vers la lisiere si l anneau interieur est prepare', () => {
    const map = new WorldMap(4);
    const occupied = new Set<string>([sectorKey({ ring: 0, index: 0 })]);
    const prepared = {
      [sectorKey({ ring: 3, index: 0 })]: true as const,
      [sectorKey({ ring: 4, index: 0 })]: true as const,
    };
    const resolved = resolvePortPlacementSector(
      map,
      { ring: 3, index: 0 },
      occupied,
      prepared,
    );
    expect(resolved).toEqual({ ring: 4, index: 0 });
  });
});
