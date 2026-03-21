export interface Config {
  openrouterApiKey: string;
  groupWhitelist: string[];
  botPrefix: string;
  logLevel: string;
  /** Probability of responding (0.0 to 1.0). Default 0.1 = 10% */
  responseRate: number;
}

export interface FreeModel {
  id: string;
  name: string;
  contextLength: number;
}

export interface LlmResponse {
  content: string;
  model: string;
}

export interface Persona {
  soul: string;
  agents: string;
}
