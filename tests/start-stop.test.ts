import { expect, test } from "vitest";
import { EckoServer } from "../src/index.js";
import urlJoin from "url-join";

const PORT = 3005;

test("Should be able to start, stop, and start again", async () => {
  const eckoServer = EckoServer();

  await eckoServer.start({ port: PORT, logLevel: "error" });
  await eckoServer.stop();
  await eckoServer.start({ port: PORT, logLevel: "error" });
  await eckoServer.stop();
  await eckoServer.start({ port: PORT, logLevel: "error" });
  await eckoServer.stop();
});

test("Stopping the server should reset the database", async () => {
  const eckoServer = EckoServer();

  const { ecko, baseUrl } = await eckoServer.start({
    port: PORT,
    logLevel: "error",
  });

  ecko.register("/test/endpoint", "get", {
    frequency: "always",
    payload: "Response from request",
  });

  const response1 = await fetch(urlJoin(baseUrl, "/test/endpoint"));

  const body1 = await response1.text();

  expect(response1.status).toBe(200);
  expect(body1).toBe("Response from request");

  await eckoServer.stop();
  await eckoServer.start({ port: PORT, logLevel: "error" });

  const response2 = await fetch(urlJoin(baseUrl, "/test/endpoint"));

  expect(response2.status).toBe(404);

  await eckoServer.stop();
  await eckoServer.start({ port: PORT, logLevel: "error" });
  await eckoServer.stop();
});

test("Should be able to start multiple servers at once", async () => {
  const eckoServer1 = EckoServer();
  const eckoServer2 = EckoServer();

  const { ecko: ecko1, baseUrl: baseUrl1 } = await eckoServer1.start({
    port: PORT,
    logLevel: "error",
  });
  const { ecko: ecko2, baseUrl: baseUrl2 } = await eckoServer2.start({
    port: PORT + 1,
    logLevel: "error",
  });

  await eckoServer2.start({ port: PORT + 1, logLevel: "error" });

  ecko1.register("/test/endpoint", "get", {
    frequency: "always",
    payload: "Response from request 1",
  });

  ecko2.register("/test/endpoint", "get", {
    frequency: "always",
    payload: "Response from request 2",
  });

  const response1 = await fetch(urlJoin(baseUrl1, "/test/endpoint"));
  const body1 = await response1.text();

  expect(response1.status).toBe(200);
  expect(body1).toBe("Response from request 1");

  const response2 = await fetch(urlJoin(baseUrl2, "/test/endpoint"));
  const body2 = await response2.text();

  expect(response2.status).toBe(200);
  expect(body2).toBe("Response from request 2");

  await eckoServer1.stop();
  await eckoServer2.stop();
});
