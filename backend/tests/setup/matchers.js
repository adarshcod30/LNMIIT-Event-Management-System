// Custom matchers keep API assertions readable:
//   expect(res).toBeApiSuccess(201)
//   expect(res).toBeApiError(403, /Access denied/)
expect.extend({
  toBeApiSuccess(res, status = 200) {
    const pass = res.status === status && res.body && res.body.success === true;
    return {
      pass,
      message: () =>
        `expected a success response with status ${status}, got ${res.status} ${JSON.stringify(res.body)}`,
    };
  },
  toBeApiError(res, status, pattern) {
    const matchesText = pattern === undefined || pattern.test(String(res.body && res.body.error));
    const pass = res.status === status && res.body && res.body.success === false && matchesText;
    return {
      pass,
      message: () =>
        `expected an error response with status ${status}${pattern ? ` matching ${pattern}` : ''}, got ${res.status} ${JSON.stringify(res.body)}`,
    };
  },
});
