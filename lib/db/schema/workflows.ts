import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  json,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import type { WorkflowInputField, ValidationRule } from "@/lib/workflows";

export const workflows = mysqlTable(
  "workflows",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    clientTag: varchar("client_tag", { length: 255 }).notNull().default("unassigned"),
    name: varchar("name", { length: 255 }).notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    webhookUrl: text("webhook_url").notNull(),
    httpMethod: varchar("http_method", { length: 16 }).default("POST"),
    authType: mysqlEnum("auth_type", ["none", "x-n8n-secret", "bearer"]).default("none"),
    actionVerb: varchar("action_verb", { length: 64 }).default("Execute"),
    inputs: json("inputs").$type<WorkflowInputField[]>().notNull().default([]),
    validations: json("validations")
      .$type<Record<string, ValidationRule[]>>()
      .notNull()
      .default({}),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [index("workflows_clientTag_idx").on(table.clientTag)],
);
