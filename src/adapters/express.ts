import { type Request } from "express";
import type { CallbackPayload, LowerCaseRequestMethod } from "../database.js";

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>
): CallbackPayload["headers"] {
  const headerEntries = Object.entries(headers).map(([key, value]) => {
    return [key.toLowerCase(), value] as const;
  });

  return new Map(headerEntries);
}

function getBody(req: Request): any {
  if (req.body === undefined) {
    return undefined;
  } else if (req.headers["content-type"]?.includes("application/json")) {
    return JSON.parse(req.body);
  } else {
    return req.body;
  }
}

export function getCallbackPayload(req: Request): CallbackPayload {
  return {
    method: req.method.toLowerCase() as LowerCaseRequestMethod,
    headers: normalizeHeaders(req.headers),
    queryParams: req.query,
    textBody: req.body,
    body: getBody(req),
  };
}
