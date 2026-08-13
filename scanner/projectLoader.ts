import { Project } from "ts-morph";

export function loadProject(filePaths: string[]): Project {
  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
    skipAddingFilesFromTsConfig: true
  });

  project.addSourceFilesAtPaths(filePaths);

  return project;
}