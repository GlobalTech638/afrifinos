import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createPostgresClient } from "@afrifinos/financial-persistence";
import { AppModule } from "./app.module.js";
import { BigIntInterceptor } from "./bigint.interceptor.js";
import { migrateDatabase } from "./migrations.js";

const port = Number(process.env.PORT ?? 3000);
const migrationClient = createPostgresClient();

try {
  await migrateDatabase(migrationClient);
} finally {
  await migrationClient.close();
}

const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new BigIntInterceptor());
app.enableShutdownHooks();
await app.listen(port);
