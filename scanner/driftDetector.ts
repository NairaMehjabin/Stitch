import { Project, PropertySignature } from "ts-morph";
import { detectDuplicateConcepts } from "../scanner/duplicateConceptDetector";
import { normalizeProperty } from "../utils/normalizeProperty";

export interface PropertyOccurrence {
  propertyName: string;
  interfaceName: string;
  filePath: string;
  lineNumber: number;
  declaration: PropertySignature;
}

export interface NamingDriftGroup {
  normalizedName: string;
  variants: string[];
  occurrences: PropertyOccurrence[];
}

function getPropertyKey(property: PropertySignature): string {
  return `${property.getSourceFile().getFilePath()}:${property.getStart()}`;
}

export function detectNamingDrift(project: Project): NamingDriftGroup[] {
  const duplicatePropertyKeys = new Set(
    detectDuplicateConcepts(project)
      .flatMap((group) => group.properties)
      .map((property) => getPropertyKey(property.declaration))
  );

  const groups = new Map<string, PropertyOccurrence[]>();

  for (const sourceFile of project.getSourceFiles()) {
    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      for (const property of interfaceDeclaration.getProperties()) {
        // Only same-interface duplicate declarations are excluded.
        if (duplicatePropertyKeys.has(getPropertyKey(property))) {
          continue;
        }

        const occurrence: PropertyOccurrence = {
          propertyName: property.getName(),
          interfaceName: interfaceDeclaration.getName(),
          filePath: sourceFile.getFilePath(),
          lineNumber: property.getStartLineNumber(),
          declaration: property
        };

        const normalizedName = normalizeProperty(occurrence.propertyName);
        const occurrences = groups.get(normalizedName) ?? [];

        occurrences.push(occurrence);
        groups.set(normalizedName, occurrences);
      }
    }
  }

  return [...groups.entries()]
    .map(([normalizedName, occurrences]) => ({
      normalizedName,
      variants: [...new Set(occurrences.map((item) => item.propertyName))],
      occurrences
    }))
    .filter((group) => group.variants.length > 1);
}