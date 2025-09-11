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
