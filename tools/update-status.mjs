import fs from "node:fs";
import path from "node:path";

const statusPath = path.resolve("docs/PROJECT_STATUS.md");
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

if (args.length === 0) {
  console.error("Usage: pnpm status:update -- \"summary\" [file1 file2 ...]");
  process.exit(1);
}

const summary = args[0].trim();
if (!summary) {
  console.error("Summary cannot be empty.");
  process.exit(1);
}

const changedFiles = args.slice(1).map((item) => item.trim()).filter(Boolean);
const filesSuffix = changedFiles.length > 0 ? ` (${changedFiles.map((item) => `\`${item}\``).join(", ")})` : "";
const bullet = `- ${summary}${filesSuffix}.`;

const now = new Date();
const yyyy = now.getFullYear();
const mm = `${now.getMonth() + 1}`.padStart(2, "0");
const dd = `${now.getDate()}`.padStart(2, "0");
const isoDate = `${yyyy}-${mm}-${dd}`;

if (!fs.existsSync(statusPath)) {
  console.error(`Status file not found: ${statusPath}`);
  process.exit(1);
}

let content = fs.readFileSync(statusPath, "utf8");

content = content.replace(/Last updated:\s+\*\*[0-9]{4}-[0-9]{2}-[0-9]{2}\*\*/, `Last updated: **${isoDate}**`);

const marker = "## 7) Living Update Log";
const markerIdx = content.indexOf(marker);
if (markerIdx === -1) {
  console.error(`Could not find section marker: "${marker}"`);
  process.exit(1);
}

const sectionStart = markerIdx + marker.length;
const nextSectionIdx = content.indexOf("\n## ", sectionStart);
const sectionEnd = nextSectionIdx === -1 ? content.length : nextSectionIdx;
let sectionBody = content.slice(sectionStart, sectionEnd);

const dateHeading = `### ${isoDate}`;
if (sectionBody.includes(dateHeading)) {
  sectionBody = sectionBody.replace(dateHeading, `${dateHeading}\n${bullet}`);
} else {
  const trimmed = sectionBody.trimStart();
  sectionBody = `\n\n${dateHeading}\n${bullet}\n\n${trimmed}`;
}

content = content.slice(0, sectionStart) + sectionBody + content.slice(sectionEnd);
fs.writeFileSync(statusPath, content, "utf8");

console.log(`Updated docs/PROJECT_STATUS.md with: ${bullet}`);
