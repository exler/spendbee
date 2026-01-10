import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { groupRoutes } from "./routes/groups";
import { expenseRoutes } from "./routes/expenses";
import { mockUserRoutes } from "./routes/mockUsers";

const app = new Elysia()
  .use(cors())
  .get("/", () => ({ message: "Spendbee API" }))
  .use(authRoutes)
  .use(groupRoutes)
  .use(expenseRoutes)
  .use(mockUserRoutes)
  .listen(3000);

console.log(
  `🐝 Spendbee backend is running at ${app.server?.hostname}:${app.server?.port}`
);
