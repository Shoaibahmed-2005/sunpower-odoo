// Owned by C — placeholder stub so the shell compiles.
// C replaces with the full query key map from §9.
export const qk = {
  me: ["me"],
  dashboard: (p: string) => ["dashboard", p],
  leads: ["leads"],
  lead: (id: number) => ["lead", id],
  users: (role?: string) => ["users", role],
  surveys: ["surveys"],
  survey: (id: number) => ["survey", id],
  packages: ["packages"],
  quotations: ["quotations"],
  quotation: (id: number) => ["quotation", id],
  invoices: ["invoices"],
  stock: ["stock"],
  dispatches: ["dispatches"],
  dispatch: (id: number) => ["dispatch", id],
  serials: (q: string) => ["serials", q],
  jobs: ["jobs"],
  myJobs: ["jobs", "mine"],
  job: (id: number) => ["job", id],
  tickets: ["tickets"],
  ticket: (id: number) => ["ticket", id],
  lookup: (q: string) => ["lookup", q],
};

