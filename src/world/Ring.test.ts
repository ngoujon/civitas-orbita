import { describe, expect, it } from 'vitest';
import { Ring } from './Ring';
import { WorldMap } from './WorldMap';
import { canBuildAt } from './Placement';
import { sectorKey } from './Sector';
import { sectorsInRing } from '@/config/rings';

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
  it('refuse le centre et exige l adjacence', () => {
    const map = new WorldMap(3);
    const occupied = new Set<string>([sectorKey({ ring: 0, index: 0 })]);

    expect(canBuildAt(map, occupied, { ring: 0, index: 0 }).reason).toBe('center_reserved');
    // Anneau 1 est adjacent au centre occupe -> constructible.
    expect(canBuildAt(map, occupied, { ring: 1, index: 0 }).ok).toBe(true);
    // Anneau 2 n est pas encore adjacent a une construction -> refuse.
    expect(canBuildAt(map, occupied, { ring: 2, index: 0 }).reason).toBe('not_adjacent');
  });

  it('refuse un secteur deja occupe', () => {
    const map = new WorldMap(3);
    const occupied = new Set<string>([
      sectorKey({ ring: 0, index: 0 }),
      sectorKey({ ring: 1, index: 0 }),
    ]);
    expect(canBuildAt(map, occupied, { ring: 1, index: 0 }).reason).toBe('occupied');
  });
});
