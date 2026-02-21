"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

export interface GlobalJob {
  id: string;
  type: "content" | "keywords" | "clusters" | "links";
  label: string;
  websiteId: string;
  href: string;
  status: "running" | "done" | "failed";
  progress: number;
  currentStep?: string;
  steps?: string[];
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultData?: Record<string, any>;
  resultConsumed?: boolean;
  createdAt: number;
}

interface GlobalJobsContextValue {
  jobs: GlobalJob[];
  addJob: (job: Omit<GlobalJob, "createdAt">) => void;
  updateJob: (id: string, patch: Partial<GlobalJob>) => void;
  removeJob: (id: string) => void;
  getJob: (id: string) => GlobalJob | undefined;
  consumeResult: (id: string) => void;
}

const STORAGE_KEY = "global-jobs";

function loadFromStorage(): GlobalJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GlobalJob[];
  } catch {
    return [];
  }
}

function saveToStorage(jobs: GlobalJob[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // storage full or unavailable — ignore
  }
}

const GlobalJobsContext = createContext<GlobalJobsContextValue | null>(null);

export function GlobalJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<GlobalJob[]>([]);
  const hydratedRef = useRef(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // Hydrate from sessionStorage AFTER first client render (avoids SSR mismatch)
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length) setJobs(stored);
    hydratedRef.current = true;
  }, []);

  // Persist to sessionStorage on every change (skip the initial empty write before hydration)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveToStorage(jobs);
  }, [jobs]);

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

  const consumeResult = useCallback((id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, resultConsumed: true } : j))
    );
  }, []);

  return (
    <GlobalJobsContext.Provider
      value={{ jobs, addJob, updateJob, removeJob, getJob, consumeResult }}
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
