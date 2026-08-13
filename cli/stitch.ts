#!/usr/bin/env node

import { Command } from "commander";
import { registerDupsCommand } from "./dups";
import { registerFixCommand } from "./fix";
import { registerScanCommand } from "./scan";

const program = new Command();

program
  .name("stitch")
  .description("A code consistency and repair tool");

registerScanCommand(program);
registerFixCommand(program);
registerDupsCommand(program);

program.parse();