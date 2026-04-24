"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const INPUT_BASE =
  "w-full h-11 rounded-xl border border-oops-border bg-oops-bg/30 px-4 text-base text-oops-text placeholder:text-oops-muted/50 focus:outline-none focus:ring-2 focus:ring-oops-primary/30 transition-shadow duration-150";

export default function SettingsPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const body = await r.json();
      setProfile(body.profile);
      setFormDisplayName(body.profile?.display_name ?? "");
      setBio(body.profile?.bio ?? "");
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
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
    setSaving(false);
    if (res.ok) {
      toast({ tone: "success", text: "saved" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ tone: "error", text: err?.error?.message ?? "save failed" });
    }
  }

  if (!profile) {
    return (
      <main className="max-w-xl mx-auto px-4 md:px-8 py-12">
        <Skeleton className="h-12 w-48 rounded-xl mb-3" />
        <Skeleton className="h-4 w-64 rounded-lg" />
        <div className="mt-8">
          <Skeleton height={300} className="rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 md:px-8 py-12">
      {/* Page heading */}
      <h1 className="font-serif font-medium not-italic text-5xl text-oops-text leading-tight tracking-tight">
        your corner<span className="text-oops-primary">.</span>
      </h1>
      <p className="text-oops-muted text-base mt-2">how the rest of us see you.</p>

      <Card className="mt-8 p-6 md:p-8">
        {/* Avatar preview */}
        <div className="flex flex-col items-center gap-2">
          <Avatar
            size="xl"
            username={profile.username}
            displayName={formDisplayName || profile.display_name}
          />
          <span className="text-sm text-oops-muted">@{profile.username}</span>
        </div>

        {/* Divider */}
        <div className="mt-6 pt-6 border-t border-oops-border">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Display name */}
            <div>
              <label
                htmlFor="display_name"
                className="block text-xs uppercase text-oops-muted tracking-wide font-semibold mb-1"
              >
                display name
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                maxLength={50}
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="how you want to be known"
                className={INPUT_BASE}
              />
            </div>

            {/* Avatar URL */}
            <div>
              <label
                htmlFor="avatar_url"
                className="block text-xs uppercase text-oops-muted tracking-wide font-semibold mb-1"
              >
                avatar url
              </label>
              <input
                id="avatar_url"
                name="avatar_url"
                type="url"
                defaultValue={profile.avatar_url ?? ""}
                placeholder="https://…"
                className={INPUT_BASE}
              />
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-xs uppercase text-oops-muted tracking-wide font-semibold mb-1"
              >
                bio
              </label>
              <div className="relative">
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="tell us something. anything."
                  className={`${INPUT_BASE} h-auto resize-none py-3 leading-relaxed`}
                />
                <span className="absolute bottom-2 right-3 text-xs text-oops-muted tabular-nums pointer-events-none">
                  {bio.length}/500
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full"
              loading={saving}
            >
              save changes
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
