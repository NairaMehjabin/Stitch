import { confirm, select } from "@inquirer/prompts";
import { relative } from "node:path";
import { Command } from "commander";
import {
  applyRenamePlan,
  CanonicalSelection,
  createRenamePlan,
  PropertyRename
} from "../fixer/interfacePropertyFixer";
import {
  detectNamingDrift,
  NamingDriftGroup
} from "../scanner/driftDetector";
import {
  discoverTypeScriptFiles,
  loadStitchConfig
} from "../scanner/fileLoader";
import { loadProject } from "../scanner/projectLoader";
import { normalizePath } from "../utils/normalizePath";
import { runDuplicateRepair } from "./fixDups";

function displayPath(filePath: string): string {
  return normalizePath(relative(process.cwd(), filePath));
}

function printFixGroups(groups: NamingDriftGroup[]): void {
  console.log("Potential Naming Drift\n");

  for (const [index, group] of groups.entries()) {
    console.log(`Group #${index + 1}`);
    console.log(group.variants.join(" / "));
    console.log("");
  }
}

function printPreview(renamePlan: PropertyRename[]): void {
  console.log("\nPreview Changes\n");

  for (const rename of renamePlan) {
    console.log(`${displayPath(rename.filePath)}:${rename.lineNumber}`);
    console.log(`${rename.oldName} → ${rename.newName}\n`);
  }

  const affectedFiles = new Set(renamePlan.map((rename) => rename.filePath));

  console.log(`Total renames: ${renamePlan.length}`);
  console.log(`Affected files: ${affectedFiles.size}`);
}

export function registerFixCommand(program: Command): void {
  const fixCommand = program
    .command("fix")
    .description("Safely rename interface property declarations")
    .action(async () => {
      const config = loadStitchConfig();
      const filePaths = discoverTypeScriptFiles(config);
      const project = loadProject(filePaths);
      const driftGroups = detectNamingDrift(project);

      console.log("🧵 Stitch Fix\n");

      if (driftGroups.length === 0) {
        console.log("No potential naming drift found.");
        return;
      }

      printFixGroups(driftGroups);

      const selections: CanonicalSelection[] = [];

      for (const [index, group] of driftGroups.entries()) {
        const canonicalName = await select({
          message: `Choose a canonical name for Group #${index + 1}:`,
          choices: group.variants.map((variant, variantIndex) => ({
            name: `[${variantIndex + 1}] ${variant}`,
            value: variant
          }))
        });

        selections.push({
          group,
          canonicalName
        });
      }

      let renamePlan: PropertyRename[];

      try {
        renamePlan = createRenamePlan(selections);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to create a safe fix plan.";

        console.log(`\nFix cancelled: ${message}`);
        console.log("No files were modified.");
        return;
      }

      if (renamePlan.length === 0) {
        console.log("\nNo property declarations need to be renamed.");
        return;
      }

      printPreview(renamePlan);

      const shouldApply = await confirm({
        message: "Apply changes?",
        default: false
      });

      if (!shouldApply) {
        console.log("\nFix cancelled. No files were modified.");
        return;
      }

      applyRenamePlan(renamePlan);

      const changedFiles = new Map(
        renamePlan.map((rename) => [
          rename.filePath,
          rename.declaration.getSourceFile()
        ])
      );

      await Promise.all(
        [...changedFiles.values()].map((sourceFile) => sourceFile.save())
      );

      console.log("\nChanges applied successfully.");
    });

  fixCommand
    .command("dups")
    .description("Repair duplicate concepts in interfaces")
    .action(runDuplicateRepair);
}