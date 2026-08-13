import { InterfaceDeclaration, Project } from "ts-morph";

export function collectInterfaces(project: Project): InterfaceDeclaration[] {
  return project
    .getSourceFiles()
    .flatMap((sourceFile) => sourceFile.getInterfaces());
}