import { BadRequestException, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { OwnerId } from "./auth-context.js";
import { ApiFinancialService } from "./api-financial.service.js";

@Controller("financial/signals")
export class FinancialSignalsController {
  constructor(private readonly financial: ApiFinancialService) {}

  @Get()
  async list(
    @OwnerId() ownerId: string,
    @Query("status") status?: string,
  ) {
    if (status && !["active", "acknowledged", "resolved"].includes(status)) {
      throw new BadRequestException("status must be active, acknowledged, or resolved");
    }
    return this.financial.getSignals(ownerId, status as "active" | "acknowledged" | "resolved" | undefined);
  }

  @Post(":signalId/acknowledge")
  async acknowledge(@OwnerId() ownerId: string, @Param("signalId") signalId: string) {
    return this.financial.acknowledgeSignal(ownerId, signalId);
  }
}
