// Concatenates the numbered migrations into supabase/setup.sql so the whole
// schema can be built with a single paste into the Supabase SQL Editor.
// Run with: node scripts/build-setup-sql.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "supabase/migrations";
const OUT = "supabase/setup.sql";

// 0000_reset.sql is deliberately excluded: it drops every table.
const files = readdirSync(DIR)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.startsWith("0000_"))
  .sort();

const last = files.at(-1)?.slice(0, 4) ?? "0001";

let out = `-- ============================================================
-- NextGen Predict — full schema, 0001 through ${last} in one file
-- ============================================================
-- GENERATED FILE — do not edit. Regenerate with scripts/build-setup-sql.mjs.
--
-- Paste this whole file into the Supabase SQL Editor and run it once to
-- build the schema from empty. The numbered migrations are the source of
-- truth; this is only a convenience so the editor needs one paste
-- instead of ${files.length} in the right order.
--
-- Safe to re-run: every statement is create-if-not-exists, create-or-
-- replace, or drop-then-create.
-- ============================================================

`;

for (const file of files) {
  out += `\n-- ==========================================================\n`;
  out += `-- >>> ${file}\n`;
  out += `-- ==========================================================\n\n`;
  out += readFileSync(`${DIR}/${file}`, "utf8").replace(/\s*$/, "") + "\n";
}

writeFileSync(OUT, out);

// An odd number of any dollar-quote tag means a function body was cut in
// half, which would make the whole paste unrunnable.
const counts = {};
for (const tag of out.match(/\$[a-zA-Z_]*\$/g) ?? []) {
  counts[tag] = (counts[tag] ?? 0) + 1;
}
const unbalanced = Object.entries(counts).filter(([, n]) => n % 2);
if (unbalanced.length > 0) {
  console.error("Unbalanced dollar-quoted tags:", unbalanced);
  process.exit(1);
}

console.log(`${OUT}: ${files.length} migrations, ${out.split("\n").length} lines`);
