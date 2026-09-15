import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface ApiRequestContext {
  readonly ownerId: string;
}

type AuthenticatedRequest = Request & { auth?: ApiRequestContext };

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for JWT authentication`);
  return value;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly issuer = requiredEnvironment("JWT_ISSUER");
  private readonly audience = requiredEnvironment("JWT_AUDIENCE");
  private readonly jwks = createRemoteJWKSet(new URL(requiredEnvironment("JWT_JWKS_URL")));

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer authentication is required");
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedException("Bearer token is required");

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      const ownerId = ownerIdFromClaims(payload);
      request.auth = { ownerId };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid authentication token");
    }
  }
}

function ownerIdFromClaims(payload: JWTPayload): string {
  const claim = payload.sub;
  if (typeof claim !== "string" || !claim.trim()) {
    throw new UnauthorizedException("Authenticated token is missing subject");
  }
  return claim.trim();
}

export const OwnerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ownerId = request.auth?.ownerId;
    if (!ownerId) throw new UnauthorizedException("Authenticated owner context is missing");
    return ownerId;
  },
);
