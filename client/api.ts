export async function api(path: string, data?: unknown, method?: string) {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    method: method ?? (data === undefined ? "GET" : "POST"),
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const out = await r.json();
  if (!r.ok) throw Error(out.error ?? "Ошибка соединения");
  return out;
}
