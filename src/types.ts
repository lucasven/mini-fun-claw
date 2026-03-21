export interface Config {
  openrouterApiKey: string;
  groupWhitelist: string[];
  botPrefix: string;
  logLevel: string;
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
