/**
 * SoundSystem : effets sonores 100% synthetises par code (Web Audio API).
 *
 * Conformement a la contrainte "zero asset externe", AUCUN fichier audio n'est
 * charge : chaque SFX est genere a la volee via des oscillateurs et enveloppes
 * de gain (comme les sprites sont dessines proceduralement).
 *
 * L'AudioContext est cree paresseusement et reactive sur la premiere
 * interaction utilisateur (politique d'autoplay des navigateurs).
 */

import type { EventBus } from '@/core';
import type { GameEvents } from '@/game/events';

export type SfxName =
  | 'click'
  | 'select'
  | 'place'
  | 'complete'
  | 'age'
  | 'ability'
  | 'error'
  | 'info';

const MUTE_KEY = 'civitas-orbita:muted';
const MASTER_VOLUME = 0.35;

type OscType = OscillatorType;

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_VOLUME;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Cree (au besoin) et reactive le contexte audio. Null si indisponible/muet. */
  private ensure(): { ctx: AudioContext; master: GainNode } | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.master ? { ctx: this.ctx, master: this.master } : null;
  }

  /** Joue un effet sonore nomme. */
  play(name: SfxName): void {
    const a = this.ensure();
    if (!a) return;
    const { ctx, master } = a;
    const t = ctx.currentTime;

    switch (name) {
      case 'click':
        this.blip(ctx, master, t, 660, 0.06, 'sine', 0.25);
        break;
      case 'select':
        this.blip(ctx, master, t, 520, 0.05, 'triangle', 0.22);
        this.blip(ctx, master, t + 0.04, 760, 0.06, 'triangle', 0.22);
        break;
      case 'place':
        this.blip(ctx, master, t, 180, 0.12, 'square', 0.3);
        this.noise(ctx, master, t, 0.08, 0.12);
        break;
      case 'complete':
        this.arp(ctx, master, t, [523, 659, 784], 0.09, 0.16, 'sine', 0.26);
        break;
      case 'age':
        this.arp(ctx, master, t, [392, 523, 659, 784, 1046], 0.11, 0.3, 'triangle', 0.3);
        break;
      case 'ability':
        this.sweep(ctx, master, t, 300, 1200, 0.35, 'sine', 0.28);
        this.blip(ctx, master, t + 0.18, 1568, 0.14, 'triangle', 0.18);
        break;
      case 'error':
        this.blip(ctx, master, t, 170, 0.16, 'sawtooth', 0.28);
        this.blip(ctx, master, t + 0.07, 120, 0.2, 'sawtooth', 0.24);
        break;
      case 'info':
        this.blip(ctx, master, t, 740, 0.08, 'sine', 0.2);
        break;
    }
  }

  /** Branche les SFX sur les evenements de jeu. */
  bindBus(bus: EventBus<GameEvents>): void {
    bus.on('building:placed', () => this.play('place'));
    bus.on('building:completed', () => this.play('complete'));
    bus.on('age:advanced', () => this.play('age'));
    bus.on('ability:used', () => this.play('ability'));
    bus.on('buildmode:changed', ({ building }) => {
      if (building) this.play('select');
    });
    bus.on('notify', ({ kind }) => {
      if (kind === 'warn') this.play('error');
    });
  }

  /** Joue un "click" sur les boutons d'interface (delegation globale). */
  attachUiClicks(target: Document | HTMLElement = document): void {
    target.addEventListener(
      'pointerdown',
      (e) => {
        const el = e.target as HTMLElement | null;
        if (el?.closest('.hud-btn:not(.hud-ability-btn), .hud-speed-btn, .start-btn, .start-card')) {
          this.play('click');
        }
      },
      true,
    );
  }

  // --- Briques de synthese --------------------------------------------------

  private blip(
    ctx: AudioContext,
    master: GainNode,
    when: number,
    freq: number,
    dur: number,
    type: OscType,
    vol: number,
    attack = 0.005,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private arp(
    ctx: AudioContext,
    master: GainNode,
    when: number,
    freqs: number[],
    gap: number,
    dur: number,
    type: OscType,
    vol: number,
  ): void {
    freqs.forEach((f, i) => this.blip(ctx, master, when + i * gap, f, dur, type, vol));
  }

  private sweep(
    ctx: AudioContext,
    master: GainNode,
    when: number,
    from: number,
    to: number,
    dur: number,
    type: OscType,
    vol: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(to, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private noise(ctx: AudioContext, master: GainNode, when: number, dur: number, vol: number): void {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len); // bruit blanc decroissant
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.start(when);
  }
}
