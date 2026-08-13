import { InterfaceDeclaration, Project, PropertySignature } from "ts-morph";
import { normalizeProperty } from "../utils/normalizeProperty";

export interface DuplicateProperty {
  propertyName: string;
  propertyText: string;
  typeText: string;
  filePath: string;
  lineNumber: number;
  declaration: PropertySignature;
}

export interface DuplicateConceptGroup {
  interfaceName: string;
  interfaceDeclaration: InterfaceDeclaration;
  normalizedName: string;
  properties: DuplicateProperty[];
  typesMatch: boolean;
}

function getPropertyTypeText(property: PropertySignature): string {
  return property.getTypeNode()?.getText() ?? "unknown";
}

export function detectDuplicateConcepts(
  project: Project
): DuplicateConceptGroup[] {
  const duplicateGroups: DuplicateConceptGroup[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      const groups = new Map<string, DuplicateProperty[]>();

      for (const property of interfaceDeclaration.getProperties()) {
        const normalizedName = normalizeProperty(property.getName());

        const duplicateProperty: DuplicateProperty = {
          propertyName: property.getName(),
          propertyText: property.getText(),
          typeText: getPropertyTypeText(property),
          filePath: sourceFile.getFilePath(),
          lineNumber: property.getStartLineNumber(),
          declaration: property
        };

        const properties = groups.get(normalizedName) ?? [];
        properties.push(duplicateProperty);
        groups.set(normalizedName, properties);
      }

      for (const [normalizedName, properties] of groups) {
        const propertyNames = new Set(
          properties.map((property) => property.propertyName)
        );

        if (propertyNames.size < 2) {
          continue;
        }

        const typesMatch = new Set(
          properties.map((property) => property.typeText)
        ).size === 1;

        duplicateGroups.push({
          interfaceName: interfaceDeclaration.getName(),
          interfaceDeclaration,
          normalizedName,
          properties,
          typesMatch
        });
      }
    }
  }

  return duplicateGroups;
}