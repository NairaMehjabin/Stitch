import { PropertySignature } from "ts-morph";
import { DuplicateConceptGroup } from "../scanner/duplicateConceptDetector";
import { normalizeProperty } from "../utils/normalizeProperty";

export interface DuplicatePropertyRemoval {
  declaration: PropertySignature;
  filePath: string;
  lineNumber: number;
  propertyText: string;
}

export interface DuplicateRepairPlan {
  canonicalName: string;
  keptDeclaration: PropertySignature;
  keptFilePath: string;
  keptLineNumber: number;
  oldKeptName: string;
  removals: DuplicatePropertyRemoval[];
}

function getPropertyKey(property: PropertySignature): string {
  return `${property.getSourceFile().getFilePath()}:${property.getStart()}`;
}

export function createDuplicateRepairPlan(
  group: DuplicateConceptGroup,
  canonicalName: string
): DuplicateRepairPlan {
  if (!group.typesMatch) {
    throw new Error(
      "Cannot repair duplicate properties because their types are different."
    );
  }

  if (normalizeProperty(canonicalName) !== group.normalizedName) {
    throw new Error(
      "The selected canonical name does not match this duplicate concept."
    );
  }

  const duplicatePropertyKeys = new Set(
    group.properties.map((property) => getPropertyKey(property.declaration))
  );

  const conflictingProperty = group.interfaceDeclaration
    .getProperties()
    .find(
      (property) =>
        property.getName() === canonicalName &&
        !duplicatePropertyKeys.has(getPropertyKey(property))
    );

  if (conflictingProperty) {
    throw new Error(
      `Cannot use "${canonicalName}" because it already exists separately in interface "${group.interfaceName}".`
    );
  }

  // Keep the first declaration. It is renamed through ts-morph if needed.
  const keptProperty = group.properties[0];

  return {
    canonicalName,
    keptDeclaration: keptProperty.declaration,
    keptFilePath: keptProperty.filePath,
    keptLineNumber: keptProperty.lineNumber,
    oldKeptName: keptProperty.propertyName,
    removals: group.properties.slice(1).map((property) => ({
      declaration: property.declaration,
      filePath: property.filePath,
      lineNumber: property.lineNumber,
      propertyText: property.propertyText
    }))
  };
}

export function applyDuplicateRepairPlan(plan: DuplicateRepairPlan): void {
  // Remove siblings first. This avoids temporarily creating two declarations
  // with the same name if the canonical name is already in the duplicate group.
  for (const removal of plan.removals) {
    removal.declaration.remove();
  }

  if (plan.oldKeptName !== plan.canonicalName) {
    plan.keptDeclaration.set({
      name: plan.canonicalName
    });
  }
}