import type { Page, Request } from "@playwright/test";

// Capture the real UI request so replays use the current Next.js action identifier
// and encoding. Never persist request headers or authenticated session cookies.
export function nextActionRequest(page: Page) {
  return page.waitForRequest((request) =>
    request.method() === "POST" && Boolean(request.headers()["next-action"]),
  );
}

export async function replayAction(page: Page, request: Request, changes?: Record<string, unknown>) {
  const original = request.postData();
  if (!original) throw new Error("Expected a JSON encoded Server Action request.");
  const args = JSON.parse(original);
  if (!Array.isArray(args) || !args[0] || typeof args[0] !== "object") {
    throw new Error("Unexpected Server Action argument encoding.");
  }
  if (changes) Object.assign(args[0], changes);
  const headers = await request.allHeaders();
  for (const key of ["cookie", "host", "content-length", "connection"]) delete headers[key];
  const response = await page.request.post(request.url(), {
    headers, data: JSON.stringify(args),
  });
  if (!response.ok()) throw new Error(`Action replay returned HTTP ${response.status()}`);
  return response.text();
}
