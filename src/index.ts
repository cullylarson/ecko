import express from "express";
import cors from "cors";
import {
  createDatabase,
  type ResponseFrequency,
  type EckoResponse,
  type EckoResponseSimple,
} from "./database.js";
import { Logger, type LogLevel } from "./log.js";
import { MockEndpoint } from "./endpoints/mock.js";
import { ConfigManager } from "./config.js";
import { EckoApi } from "./api.js";

export type { EckoApi, ResponseFrequency, EckoResponseSimple, EckoResponse };

export type StartOptions = {
  port: number;
  logLevel?: LogLevel;
};

function getStartReturn(
  configManager: ConfigManager,
  logger: Logger
): ReturnType<EckoServer["start"]> {
  return {
    ecko: EckoApi(configManager, logger),
    baseUrl: `http://localhost:${configManager.getConfig().port}`,
  };
}

function getStart(
  configManager: ConfigManager,
  logger: Logger
): EckoServer["start"] {
  return ({ port, logLevel = "info" }) => {
    if (configManager.getIsConfigured()) {
      // already started
      return getStartReturn(configManager, logger);
    }

    const app = express();

    app.use(cors());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.text({ type: "*/*" }));
    // app.use(express.json());

    app.all("*", MockEndpoint(configManager, logger));

    const server = app.listen(port);

    configManager.setConfig({
      port,
      logLevel,
      database: createDatabase(),
      server,
    });

    return getStartReturn(configManager, logger);
  };
}

function getStop(configManager: ConfigManager): EckoServer["stop"] {
  return () => {
    configManager.reset();
  };
}

/**
 * Reset the database to its initial state.
 */
function getReset(configManager: ConfigManager): EckoServer["reset"] {
  return () => {
    if (!configManager.getIsConfigured()) {
      // nothing to reset
      return;
    }

    configManager.setDatabase(createDatabase());
  };
}

export type EckoServer = {
  start: (options: StartOptions) => { ecko: EckoApi; baseUrl: string };
  stop: () => void;
  reset: () => void;
};

export function EckoServer(): EckoServer {
  const configManager = ConfigManager();
  const logger = Logger(configManager);

  return {
    start: getStart(configManager, logger),
    stop: getStop(configManager),
    reset: getReset(configManager),
  };
}
