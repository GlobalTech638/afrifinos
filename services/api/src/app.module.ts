import { Module, Provider } from "@nestjs/common";
import { PostgresFinancialRepository } from "@afrifinos/financial-persistence";
import { createPostgresClient } from "@afrifinos/financial-persistence";
import { HealthController } from "./health.controller.js";
import { AccountsController } from "./accounts.controller.js";
import { TransactionsController } from "./transactions.controller.js";
import { FinancialController } from "./financial.controller.js";
import { ImportsController } from "./imports.controller.js";
import { ApiFinancialService } from "./api-financial.service.js";

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
    ImportsController,
  ],
  providers: [postgresClientProvider, repositoryProvider, ApiFinancialService],
})
export class AppModule {}
