"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  approveResultChange,
  cancelResultChange,
  rejectResultChange,
} from "@/lib/utils/result-changes";

function refresh(id: number) {
  revalidatePath("/results");
  revalidatePath("/results/changes");
  revalidatePath(`/results/changes/${id}`);
  revalidatePath("/intakes");
  revalidatePath("/enrollments");
}

export async function approveResultChangeAction(id: number) {
  const user = await requireRole(["chief_instructor", "commandant"]);
  const result = await approveResultChange(user, id);
  refresh(id);
  return result;
}

export async function rejectResultChangeAction(id: number, reason: string) {
  const user = await requireRole(["chief_instructor", "commandant"]);
  const result = await rejectResultChange(user, id, reason);
  refresh(id);
  return result;
}

export async function cancelResultChangeAction(id: number) {
  const user = await requireAuth();
  const result = await cancelResultChange(user, id);
  refresh(id);
  return result;
}
