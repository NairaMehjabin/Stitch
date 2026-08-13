import { PropertySignature } from "ts-morph";
import { DuplicateConceptGroup } from "../scanner/duplicateConceptDetector";

export interface DuplicatePropertyRemoval {
  declaration: PropertySignature;
  filePath: string;
  lineNumber: number;
  propertyName: string;
  propertyText: string;
  keptPropertyName: string;
  keptPropertyText: string;
}

export function createDuplicateRemovalPlan(
  group: DuplicateConceptGroup,
  keptPropertyName: string
): DuplicatePropertyRemoval[] {
  if (!group.typesMatch) {
    throw new Error(
      "Cannot remove duplicate properties because their types are different."
    );
  }

  const keptProperty = group.properties.find(
    (property) => property.propertyName === keptPropertyName
  );

  if (!keptProperty) {
    throw new Error("The property selected to keep is not in this group.");
  }

  return group.properties
    .filter((property) => property.propertyName !== keptPropertyName)
    .map((property) => ({
      declaration: property.declaration,
      filePath: property.filePath,
      lineNumber: property.lineNumber,
      propertyName: property.propertyName,
      propertyText: property.propertyText,
      keptPropertyName,
      keptPropertyText: keptProperty.propertyText
    }));
}

export function applyDuplicateRemovalPlan(
  removalPlan: DuplicatePropertyRemoval[]
): void {
  for (const removal of removalPlan) {
    removal.declaration.remove();
  }
}