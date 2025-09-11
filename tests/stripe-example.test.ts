import { test, expect, afterAll, beforeAll, afterEach } from "vitest";
import { Stripe } from "stripe";
import { EckoServer, type EckoApi } from "../src/index.js";

const PORT = 3005;

let ecko: EckoApi;
let eckoServer: EckoServer;
let stripe: Stripe;

beforeAll(async () => {
  eckoServer = EckoServer();

  const startResult = await eckoServer.start({ port: PORT, logLevel: "error" });

  ecko = startResult.ecko;

  const url = new URL(startResult.baseUrl);

  stripe = new Stripe("does_not_matter", {
    apiVersion: "2025-02-24.acacia",
    host: url.hostname,
    port: url.port,
    protocol: "http",
  });
});

afterEach(async () => {
  await eckoServer.reset();
});

afterAll(() => {
  eckoServer.stop();
});

test("Should fetch a balance from the mocked Stripe API", async () => {
  ecko.register("/v1/balance", "get", {
    frequency: "always",
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    payload: JSON.stringify({
      object: "balance",
      available: [
        {
          amount: 666670,
          currency: "usd",
          source_types: {
            card: 666670,
          },
        },
      ],
      connect_reserved: [
        {
          amount: 0,
          currency: "usd",
        },
      ],
      livemode: false,
      pending: [
        {
          amount: 61414,
          currency: "usd",
          source_types: {
            card: 61414,
          },
        },
      ],
    }),
  });

  const balance = await stripe.balance.retrieve();

  expect(balance).toBeDefined();
  expect(balance.object).toBe("balance");
  expect(balance.available).toBeDefined();
  expect(balance.available[0].amount).toBe(666670);
  expect(balance.available[0].currency).toBe("usd");
  expect(balance?.available?.[0]?.source_types?.card).toBe(666670);
  expect(balance.connect_reserved).toBeDefined();
  expect(balance?.connect_reserved?.[0]?.amount).toBe(0);
  expect(balance?.connect_reserved?.[0]?.currency).toBe("usd");
});
