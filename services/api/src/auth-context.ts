import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface ApiRequestContext {
  readonly ownerId: string;
}

export const OwnerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const value = request.headers["x-owner-id"];
    const ownerId = Array.isArray(value) ? value[0] : value;
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }
    return ownerId.trim();
  },
);
