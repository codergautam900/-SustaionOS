const test = require("node:test");
const assert = require("node:assert/strict");

const errorMiddleware = require("../middleware/error.middleware");

const createResponse = () => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };

  return response;
};

test("error middleware preserves request id and 4xx status", () => {
  const req = {
    requestId: "req_test_1",
    originalUrl: "/api/platform/team",
  };
  const res = createResponse();

  errorMiddleware({ statusCode: 403, message: "Forbidden area" }, req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, "Forbidden area");
  assert.equal(res.payload.requestId, "req_test_1");
});

test("error middleware masks 5xx messages but keeps request id", () => {
  const req = {
    requestId: "req_test_2",
    originalUrl: "/api/ai/query",
  };
  const res = createResponse();

  errorMiddleware(new Error("Low-level stack detail"), req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.error, "Server Error");
  assert.equal(res.payload.requestId, "req_test_2");
});
