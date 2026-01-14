import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { expenseRoutes } from "./routes/expenses";
import { groupRoutes } from "./routes/groups";
import { notificationRoutes } from "./routes/notifications";

const app = new Elysia()
    .use(cors())
    .get("/", () => ({ message: "Spendbee API" }))
    .use(authRoutes)
    .use(groupRoutes)
    .use(expenseRoutes)
    .use(notificationRoutes)
    .listen(3000);

console.log(`Spendbee backend is running at ${app.server?.hostname}:${app.server?.port}`);
