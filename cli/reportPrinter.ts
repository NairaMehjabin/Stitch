import { relative } from "node:path";
import { NamingDriftGroup } from "@scanner/driftDetector";
import { normalizePath } from "@utils/normalizePath";

function displayPath(filePath: string): string {
  return normalizePath(relative(process.cwd(), filePath));
}

export function printShortReport(groups: NamingDriftGroup[]): void {
  console.log("🧵 Stitch Report\n");

  if (groups.length === 0) {
    console.log("No potential naming drift found.");
    return;
  }

  console.log("Potential Naming Drift\n");

  for (const group of groups) {
    console.log(group.variants.join(" / "));
    console.log("");

    for (const occurrence of group.occurrences) {
      console.log(`${displayPath(occurrence.filePath)}:${occurrence.lineNumber}`);
    }

    console.log("\n--------------------------------\n");
  }

  console.log(`${groups.length} drift group${groups.length === 1 ? "" : "s"} found.`);
}

export function printVerboseReport(groups: NamingDriftGroup[]): void {
  console.log("🧵 Stitch Detailed Report\n");

  if (groups.length === 0) {
    console.log("No potential naming drift found.");
    return;
  }

  for (const [index, group] of groups.entries()) {
    console.log(`Group #${index + 1}\n`);

    console.log("Variants:");
    for (const variant of group.variants) {
      console.log(`- ${variant}`);
    }

    console.log("\nOccurrences:\n");

    for (const occurrence of group.occurrences) {
      console.log(
        `${displayPath(occurrence.filePath)}:${occurrence.lineNumber}\n`
      );
      console.log(`Interface:\n${occurrence.interfaceName}\n`);
      console.log(`Property:\n${occurrence.propertyName}\n`);
    }

    console.log("--------------------------------\n");
  }

  console.log(`${groups.length} drift group${groups.length === 1 ? "" : "s"} found.`);
}