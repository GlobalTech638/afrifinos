import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { FinancialRepository, StoredFinancialSignal } from "@afrifinos/financial-persistence";
import { ApiFinancialService } from "./api-financial.service.js";

const storedSignal: StoredFinancialSignal = {
  ownerId: "owner-1",
  signalId: "liquidity-critical",
  category: "forecast",
  severity: "critical",
  status: "acknowledged",
  title: "Critical liquidity risk",
  statement: "Projected liquidity falls below the safety threshold.",
  evidenceIds: ["forecast.liquidityRisk"],
  firstDetectedAt: "2026-10-10T08:00:00.000Z",
  lastDetectedAt: "2026-10-12T08:00:00.000Z",
  acknowledgedAt: "2026-10-11T09:00:00.000Z",
};

describe("ApiFinancialService signal responses", () => {
  function serviceWith(repository: Partial<FinancialRepository>) {
    return new ApiFinancialService(repository as FinancialRepository);
  }

  it("does not expose persistence failures as client bad requests", async () => {
    const failure = new Error("database password or internal SQL details");
    const getAccounts = vi.fn().mockRejectedValue(failure);
    const service = serviceWith({ getAccounts });

    await expect(service.getIntelligence("owner-1", "KES")).rejects.toMatchObject({
      status: 500,
      response: { statusCode: 500, message: "Unable to build financial intelligence" },
    });
  });

  it("returns public signal fields without exposing persistence owner identifiers", async () => {
    const getFinancialSignals = vi.fn().mockResolvedValue([storedSignal]);
    const service = serviceWith({ getFinancialSignals });

    const result = await service.getSignals("owner-1", "acknowledged");

    expect(getFinancialSignals).toHaveBeenCalledWith("owner-1", "acknowledged");
    expect(result).toEqual([{
      id: "liquidity-critical",
      category: "forecast",
      severity: "critical",
      status: "acknowledged",
      title: "Critical liquidity risk",
      statement: "Projected liquidity falls below the safety threshold.",
      evidenceIds: ["forecast.liquidityRisk"],
      detectedAt: "2026-10-12T08:00:00.000Z",
      firstDetectedAt: "2026-10-10T08:00:00.000Z",
      lastDetectedAt: "2026-10-12T08:00:00.000Z",
      acknowledgedAt: "2026-10-11T09:00:00.000Z",
    }]);
    expect(result[0]).not.toHaveProperty("ownerId");
    expect(result[0]).not.toHaveProperty("signalId");
  });

  it("returns not found when a signal is absent or already resolved", async () => {
    const acknowledgeFinancialSignal = vi.fn().mockResolvedValue(null);
    const service = serviceWith({ acknowledgeFinancialSignal });

    await expect(service.acknowledgeSignal("owner-1", "missing-signal")).rejects.toBeInstanceOf(NotFoundException);
    expect(acknowledgeFinancialSignal).toHaveBeenCalledWith("owner-1", "missing-signal");
  });

  it("returns the same public response shape after acknowledgement", async () => {
    const acknowledgeFinancialSignal = vi.fn().mockResolvedValue(storedSignal);
    const service = serviceWith({ acknowledgeFinancialSignal });

    const result = await service.acknowledgeSignal("owner-1", "liquidity-critical");

    expect(acknowledgeFinancialSignal).toHaveBeenCalledWith("owner-1", "liquidity-critical");
    expect(result).toMatchObject({
      id: "liquidity-critical",
      status: "acknowledged",
      firstDetectedAt: storedSignal.firstDetectedAt,
      lastDetectedAt: storedSignal.lastDetectedAt,
      acknowledgedAt: storedSignal.acknowledgedAt,
    });
    expect(result).not.toHaveProperty("ownerId");
    expect(result).not.toHaveProperty("signalId");
  });
});
