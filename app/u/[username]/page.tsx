type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

async function fetchProfile(username: string): Promise<Profile | null> {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/profiles/${username}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.profile as Profile;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) {
    return <main className="p-8">Not found.</main>;
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">@{profile.username}</h1>
      {profile.display_name && (
        <p className="mt-1 text-xl">{profile.display_name}</p>
      )}
      {profile.bio && <p className="mt-3 text-slate-700">{profile.bio}</p>}
    </main>
  );
}
