import { Project, PropertySignature } from "ts-morph";
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

export function detectNamingDrift(project: Project): NamingDriftGroup[] {
  const groups = new Map<string, PropertyOccurrence[]>();

  for (const sourceFile of project.getSourceFiles()) {
    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      for (const property of interfaceDeclaration.getProperties()) {
        const occurrence: PropertyOccurrence = {
          propertyName: property.getName(),
          interfaceName: interfaceDeclaration.getName(),
          filePath: sourceFile.getFilePath(),
          lineNumber: property.getStartLineNumber(),
          declaration: property
        };

        const normalizedName = normalizeProperty(occurrence.propertyName);
        const existingOccurrences = groups.get(normalizedName) ?? [];

        existingOccurrences.push(occurrence);
        groups.set(normalizedName, existingOccurrences);
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