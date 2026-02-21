"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

export interface GlobalJob {
  id: string;
  type: "content" | "keywords" | "clusters" | "links";
  label: string;
  websiteId: string;
  /** Page path the user should be taken to */
  href: string;
  status: "running" | "done" | "failed";
  /** 0-100 */
  progress: number;
  /** Step name currently executing */
  currentStep?: string;
  /** Ordered list of step IDs */
  steps?: string[];
  /** Extra data (e.g. error message) */
  error?: string;
  createdAt: number;
}

interface GlobalJobsContextValue {
  jobs: GlobalJob[];
  addJob: (job: Omit<GlobalJob, "createdAt">) => void;
  updateJob: (id: string, patch: Partial<GlobalJob>) => void;
  removeJob: (id: string) => void;
  getJob: (id: string) => GlobalJob | undefined;
}

const GlobalJobsContext = createContext<GlobalJobsContextValue | null>(null);

export function GlobalJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<GlobalJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const addJob = useCallback(
    (job: Omit<GlobalJob, "createdAt">) => {
      setJobs((prev) => {
        const existing = prev.find((j) => j.id === job.id);
        if (existing) {
          return prev.map((j) => (j.id === job.id ? { ...j, ...job } : j));
        }
        return [...prev, { ...job, createdAt: Date.now() }];
      });
    },
    []
  );

  const updateJob = useCallback(
    (id: string, patch: Partial<GlobalJob>) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
      );
    },
    []
  );

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const getJob = useCallback(
    (id: string) => jobsRef.current.find((j) => j.id === id),
    []
  );

  return (
    <GlobalJobsContext.Provider
      value={{ jobs, addJob, updateJob, removeJob, getJob }}
    >
      {children}
    </GlobalJobsContext.Provider>
  );
}

export function useGlobalJobs() {
  const ctx = useContext(GlobalJobsContext);
  if (!ctx)
    throw new Error("useGlobalJobs must be used within GlobalJobsProvider");
  return ctx;
}
