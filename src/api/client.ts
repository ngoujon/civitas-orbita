/**
 * Client HTTP pour l'API compte / personnage.
 */

import type { AuthResponse, CharacterProfile, LoadSaveResponse, MeResponse, WorldsListResponse } from './types';

const TOKEN_KEY = 'civitas-orbita:token';

export class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.token !== null;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);

    const res = await fetch(path, { ...init, headers });
    const data = (await res.json()) as T & { error?: string };

    if (!res.ok) {
      throw new Error(data.error ?? `Erreur ${res.status}`);
    }
    return data;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async me(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/auth/me');
  }

  async createCharacter(
    chiefName: string,
    villageName: string,
    civId: string,
  ): Promise<{ character: CharacterProfile }> {
    return this.request('/api/characters', {
      method: 'POST',
      body: JSON.stringify({ chiefName, villageName, civId }),
    });
  }

  async loadSave(): Promise<LoadSaveResponse> {
    return this.request<LoadSaveResponse>('/api/saves/me');
  }

  async saveSave(stateJson: string, version: number): Promise<{ ok: boolean }> {
    return this.request('/api/saves/me', {
      method: 'PUT',
      body: JSON.stringify({ stateJson, version }),
    });
  }

  async deleteSave(): Promise<{ ok: boolean }> {
    return this.request('/api/saves/me', { method: 'DELETE' });
  }

  getToken(): string | null {
    return this.token;
  }

  async listWorlds(): Promise<WorldsListResponse> {
    return this.request<WorldsListResponse>('/api/worlds');
  }

  async createWorld(name: string, stateJson: string): Promise<{ world: { id: string; name: string } }> {
    return this.request('/api/worlds', {
      method: 'POST',
      body: JSON.stringify({ name, stateJson }),
    });
  }

  async joinWorld(worldId: string): Promise<{ world: { id: string; name: string } }> {
    return this.request(`/api/worlds/${encodeURIComponent(worldId)}/join`, { method: 'POST' });
  }

  private setToken(token: string): void {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export const api = new ApiClient();
