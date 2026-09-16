import { Module, Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PostgresFinancialRepository } from "@afrifinos/financial-persistence";
import { createPostgresClient } from "@afrifinos/financial-persistence";
import { HealthController } from "./health.controller.js";
import { AccountsController } from "./accounts.controller.js";
import { TransactionsController } from "./transactions.controller.js";
import { FinancialController } from "./financial.controller.js";
import { AffordabilityController } from "./affordability.controller.js";
import { ImportsController } from "./imports.controller.js";
import { ApiFinancialService } from "./api-financial.service.js";
import { JwtAuthGuard } from "./auth-context.js";

export const FINANCIAL_REPOSITORY = Symbol("FINANCIAL_REPOSITORY");
export const POSTGRES_CLIENT = Symbol("POSTGRES_CLIENT");

const postgresClientProvider: Provider = {
  provide: POSTGRES_CLIENT,
  useFactory: () => createPostgresClient(),
};

const repositoryProvider: Provider = {
  provide: FINANCIAL_REPOSITORY,
  useFactory: (client: ReturnType<typeof createPostgresClient>) =>
    new PostgresFinancialRepository(client),
  inject: [POSTGRES_CLIENT],
};

@Module({
  controllers: [
    HealthController,
    AccountsController,
    TransactionsController,
    FinancialController,
    AffordabilityController,
    ImportsController,
  ],
  providers: [
    postgresClientProvider,
    repositoryProvider,
    ApiFinancialService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
