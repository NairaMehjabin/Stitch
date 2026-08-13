import { confirm, select } from "@inquirer/prompts";
import { relative } from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import {
  applyDuplicateRepairPlan,
  createDuplicateRepairPlan,
  DuplicateRepairPlan
} from "../fixer/duplicatePropertyFixer";
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
import { normalizeProperty } from "../utils/normalizeProperty";

interface VariantUsage {
  propertyName: string;
  count: number;
}

interface DuplicateSelection {
  canonicalName: string;
  recommendedPropertyName?: string;
}

function displayPath(filePath: string): string {
  return normalizePath(relative(process.cwd(), filePath));
}

function getProjectVariants(
  project: Project,
  group: DuplicateConceptGroup
): VariantUsage[] {
  const usageCounts = new Map<string, number>();

  for (const sourceFile of project.getSourceFiles()) {
    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      for (const property of interfaceDeclaration.getProperties()) {
        if (normalizeProperty(property.getName()) !== group.normalizedName) {
          continue;
        }

        usageCounts.set(
          property.getName(),
          (usageCounts.get(property.getName()) ?? 0) + 1
        );
      }
    }
  }

  return [...usageCounts.entries()]
    .map(([propertyName, count]) => ({ propertyName, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.propertyName.localeCompare(right.propertyName)
    );
}

function getRecommendedProperty(
  variants: VariantUsage[]
): string | undefined {
  const highestCount = variants[0]?.count;

  if (highestCount === undefined) {
    return undefined;
  }

  const mostUsedVariants = variants.filter(
    (variant) => variant.count === highestCount
  );

  return mostUsedVariants.length === 1
    ? mostUsedVariants[0].propertyName
    : undefined;
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
}

function printManualReview(group: DuplicateConceptGroup): void {
  console.log("\n⚠ Manual Review Required\n");
  console.log(
    "Properties normalize to the same concept but have different types.\n"
  );

  for (const property of group.properties) {
    console.log(`${property.propertyName}: ${property.typeText}`);
  }

  console.log("\nNo automatic fix available.\n");
}

function getKeptPreviewText(plan: DuplicateRepairPlan): string {
  const declaration = plan.keptDeclaration;
  const isReadonly = declaration
    .getModifiers()
    .some((modifier) => modifier.getKind() === SyntaxKind.ReadonlyKeyword);

  const optionalMarker = declaration.hasQuestionToken() ? "?" : "";
  const typeText = declaration.getTypeNode()?.getText() ?? "unknown";

  return `${isReadonly ? "readonly " : ""}${plan.canonicalName}${optionalMarker}: ${typeText};`;
}

function printPreview(repairPlans: DuplicateRepairPlan[]): void {
  console.log("\nPreview Changes\n");

  for (const plan of repairPlans) {
    if (plan.oldKeptName !== plan.canonicalName) {
      console.log(`${displayPath(plan.keptFilePath)}:${plan.keptLineNumber}\n`);
      console.log("RENAME:");
      console.log(`${plan.oldKeptName} → ${plan.canonicalName}\n`);
    }

    for (const removal of plan.removals) {
      console.log(`${displayPath(removal.filePath)}:${removal.lineNumber}\n`);
      console.log("DELETE:");
      console.log(`${removal.propertyText}\n`);
    }

    console.log("KEEP:");
    console.log(`${getKeptPreviewText(plan)}\n`);
  }

  const affectedFiles = new Set<string>();

  for (const plan of repairPlans) {
    affectedFiles.add(plan.keptFilePath);

    for (const removal of plan.removals) {
      affectedFiles.add(removal.filePath);
    }
  }

  const deletionCount = repairPlans.reduce(
    (total, plan) => total + plan.removals.length,
    0
  );

  const renameCount = repairPlans.filter(
    (plan) => plan.oldKeptName !== plan.canonicalName
  ).length;

  console.log(`Renames: ${renameCount}`);
  console.log(
    `${deletionCount} propert${deletionCount === 1 ? "y" : "ies"} will be removed.`
  );
  console.log(`Affected files: ${affectedFiles.size}`);
}

function printNamingDriftWarning(selections: DuplicateSelection[]): void {
  const nonRecommendedSelections = selections.filter(
    (selection) =>
      selection.recommendedPropertyName &&
      selection.canonicalName !== selection.recommendedPropertyName
  );

  for (const selection of nonRecommendedSelections) {
    console.log("\n⚠ Naming Drift Warning\n");
    console.log(
      `Keeping "${selection.canonicalName}" may create naming inconsistencies.\n`
    );
    console.log("Run:");
    console.log("npm run scan");
    console.log("\nto diagnose naming drift.");
  }
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

  const selections: DuplicateSelection[] = [];
  const repairPlans: DuplicateRepairPlan[] = [];

  for (const group of duplicateGroups) {
    printDuplicateGroup(group);

    if (!group.typesMatch) {
      printManualReview(group);
      continue;
    }

    const variants = getProjectVariants(project, group);
    const recommendedPropertyName = getRecommendedProperty(variants);

    console.log(
      "\nThese properties appear to represent the same concept inside the same interface.\n"
    );

    if (recommendedPropertyName) {
      console.log(`Recommended: ${recommendedPropertyName}`);
      console.log("Reason: Most used across the project.\n");
    }

    const canonicalName = await select({
      message: "Choose canonical name:",
      choices: variants.map((variant, index) => ({
        name: `[${index + 1}] ${variant.propertyName}${
          variant.propertyName === recommendedPropertyName
            ? " (recommended)"
            : ""
        }`,
        value: variant.propertyName
      }))
    });

    try {
      const repairPlan = createDuplicateRepairPlan(group, canonicalName);

      selections.push({
        canonicalName,
        recommendedPropertyName
      });

      repairPlans.push(repairPlan);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create a safe duplicate repair plan.";

      console.log(`\nRepair skipped: ${message}\n`);
    }
  }

  if (repairPlans.length === 0) {
    console.log("No safe changes are available.");
    return;
  }

  printPreview(repairPlans);
  printNamingDriftWarning(selections);

  const shouldApply = await confirm({
    message: "Apply changes?",
    default: false
  });

  if (!shouldApply) {
    console.log("\nChanges cancelled. No files were modified.");
    return;
  }

  for (const plan of repairPlans) {
    applyDuplicateRepairPlan(plan);
  }

  const changedFiles = new Map(
    repairPlans.map((plan) => [
      plan.keptFilePath,
      plan.keptDeclaration.getSourceFile()
    ])
  );

  for (const plan of repairPlans) {
    for (const removal of plan.removals) {
      changedFiles.set(
        removal.filePath,
        removal.declaration.getSourceFile()
      );
    }
  }

  await Promise.all(
    [...changedFiles.values()].map((sourceFile) => sourceFile.save())
  );

  console.log("\n✔ Changes applied successfully.");
}