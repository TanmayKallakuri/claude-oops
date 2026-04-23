"use client";
import { useEffect, useState } from "react";

type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const body = await r.json();
      setProfile(body.profile);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const k of ["display_name", "bio", "avatar_url"] as const) {
      const v = form.get(k);
      if (typeof v === "string" && v.length > 0) payload[k] = v;
    }
    const res = await fetch("/api/profiles/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMsg(res.ok ? "Saved" : "Failed");
  }

  if (!profile) return <main className="p-8">Loading…</main>;
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-slate-600">@{profile.username}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="display_name"
          defaultValue={profile.display_name ?? ""}
          placeholder="display name"
          className="w-full border p-2"
        />
        <input
          name="avatar_url"
          defaultValue={profile.avatar_url ?? ""}
          placeholder="avatar URL"
          className="w-full border p-2"
        />
        <textarea
          name="bio"
          defaultValue={profile.bio ?? ""}
          placeholder="bio"
          className="w-full border p-2"
        />
        <button className="w-full bg-slate-900 p-2 text-white">Save</button>
      </form>
      {msg && <p className="mt-3">{msg}</p>}
    </main>
  );
}
