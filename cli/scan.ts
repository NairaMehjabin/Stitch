import { Command } from "commander";
import { detectNamingDrift } from "../scanner/driftDetector";
import { discoverTypeScriptFiles, loadStitchConfig } from "../scanner/fileLoader";
import { loadProject } from "../scanner/projectLoader";
import { printShortReport, printVerboseReport } from "./reportPrinter";

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

      if (options.verbose) {
        printVerboseReport(driftGroups);
      } else {
        printShortReport(driftGroups);
      }

      console.log("\nProject initialized successfully.");
    });
}