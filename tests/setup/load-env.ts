import { loadEnvConfig } from "@next/env";
import { vi } from "vitest";

loadEnvConfig(process.cwd());

const store = new Map<string, { name: string; value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => Array.from(store.values()),
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => {
      store.set(name, { name, value });
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));
