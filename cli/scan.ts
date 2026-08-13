import { Command } from "commander";
import { detectDuplicateConcepts } from "../scanner/duplicateConceptDetector";
import { detectNamingDrift } from "../scanner/driftDetector";
import {
  discoverTypeScriptFiles,
  loadStitchConfig
} from "../scanner/fileLoader";
import { loadProject } from "../scanner/projectLoader";
import {
  printDuplicateConceptWarning,
  printShortReport,
  printVerboseReport
} from "./reportPrinter";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Report potential property naming drift")
    .option("-v, --verbose", "Show detailed drift occurrences")
    .action((options: { verbose: boolean }) => {
      const config = loadStitchConfig();
      const filePaths = discoverTypeScriptFiles(config);
      const project = loadProject(filePaths);

      const driftGroups = detectNamingDrift(project);
      const duplicateGroups = detectDuplicateConcepts(project);

      if (options.verbose) {
        printVerboseReport(driftGroups);
      } else {
        printShortReport(driftGroups);
      }

      printDuplicateConceptWarning(duplicateGroups.length);

      console.log("\nProject initialized successfully.");
    });
}