import { createApp } from "./app";
await createApp().listen({
  host: "0.0.0.0",
  port: Number(process.env.PORT ?? 3001),
});
