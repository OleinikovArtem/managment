export function safeRaidReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/raids") || value.startsWith("//"))
    return "/raids?view=calendar";
  try {
    const url = new URL(value, "http://local.invalid");
    if (
      url.origin !== "http://local.invalid" ||
      (url.pathname !== "/raids" && !url.pathname.startsWith("/raids/"))
    )
      return "/raids?view=calendar";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/raids?view=calendar";
  }
}

export function raidHrefWithReturnTo(path: string, returnTo: string) {
  return `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}
