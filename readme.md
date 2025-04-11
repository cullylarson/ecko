![Ecko](./docs/ecko.png)

> Mock any API for testing and development.

Most testing libraries offer the ability to mock external requests. But what if
your tests are running on a client and you need to mock requests that the server
is making? Or what if you're testing a CLI script by executing it and you need
to mock requests that the script makes?

Ecko is an http server that allows you to register endpoints and responses, and
then any requests made to those endpoints will return the responses you defined.
This essentially lets you mock any third-party service in a way that can be used
by code running in any context in your tests.

## Contributing

See the the [Contributing](./contributing.md) doc for how to contribute.

## Install

```bash
npm install ecko
```

## Release

```bash
npm run local-release
```

## Examples

- [Mocking the Stripe API](./tests/stripe-example.test.ts)
- [Testing with ecko](./tests/all.test.ts)

## How does it work?

### Setup the server

```tsx
import { EckoServer, type EckoApi } from "../src/index.js";

const PORT = 3005;

let ecko: EckoApi;
let eckoServer: EckoServer;
let baseUrl: string;

beforeAll(() => {
  eckoServer = EckoServer();

  const startResult = eckoServer.start({ port: PORT, logLevel: "error" });

  ecko = startResult.ecko;
  baseUrl = startResult.baseUrl;
});

afterEach(() => {
  eckoServer.reset();
});

afterAll(() => {
  eckoServer.stop();
});
```

This will start Ecko on port 3005. The `eckoServer.start` will also give you
`ecko` which is what you'll use to register responses and `baseUrl` which is the
base URL that ecko is running on (e.g. `http://localhost:3005`).

### Register endpoints

```tsx
ecko.register("/test/endpoint", "get", {
  frequency: "always",
  payload: "Response from request",
});

ecko.register("/test/endpoint", "get", {
  frequency: "once",
  payload: "Response from request",
});

ecko.register("/test/endpoint", "get", {
  frequency: { type: "limit", limit: 5 },
  payload: "Response from request",
});

ecko.register("/test/endpoint", "put", {
  frequency: "always",
  status: 500,
  headers: { "x-my-header": "VALUE" },
  payload: { orderId: "1234" },
  beforeResponse: async ({ method, headers, queryParams, body }) => {},
  afterResponse: async ({ method, headers, queryParams, body }) => {},
});

ecko.register("/test/endpoint", "post", {
  frequency: "always",
  getResponse: async ({ method, headers, queryParams, body }) => {
    return {
      status: 202,
      headers: { "x-my-header": "VALUE" },
      payload: { orderId: "1234" },
      beforeResponse: async (args) => {},
      afterResponse: async (args) => {},
    };
  },
});
```

Calling `ecko.register` will register an endpoint. You specific the path, the
method, the frequency, and the payload. When that endpoint is called, it will
respond with the payload provided.

Endpoints are registered in a stack. So if you have a `frequency: "once"`
before a `"frequency: "all"`, the first call to the endpoint will return the
with `frequency: "once"` and then all subsequence calls will return the response
with `frequency: "all"`.

Same if you have multiple endpoints with the same path and method and each with
`frequency: "all"`. The last endpoint registered will always be returned.

#### `ecko.register` arguments

- `path`: The path of the endpoint.
- `method`: `get`, `post`, `put`, `delete`, etc (all methods are supported).
- `options`:
  - `frequency` (_required_):
    - `always`: Return this response every time.
    - `once`: Return this response once.
    - `{type: "limit", limit: 5}`. Return this response five times.
  - `headers` (_optional_). An object where the keys are the name of the
    headers. These headers will be returned in the response exactly as provided.
  - `status` (_optional_). And HTTP status integer.
  - `payload` (_optional_). The response body. This can be anything.
  - `beforeResponse` (_optional_). An async function that will be called before
    a response is returned from the endpoint. The function accepts and object
    with these arguments:
    - `method`. The lower-case version of the method (e.g. `get`, `post`, etc).
    - `headers`. The headers of the request. Note that all the keys will be lower-case.
    - `queryParams`. Key-value pair of all query params.
    - `body`. The request body. Note that this will be an object if the request
      was body was sent as JSON.
  - `afterResponse` (_optional_). A function that will be called after a
    response is returned from the endpoint.
- Instead of the `options` arguments above, you can instead provide:
  - `frequency`. Same values as above.
  - `getResponse`. An async function that takes the arguments defined above for
    `beforeResponse` and returns an object with these properties (see options
    above for descriptions):
    - `headers` (_optional_).
    - `status` (_optional_).
    - `payload` (_optional_).
    - `beforeResponse` (_optional_).
    - `afterResponse` (_optional_).
