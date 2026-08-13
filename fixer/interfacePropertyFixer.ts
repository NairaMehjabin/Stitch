import {
  InterfaceDeclaration,
  PropertySignature,
  SyntaxKind
} from "ts-morph";
import { NamingDriftGroup } from "@scanner/driftDetector";

export interface CanonicalSelection {
  group: NamingDriftGroup;
  canonicalName: string;
}

export interface PropertyRename {
  declaration: PropertySignature;
  filePath: string;
  lineNumber: number;
  oldName: string;
  newName: string;
}

export function createRenamePlan(
  selections: CanonicalSelection[]
): PropertyRename[] {
  const plannedNames = new Map<PropertySignature, string>();
  const affectedInterfaces = new Set<InterfaceDeclaration>();

  for (const selection of selections) {
    if (!selection.group.variants.includes(selection.canonicalName)) {
      throw new Error("The selected canonical name must be a detected variant.");
    }

    for (const occurrence of selection.group.occurrences) {
      if (occurrence.propertyName === selection.canonicalName) {
        continue;
      }

      plannedNames.set(occurrence.declaration, selection.canonicalName);

      affectedInterfaces.add(
        occurrence.declaration.getParentIfKindOrThrow(
          SyntaxKind.InterfaceDeclaration
        )
      );
    }
  }

  for (const interfaceDeclaration of affectedInterfaces) {
    const finalNames = new Set<string>();

    for (const property of interfaceDeclaration.getProperties()) {
      const finalName = plannedNames.get(property) ?? property.getName();

      if (finalNames.has(finalName)) {
        throw new Error(
          `Cannot safely rename properties in interface "${interfaceDeclaration.getName()}" because it would create duplicate property names.`
        );
      }

      finalNames.add(finalName);
    }
  }

  return [...plannedNames.entries()].map(([declaration, newName]) => ({
    declaration,
    filePath: declaration.getSourceFile().getFilePath(),
    lineNumber: declaration.getStartLineNumber(),
    oldName: declaration.getName(),
    newName
  }));
}

export function applyRenamePlan(renamePlan: PropertyRename[]): void {
  for (const rename of renamePlan) {
    rename.declaration.set({
      name: rename.newName
    });
  }
}