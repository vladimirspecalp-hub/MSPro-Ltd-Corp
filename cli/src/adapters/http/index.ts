import type { CLIAdapterModule } from "@msproltd/adapter-utils";
import { printHttpStdoutEvent } from "./format-event.js";

export const httpCLIAdapter: CLIAdapterModule = {
  type: "http",
  formatStdoutEvent: printHttpStdoutEvent,
};
