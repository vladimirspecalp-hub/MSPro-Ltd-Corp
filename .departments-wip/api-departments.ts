import { api } from "./client";

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
  list: (companyId: string): Promise<Department[]> =>
    api.get<Department[]>(`/companies/${companyId}/departments`),
};
