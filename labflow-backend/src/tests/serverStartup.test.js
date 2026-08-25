const app = require("../server");
const { startServer } = require("../server");
const logger = require("../config/logger");

describe("server startup", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("starts the HTTP server even when the initial database connection fails", async () => {
    const fakeServer = {
      close: jest.fn(),
    };

    const listenSpy = jest
      .spyOn(app, "listen")
      .mockImplementation((port, callback) => {
        if (callback) {
          callback();
        }

        return fakeServer;
      });

    const connect = jest
      .fn()
      .mockRejectedValue(new Error("Test database unavailable"));

    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit must not be called");
    });

    const server = startServer({
      connect,
    });

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(server).toBe(fakeServer);

    expect(listenSpy).toHaveBeenCalledTimes(1);

    expect(connect).toHaveBeenCalledTimes(1);

    expect(exitSpy).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledWith(
      {
        event: "database_initial_connection_failed",
      },
      "Initial database connection failed. API remains live but not ready.",
    );
  });

  it("starts the HTTP server when the initial database connection succeeds", async () => {
    const fakeServer = {
      close: jest.fn(),
    };

    const listenSpy = jest
      .spyOn(app, "listen")
      .mockImplementation((port, callback) => {
        if (callback) {
          callback();
        }

        return fakeServer;
      });

    const connect = jest.fn().mockResolvedValue();

    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

    const server = startServer({
      connect,
    });

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(server).toBe(fakeServer);

    expect(listenSpy).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
