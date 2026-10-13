import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { FinancialSignalsController } from "./financial-signals.controller.js";
import type { ApiFinancialService } from "./api-financial.service.js";

describe("FinancialSignalsController", () => {
  it("lists signals using the authenticated owner and requested status", async () => {
    const getSignals = vi.fn().mockResolvedValue([{ signalId: "liquidity-critical", status: "active" }]);
    const controller = new FinancialSignalsController({ getSignals } as unknown as ApiFinancialService);

    await expect(controller.list("owner-1", "active")).resolves.toEqual([
      { signalId: "liquidity-critical", status: "active" },
    ]);
    expect(getSignals).toHaveBeenCalledWith("owner-1", "active");
  });

  it("rejects unsupported lifecycle filters", async () => {
    const getSignals = vi.fn();
    const controller = new FinancialSignalsController({ getSignals } as unknown as ApiFinancialService);

    await expect(controller.list("owner-1", "deleted" as "active")).rejects.toBeInstanceOf(BadRequestException);
    expect(getSignals).not.toHaveBeenCalled();
  });

  it("rejects an explicitly empty lifecycle filter", async () => {
    const getSignals = vi.fn();
    const controller = new FinancialSignalsController({ getSignals } as unknown as ApiFinancialService);

    await expect(controller.list("owner-1", "")).rejects.toBeInstanceOf(BadRequestException);
    expect(getSignals).not.toHaveBeenCalled();
  });

  it("acknowledges only through the financial service with the authenticated owner", async () => {
    const acknowledgeSignal = vi.fn().mockResolvedValue({ signalId: "liquidity-critical", status: "acknowledged" });
    const controller = new FinancialSignalsController({ acknowledgeSignal } as unknown as ApiFinancialService);

    await expect(controller.acknowledge("owner-1", "liquidity-critical")).resolves.toEqual({
      signalId: "liquidity-critical",
      status: "acknowledged",
    });
    expect(acknowledgeSignal).toHaveBeenCalledWith("owner-1", "liquidity-critical");
  });
});
