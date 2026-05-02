import { api } from "./client";

export interface CeoAskRequest {
  question: string;
}

export interface CeoCitation {
  /** Wikilink target as written in the answer, e.g. "ceo/vault/decisions-log" */
  wikilink: string;
  /** Optional vault name override (defaults to client-side default) */
  vault?: string;
  /** Optional excerpt for tooltip / inline display */
  excerpt?: string;
}

export interface CeoAskResponse {
  /** Markdown answer; may contain inline [[wikilinks]] */
  answer: string;
  /** Optional structured citations extracted by backend */
  citations?: CeoCitation[];
  /** End-to-end latency in ms */
  durationMs?: number;
  /** Model that produced the answer (e.g. "qwen3:14b") */
  model?: string;
}

export const ceoApi = {
  ask: (companyId: string, body: CeoAskRequest) =>
    api.post<CeoAskResponse>(`/companies/${companyId}/ceo/ask`, body),
};
