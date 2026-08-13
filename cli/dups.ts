import { confirm, select } from "@inquirer/prompts";
import { relative } from "node:path";
import { Command } from "commander";
import {
  applyDuplicateRemovalPlan,
  createDuplicateRemovalPlan,
  DuplicatePropertyRemoval
} from "../fixer/duplicatePropertyFixer";
import {
  detectDuplicateConcepts,
  DuplicateConceptGroup
} from "../scanner/duplicateConceptDetector";
import { discoverTypeScriptFiles, loadStitchConfig } from "../scanner/fileLoader";
import { loadProject } from "../scanner/projectLoader";
import { normalizePath } from "../utils/normalizePath";

function displayPath(filePath: string): string {
  return normalizePath(relative(process.cwd(), filePath));
}

function printDuplicateGroup(group: DuplicateConceptGroup): void {
  console.log("🧵 Duplicate Concept Found\n");
  console.log(`Interface: ${group.interfaceName}\n`);

  console.log("Properties:");
  for (const property of group.properties) {
    console.log(`- ${property.propertyName}`);
  }

  console.log("\nLocations:");
  for (const property of group.properties) {
    console.log(`- ${displayPath(property.filePath)}:${property.lineNumber}`);
  }

  console.log(
    "\nThese properties appear to represent the same concept inside the same interface.\n"
  );
}

function printManualReview(group: DuplicateConceptGroup): void {
  console.log("⚠ Manual Review Required\n");
  console.log(
    "Properties normalize to the same concept but have different types.\n"
  );
  console.log(`Interface: ${group.interfaceName}\n`);

  for (const property of group.properties) {
    console.log(`${property.propertyName}: ${property.typeText}`);
  }

  console.log("\nNo automatic fix available.\n");
}

function printPreview(removalPlan: DuplicatePropertyRemoval[]): void {
  console.log("\nPreview Changes\n");

  for (const removal of removalPlan) {
    console.log(`${displayPath(removal.filePath)}:${removal.lineNumber}\n`);

    console.log("DELETE:");
    console.log(`${removal.propertyText}\n`);

    console.log("Keeping:");
    console.log(`${removal.keptPropertyText}\n`);
  }

  const affectedFiles = new Set(removalPlan.map((removal) => removal.filePath));

  console.log(
    `${removalPlan.length} propert${removalPlan.length === 1 ? "y" : "ies"} will be removed.`
  );
  console.log(`Affected files: ${affectedFiles.size}`);
}

export async function runDuplicateRepair(): Promise<void> {
  const config = loadStitchConfig();
  const filePaths = discoverTypeScriptFiles(config);
  const project = loadProject(filePaths);
  const duplicateGroups = detectDuplicateConcepts(project);

  if (duplicateGroups.length === 0) {
    console.log("No duplicate concepts found.");
    return;
  }

  const removalPlan: DuplicatePropertyRemoval[] = [];

  for (const group of duplicateGroups) {
    if (!group.typesMatch) {
      printManualReview(group);
      continue;
    }

    printDuplicateGroup(group);

    const keptPropertyName = await select({
      message: "Choose property to keep:",
      choices: group.properties.map((property, index) => ({
        name: `[${index + 1}] ${property.propertyName}`,
        value: property.propertyName
      }))
    });

    removalPlan.push(
      ...createDuplicateRemovalPlan(group, keptPropertyName)
    );
  }

  if (removalPlan.length === 0) {
    console.log("No safe changes are available.");
    return;
  }

  printPreview(removalPlan);

  const shouldApply = await confirm({
    message: "Apply changes?",
    default: false
  });

  if (!shouldApply) {
    console.log("\nChanges cancelled. No files were modified.");
    return;
  }

  applyDuplicateRemovalPlan(removalPlan);

  const changedFiles = new Map(
    removalPlan.map((removal) => [
      removal.filePath,
      removal.declaration.getSourceFile()
    ])
  );

  await Promise.all(
    [...changedFiles.values()].map((sourceFile) => sourceFile.save())
  );

  console.log("\nChanges applied successfully.");
}

export function registerDupsCommand(program: Command): void {
  program
    .command("dups")
    .description("Find and repair duplicate concepts in interfaces")
    .action(runDuplicateRepair);
}