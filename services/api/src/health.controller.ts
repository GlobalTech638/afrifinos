import { Controller, Get } from "@nestjs/common";
import { PublicRoute } from "./auth-context.js";

@Controller("health")
export class HealthController {
  @Get()
  @PublicRoute()
  health() {
    return {
      status: "ok",
      service: "afrifinos-api",
      timestamp: new Date().toISOString(),
    };
  }
}
