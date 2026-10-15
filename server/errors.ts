import { ZodError } from "zod";
export function publicError(e: any): { status: number; error: string } {
  if (e instanceof ZodError)
    return { status: 400, error: "Проверьте заполненные поля" };
  if (e.code === "P2002")
    return {
      status: 409,
      error: "Запись уже существует или награда уже получена",
    };
  if (e.code === "P2025") return { status: 404, error: "Запись не найдена" };
  if (e.code === "P2034")
    return {
      status: 503,
      error:
        "Конфликт параллельных операций. Повторите запрос с тем же ключом.",
    };
  if (e.code || e.name?.includes("Prisma")) {
    console.error("Database operation failed", { name: e.name, code: e.code });
    return {
      status: 503,
      error: "Сервис временно недоступен. Повторите запрос.",
    };
  }
  return { status: 400, error: e.message ?? "Ошибка запроса" };
}
