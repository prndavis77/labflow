jest.mock("../utils/errorLogger", () => ({
  logError: jest.fn(),
}));

const errorHandler = require("../middleware/errorHandler");
const { logError } = require("../utils/errorLogger");

describe("errorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("logs an unhandled error and returns a safe 500 response", () => {
    const error = new Error("Database exploded");

    const req = {
      requestId: "test-request-id",
      user: {
        id: 42,
        organizationId: 7,
      },
    };

    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    errorHandler(error, req, res, next);

    expect(logError).toHaveBeenCalledWith(error, {
      req,
      event: "unhandled_request_error",
      message: "Unhandled request error",
    });

    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "An unexpected error occurred.",
      requestId: "test-request-id",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("does not expose internal error details in the response", () => {
    const error = new Error(
      "password=secret DATABASE_URL=postgres://private-host/database",
    );

    const req = {
      requestId: "safe-response-test",
    };

    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    errorHandler(error, req, res, next);

    const responseBody = res.json.mock.calls[0][0];
    const serializedResponse = JSON.stringify(responseBody);

    expect(serializedResponse).not.toContain("password=secret");
    expect(serializedResponse).not.toContain("postgres://private-host");
    expect(serializedResponse).not.toContain(error.stack);
  });

  test("delegates to Express when response headers were already sent", () => {
    const error = new Error("Late request failure");

    const req = {
      requestId: "headers-sent-test",
    };

    const res = {
      headersSent: true,
      status: jest.fn(),
      json: jest.fn(),
    };

    const next = jest.fn();

    errorHandler(error, req, res, next);

    expect(logError).toHaveBeenCalledWith(error, {
      req,
      event: "unhandled_request_error",
      message: "Unhandled request error",
    });

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
