/**
 * Types partages entre le client web et l'API.
 */

export interface UserProfile {
  id: number;
  email: string;
  createdAt?: string;
}

export interface CharacterProfile {
  chiefName: string;
  villageName: string;
  civId: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  hasCharacter: boolean;
}

export interface MeResponse {
  user: UserProfile;
  character: CharacterProfile | null;
}

export interface ApiError {
  error: string;
}

export interface GameSavePayload {
  stateJson: string;
  version: number;
  updatedAt: string;
}

export interface LoadSaveResponse {
  save: GameSavePayload;
}

export interface WorldSummary {
  id: string;
  name: string;
  playerCount: number;
  createdAt?: string;
}

export interface WorldsListResponse {
  worlds: WorldSummary[];
}
