import { relative } from "node:path";
import { Command } from "commander";
import {
  detectDuplicateConcepts,
  DuplicateConceptGroup
} from "../scanner/duplicateConceptDetector";
import {
  discoverTypeScriptFiles,
  loadStitchConfig
} from "../scanner/fileLoader";
import { loadProject } from "../scanner/projectLoader";
import { normalizePath } from "../utils/normalizePath";

function displayPath(filePath: string): string {
  return normalizePath(relative(process.cwd(), filePath));
}

function printDuplicateGroup(
  group: DuplicateConceptGroup,
  index: number
): void {
  if (index > 0) {
    console.log("--------------------------------\n");
  }

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

export function registerDupsCommand(program: Command): void {
  program
    .command("dups")
    .description("Detect duplicate concepts in interfaces")
    .action(() => {
      const config = loadStitchConfig();
      const filePaths = discoverTypeScriptFiles(config);
      const project = loadProject(filePaths);
      const duplicateGroups = detectDuplicateConcepts(project);

      if (duplicateGroups.length === 0) {
        console.log("No duplicate concepts found.");
        return;
      }

      duplicateGroups.forEach(printDuplicateGroup);

      console.log(
        `${duplicateGroups.length} duplicate concept group${
          duplicateGroups.length === 1 ? "" : "s"
        } found.`
      );

      console.log("\nRun:");
      console.log("npm run fix -- dups");
      console.log("\nto repair duplicate concepts.");
    });
}