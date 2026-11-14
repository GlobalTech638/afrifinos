import { describe, expect, it, vi } from "vitest";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { FxController } from "./fx.controller.js";

describe("FxController", () => {
  it("returns only the authenticated owner's conversions with the default page size", async () => {
    const getFxConversions = vi.fn().mockResolvedValue([]);
    const controller = new FxController({ getFxConversions } as never);

    await expect(controller.listConversions("owner-123")).resolves.toEqual([]);
    expect(getFxConversions).toHaveBeenCalledOnce();
    expect(getFxConversions).toHaveBeenCalledWith("owner-123", 50);
  });

  it("accepts an explicit limit within the supported range", async () => {
    const getFxConversions = vi.fn().mockResolvedValue([]);
    const controller = new FxController({ getFxConversions } as never);

    await controller.listConversions("owner-123", "100");
    expect(getFxConversions).toHaveBeenCalledWith("owner-123", 100);
  });

  it.each(["", "0", "-1", "101", "1.5", "1e2", "NaN", "  "])(
    "rejects an invalid limit: %j",
    async (limit) => {
      const getFxConversions = vi.fn().mockResolvedValue([]);
      const controller = new FxController({ getFxConversions } as never);

      await expect(controller.listConversions("owner-123", limit)).rejects.toBeInstanceOf(BadRequestException);
      expect(getFxConversions).not.toHaveBeenCalled();
    },
  );

  it("does not expose persistence errors to the client", async () => {
    const getFxConversions = vi.fn().mockRejectedValue(new Error("database password or SQL detail"));
    const controller = new FxController({ getFxConversions } as never);

    await expect(controller.listConversions("owner-123")).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(controller.listConversions("owner-123")).rejects.toThrow("Unable to retrieve FX conversion history");
  });
});
