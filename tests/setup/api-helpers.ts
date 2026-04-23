import { NextRequest } from "next/server";

export function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(
    `http://localhost:3000${url}`,
    init as ConstructorParameters<typeof NextRequest>[1],
  );
}

export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}
