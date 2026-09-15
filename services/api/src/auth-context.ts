import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface ApiRequestContext {
  readonly ownerId: string;
}

type AuthenticatedRequest = Request & { auth?: ApiRequestContext };

export const IS_PUBLIC_ROUTE = Symbol("IS_PUBLIC_ROUTE");
export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true);

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

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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
      request.auth = { ownerId: ownerIdFromClaims(payload) };
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
