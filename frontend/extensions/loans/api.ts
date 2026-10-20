import { fetchData, postData } from "@/utils/api/base"

export type Loan = {
  id: number
  article: string | null
  chest: string | null
  borrower: string
  lent_by: string | null
  quantity: number
  lent_at: string
  due_at: string | null
  returned_at: string | null
  notes: string
}

export const loansApi = {
  list: () => fetchData<Loan[]>("/api/loans/"),
  create: (payload: {
    article: string | null
    chest: string | null
    quantity: number
    due_at: string | null
    notes: string
  }) => postData<Loan>("/api/loans/", payload),
  return: (id: number) => postData<Loan>(`/api/loans/${id}/return/`),
}
