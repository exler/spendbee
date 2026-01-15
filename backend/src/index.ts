import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { expenseRoutes } from "./routes/expenses";
import { groupRoutes } from "./routes/groups";
import { notificationRoutes } from "./routes/notifications";

const app = new Elysia()
    .use(cors())
    .use(staticPlugin({ assets: "uploads", prefix: "/uploads" }))
    .get("/", () => ({ message: "Spendbee API" }))
    .use(authRoutes)
    .use(groupRoutes)
    .use(expenseRoutes)
    .use(notificationRoutes)
    .listen(3000);

console.log(`Spendbee backend is running at ${app.server?.hostname}:${app.server?.port}`);
