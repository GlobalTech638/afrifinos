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

function accessTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) return token;
  }

  const cookieName = process.env.AUTH_COOKIE_NAME?.trim() || "afrifinos_access_token";
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== cookieName) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
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
    const token = accessTokenFromRequest(request);

    if (!token) throw new UnauthorizedException("Authentication is required");

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
