export async function withRetry(fn, { retries = 2, baseDelayMs = 400 } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === retries) break;
      const delay = baseDelayMs * 2 ** i;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
