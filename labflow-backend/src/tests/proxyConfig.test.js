const { parseTrustProxy } = require("../config/proxyConfig");

describe("proxy configuration", () => {
  test("does not trust proxies by default outside production", () => {
    expect(
      parseTrustProxy({
        nodeEnv: "development",
      }),
    ).toBe(false);
  });

  test("trusts one proxy by default in production", () => {
    expect(
      parseTrustProxy({
        nodeEnv: "production",
      }),
    ).toBe(1);
  });

  test("supports explicitly disabling proxy trust", () => {
    expect(
      parseTrustProxy({
        nodeEnv: "production",
        value: "false",
      }),
    ).toBe(false);
  });

  test("supports trusting all proxies explicitly", () => {
    expect(
      parseTrustProxy({
        nodeEnv: "production",
        value: "true",
      }),
    ).toBe(true);
  });

  test("supports an explicit positive proxy hop count", () => {
    expect(
      parseTrustProxy({
        nodeEnv: "production",
        value: "2",
      }),
    ).toBe(2);
  });

  test("rejects zero as a proxy hop count", () => {
    expect(() =>
      parseTrustProxy({
        nodeEnv: "production",
        value: "0",
      }),
    ).toThrow("TRUST_PROXY must be true, false, or a positive integer.");
  });

  test("rejects an unsupported proxy configuration", () => {
    expect(() =>
      parseTrustProxy({
        nodeEnv: "production",
        value: "maybe",
      }),
    ).toThrow("TRUST_PROXY must be true, false, or a positive integer.");
  });
});
