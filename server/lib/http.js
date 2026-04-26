export class HttpError extends Error {
  constructor(status, code, message, data = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}

export function fail(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      ok: false,
      code: err.code,
      message: err.message,
      data: err.data,
    });
  }
  console.error(err);
  return res.status(500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'Unexpected server error',
  });
}
