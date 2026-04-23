import { getAdminClient } from "@/lib/supabase/admin";

export async function createUser(
  email: string,
  password: string,
  username: string,
) {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  return data.user!;
}
