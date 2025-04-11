import { assertNever } from "./type-witchcraft.js";

export type ResponseFrequency =
  | "always"
  | "once"
  | {
      type: "limit";
      limit: number;
    };

export type CallbackPayload = {
  method: LowerCaseRequestMethod;
  /** They header key will always be lowercase. */
  headers: Map<string, string | string[] | undefined>;
  queryParams: Record<string, unknown>;
  body: any;
};

const lowercaseRequestMethods = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
  "connect",
] as const;

const uppercaseRequestMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "CONNECT",
] as const;

const requestMethods = [
  ...lowercaseRequestMethods,
  ...uppercaseRequestMethods,
] as const;

export type LowerCaseRequestMethod = (typeof lowercaseRequestMethods)[number];
export type UpperCaseRequestMethod = (typeof uppercaseRequestMethods)[number];
export type RequestMethod = (typeof requestMethods)[number];

export type EckoResponseSimple = {
  headers?: Record<string, string>;
  /** Assumed to default to 200. */
  status?: number;
  payload?: any;
  /** Called before the response is sent. */
  beforeResponse?: (args: CallbackPayload) => Promise<void>;
  /** Called after the response is sent. */
  afterResponse?: (args: CallbackPayload) => Promise<void>;
};

export type EckoResponse =
  | ({
      frequency: ResponseFrequency;
    } & EckoResponseSimple)
  | {
      frequency: ResponseFrequency;
      /** Dynamically generate the response. */
      getResponse: (args: CallbackPayload) => Promise<EckoResponseSimple>;
    };

export type Database = {
  responses: Map<
    string,
    /**
     * Responses are a stack. The latest will be used. If it's a "once" or a
     * "limit" where the limit has been reached, it will be removed from the stack and
     * the next response will be used on the next call. In this way, you can build up
     * responses for a route and they will be used in order.
     */
    EckoResponse[]
  >;
};

function getQueryParamsKey(queryParams: Record<string, unknown>): string {
  const sortedQueryParams = Object.fromEntries(
    Object.entries(queryParams).sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB)
    )
  );

  return JSON.stringify(sortedQueryParams);
}

function getDatabaseKey(route: Route, method: RequestMethod) {
  const path = typeof route === "string" ? route : route.path;

  const pathKey = `${normalizeRoutePath(path)}:${method.toLowerCase()}`;

  if (typeof route === "string") {
    return pathKey;
  } else {
    return `${pathKey}:${getQueryParamsKey(route.queryParams)}`;
  }
}

export function guardRequestMethod(method: string): RequestMethod {
  if (requestMethods.includes(method as RequestMethod)) {
    return method.toLowerCase() as RequestMethod;
  } else {
    throw new Error(`Invalid request method: ${method}`);
  }
}

export function createDatabase(): Database {
  return {
    responses: new Map(),
  };
}

function getRouteResponses(
  database: Database,
  route: Route,
  method: RequestMethod
) {
  if (typeof route === "string") {
    return database.responses.get(getDatabaseKey(route, method)) ?? [];
  } else {
    // first check if there's an exact match with the query params
    const responsesWithQuery = database.responses.get(
      getDatabaseKey(route, method)
    );

    if (responsesWithQuery) {
      return responsesWithQuery;
    } else {
      // if there's no exact match, check if there's a match without query params
      return database.responses.get(getDatabaseKey(route.path, method)) ?? [];
    }
  }
}

function setRouteResponses(
  database: Database,
  route: Route,
  method: RequestMethod,
  responses: EckoResponse[]
) {
  database.responses.set(getDatabaseKey(route, method), responses);
}

function getIsAlways(frequency: ResponseFrequency): frequency is "always" {
  return typeof frequency === "string" && frequency === "always";
}

function getIsOnce(frequency: ResponseFrequency): frequency is "once" {
  return typeof frequency === "string" && frequency === "once";
}

function getIsLimit(frequency: ResponseFrequency): frequency is {
  type: "limit";
  limit: number;
} {
  return typeof frequency === "object" && frequency.type === "limit";
}

type Route = string | { path: string; queryParams: Record<string, unknown> };

function getRouteFromString(routeString: string): Route {
  const bits = routeString.split("?");
  const path = bits[0] ?? "";
  const queryParamsString = bits[1] ?? "";

  const queryParams = new URLSearchParams(queryParamsString);

  if (queryParams.size === 0) {
    return path;
  } else {
    return { path, queryParams: Object.fromEntries(queryParams.entries()) };
  }
}

export function addResponse(
  database: Database,
  routeStr: string,
  method: RequestMethod,
  response: EckoResponse
) {
  const route = getRouteFromString(routeStr);

  let routeResponses = [...getRouteResponses(database, route, method)];

  // it doesn't make sense to have more than one "always" response
  if (getIsAlways(response.frequency)) {
    // remove all other "always" responses
    routeResponses = routeResponses.filter((x) => !getIsAlways(x.frequency));
  }

  routeResponses.push(response);

  setRouteResponses(database, route, method, routeResponses);
}

export function normalizeRoutePath(routePath: string) {
  // make sure the route starts with a slash
  return (
    (routePath.startsWith("/") ? routePath : `/${routePath}`)
      // remove trailing slash
      .replace(/\/$/, "")
  );
}

export function getResponse(
  database: Database,
  route: Route,
  method: RequestMethod
) {
  const routeResponses = getRouteResponses(database, route, method);

  const response = routeResponses[routeResponses.length - 1];

  if (!response) {
    return undefined;
  }

  if (getIsAlways(response.frequency)) {
    return response;
  } else if (getIsOnce(response.frequency)) {
    // remove the response from the route responses
    routeResponses.pop();
    setRouteResponses(database, route, method, routeResponses);

    return response;
  } else if (getIsLimit(response.frequency)) {
    response.frequency.limit--;

    if (response.frequency.limit <= 0) {
      // no responses left for this one, remove it from the route responses
      routeResponses.pop();
      setRouteResponses(database, route, method, routeResponses);
    }

    return response;
  } else {
    assertNever(response.frequency);
  }
}
