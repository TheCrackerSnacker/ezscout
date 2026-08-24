import { foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  definition: jsonb("definition").notNull(),
  publishedVersion: integer("published_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const formVersions = pgTable(
  "form_versions",
  {
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.formId, table.version] })]
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey(),
    formId: uuid("form_id").notNull(),
    formVersion: integer("form_version").notNull(),
    answers: jsonb("answers").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      name: "responses_form_version_fk",
      columns: [table.formId, table.formVersion],
      foreignColumns: [formVersions.formId, formVersions.version]
    })
  ]
);
