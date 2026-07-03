import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/workflows";
import type { WorkflowRow } from "@/lib/workflows";

function toWorkflowRow(row: typeof workflows.$inferSelect): WorkflowRow {
  return {
    id: row.id,
    client_tag: row.clientTag,
    name: row.name,
    description: row.description,
    webhook_url: row.webhookUrl,
    http_method: row.httpMethod ?? "POST",
    auth_type: row.authType ?? "none",
    action_verb: row.actionVerb ?? "Execute",
    inputs: row.inputs,
    validations: row.validations,
    is_active: row.isActive ?? true,
    created_at: row.createdAt.toISOString(),
  };
}

export async function getActiveWorkflowsForClientTag(
  clientTag: string
): Promise<WorkflowRow[]> {
  const rows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.clientTag, clientTag), eq(workflows.isActive, true)))
    .orderBy(asc(workflows.name));

  return rows.map(toWorkflowRow);
}

export async function getActiveWorkflowForClientTag(
  id: string,
  clientTag: string
): Promise<WorkflowRow | null> {
  const rows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.id, id),
        eq(workflows.clientTag, clientTag),
        eq(workflows.isActive, true)
      )
    )
    .limit(1);

  return rows[0] ? toWorkflowRow(rows[0]) : null;
}
