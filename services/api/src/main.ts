import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { BigIntInterceptor } from "./bigint.interceptor.js";

const port = Number(process.env.PORT ?? 3000);

const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new BigIntInterceptor());
app.enableShutdownHooks();
await app.listen(port);
