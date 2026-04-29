import { api, ApiError } from "./client";

export interface Department {
  id: string;
  name: string;
  companyId: string;
  color: string | null;
  icon: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const departmentsApi = {
  /** Returns [] if the API endpoint doesn't exist yet (graceful degradation). */
  list: async (companyId: string): Promise<Department[]> => {
    try {
      return await api.get<Department[]>(`/companies/${companyId}/departments`);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        return [];
      }
      throw err;
    }
  },
};
