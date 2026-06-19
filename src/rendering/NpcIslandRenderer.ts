/**
 * Rendu procedurale des iles PNJ dans la mer.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { AGES } from '@/config/ages';
import { PALETTE } from '@/config/game';
import { getCivDef } from '@/config/civilizations';
import { NPC_ISLAND_RADIUS } from '@/config/npcIslands';
import type { GameState } from '@/game/GameState';
import { lootIsEmpty, type NpcIslandState } from '@/world/NpcIsland';
import { isNpcIslandActive } from '@/world/NpcIslandAbsorption';
import { isWorldPointExplored } from '@/world/SeaExploration';

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xffffff,
  stroke: { color: 0x1a2840, width: 3 },
  align: 'center',
});

export class NpcIslandRenderer {
  private readonly layer = new Container();
  private readonly gfx = new Graphics();
  private readonly labels = new Map<string, Text>();
  private selectedId: string | null = null;
  private elapsed = 0;

  constructor(parent: Container) {
    parent.addChildAt(this.layer, 4);
    this.layer.addChild(this.gfx);
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
  }

  update(state: GameState, dt: number): void {
    this.elapsed += dt;
    this.gfx.clear();

    for (const island of state.npcIslands) {
      if (!isNpcIslandActive(island)) continue;
      if (!isWorldPointExplored(state, island.x, island.y)) continue;
      this.drawIsland(island, island.id === this.selectedId);
      this.syncLabel(island);
    }

    this.pruneLabels(state);
    this.layer.visible = state.npcIslands.some(isNpcIslandActive);
  }

  private drawIsland(island: NpcIslandState, selected: boolean): void {
    const { x, y } = island;
    const r = NPC_ISLAND_RADIUS * 0.55;
    const bob = Math.sin(this.elapsed * 1.4 + x * 0.002) * 2;

    this.gfx.ellipse(x, y + r * 0.35, r * 1.1, r * 0.35).fill({ color: 0x000000, alpha: 0.12 });
    this.gfx.circle(x, y + bob, r + 10).fill(0xe8d39a);
    this.gfx.circle(x, y + bob, r).fill(PALETTE.grass);
    this.gfx.circle(x, y + bob - r * 0.15, r * 0.72).fill(PALETTE.grassDark);

    const civColor = getCivDef(island.civ).themeColor;
    this.drawHut(x - r * 0.35, y + bob + r * 0.05, civColor);
    this.drawHut(x + r * 0.3, y + bob + r * 0.12, civColor);
    this.drawHut(x, y + bob - r * 0.25, civColor);

    this.gfx.rect(x, y + bob - r * 0.55, 2, 14).fill(PALETTE.woodDark);
    this.gfx.poly([x + 2, y + bob - r * 0.55, x + 16, y + bob - r * 0.48, x + 2, y + bob - r * 0.41]).fill(civColor);

    if (island.expedition) {
      const pct = Math.min(1, island.expedition.progress / island.expedition.duration);
      this.drawProgressRing(x, y + bob, r + 14, pct, 0x44dd88);
    } else if (!lootIsEmpty(island.loot)) {
      this.gfx.circle(x, y + bob - r - 8, 5).fill(0xffd54a).stroke({ width: 2, color: 0x8a6a00 });
    } else if (island.lootCooldown > 0) {
      this.gfx.circle(x, y + bob - r - 8, 4).fill({ color: 0x888888, alpha: 0.8 });
    }

    if (selected) {
      this.gfx
        .circle(x, y + bob, r + 18)
        .stroke({ width: 3, color: PALETTE.highlight, alpha: 0.55 + 0.2 * Math.sin(this.elapsed * 5) });
    }
  }

  private drawHut(hx: number, hy: number, roofColor: number): void {
    this.gfx.rect(hx - 8, hy - 2, 16, 10).fill(PALETTE.dirt).stroke({ width: 1.5, color: PALETTE.outline });
    this.gfx.poly([hx - 10, hy - 2, hx, hy - 12, hx + 10, hy - 2]).fill(roofColor).stroke({ width: 1.5, color: PALETTE.outline });
  }

  private drawProgressRing(cx: number, cy: number, radius: number, pct: number, color: number): void {
    if (pct <= 0) return;
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * pct;
    this.gfx.arc(cx, cy, radius, start, end).stroke({ width: 4, color, alpha: 0.9 });
  }

  private syncLabel(island: NpcIslandState): void {
    let label = this.labels.get(island.id);
    if (!label) {
      label = new Text({ text: '', style: LABEL_STYLE });
      label.anchor.set(0.5, 0);
      this.layer.addChild(label);
      this.labels.set(island.id, label);
    }
    label.text = `${island.villageName}\n${island.chiefName} · ${AGES[island.age].name}`;
    label.position.set(island.x, island.y + NPC_ISLAND_RADIUS * 0.45);
    label.alpha = island.id === this.selectedId ? 1 : 0.85;
  }

  private pruneLabels(state: GameState): void {
    const ids = new Set(state.npcIslands.filter(isNpcIslandActive).map((i) => i.id));
    for (const [id, label] of this.labels) {
      if (!ids.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
  }

  destroy(): void {
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
    this.layer.destroy({ children: true });
  }
}
