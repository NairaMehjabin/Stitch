import { InterfaceDeclaration } from "ts-morph";

export function collectPropertyNames(
  interfaceDeclaration: InterfaceDeclaration
): string[] {
  return interfaceDeclaration
    .getProperties()
    .map((propertySignature) => propertySignature.getName());
}