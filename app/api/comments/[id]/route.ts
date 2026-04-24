import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { commentPatchSchema } from "@/lib/validation/comment";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("comments")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Comment not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your comment", 403);

    const input = commentPatchSchema.parse(await req.json());
    const { data, error } = await admin
      .from("comments")
      .update({ body: input.body })
      .eq("id", id)
      .select("id, thread_id, parent_comment_id, body, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ comment: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("comments")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Comment not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your comment", 403);

    const { error } = await admin
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
