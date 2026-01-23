import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Configuration for Cognito authentication.
 */
export interface CognitoConfig {
    region: string;
    userPoolId: string;
}

/**
 * Claim structure extracted from Cognito JWT tokens.
 */
export interface Claim {
    email: string;
    username: string;
    givenName: string;
    familyName: string;
}

// Module-level JWKS clients cache (one per issuer)
const jwksClients = new Map<string, ReturnType<typeof jwksClient>>();

// Simple in-memory cache for verified claims
const claimsCache = new Map<string, { claim: Claim; exp: number }>();

/**
 * Gets or creates a cached JWKS client for the given URI.
 */
function getOrCreateJwksClient(jwksUri: string): ReturnType<typeof jwksClient> {
    let client = jwksClients.get(jwksUri);
    if (!client) {
        client = jwksClient({
            jwksUri,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 600000, // 10 minutes
        });
        jwksClients.set(jwksUri, client);
    }
    return client;
}

/**
 * Creates a hash of the token for caching (avoids storing full tokens).
 */
function getTokenCacheKey(token: string): string {
    return token.slice(-16);
}

/**
 * Verifies a Cognito ID token using the JWKS endpoint.
 * Used by Express.js where we need to verify tokens manually.
 */
export function verifyCognitoToken(token: string, config: CognitoConfig): Promise<Claim> {
    const cacheKey = getTokenCacheKey(token);
    const cached = claimsCache.get(cacheKey);
    if (cached && cached.exp > Date.now() / 1000) {
        return Promise.resolve(cached.claim);
    }

    const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
    const jwksUri = `${issuer}/.well-known/jwks.json`;

    const client = getOrCreateJwksClient(jwksUri);

    function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
        if (!header.kid) {
            return callback(new Error("No kid in token header"));
        }
        client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
        });
    }

    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getKey,
            { algorithms: ["RS256"], issuer },
            (err, decoded) => {
                if (err) return reject(err);

                const payload = decoded as jwt.JwtPayload;
                const claim: Claim = {
                    email: payload.email || "",
                    username: payload["cognito:username"] || payload.sub || "",
                    givenName: payload["given_name"] || "",
                    familyName: payload["family_name"] || ""
                };

                if (payload.exp) {
                    claimsCache.set(cacheKey, { claim, exp: payload.exp });
                }

                resolve(claim);
            }
        );
    });
}

/**
 * Extracts claim from API Gateway event (Lambda).
 * When using a Cognito authorizer, the claims are already verified
 * and available in the request context.
 */
export function extractClaimFromApiGateway(event: APIGatewayProxyEvent): Claim | null {
    const claims = event.requestContext.authorizer?.claims;

    if (!claims) {
        return null;
    }

    return {
        email: claims.email || "",
        username: claims["cognito:username"] || claims.sub || "",
        givenName: claims["given_name"] || "",
        familyName: claims["family_name"] || ""
    };
}

/**
 * Get Cognito configuration from environment variables.
 */
export function getCognitoConfig(): CognitoConfig {
    const region = process.env.COGNITO_REGION;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    if (!region || !userPoolId) {
        throw new Error(
            "Missing Cognito configuration. Set COGNITO_REGION and COGNITO_USER_POOL_ID environment variables."
        );
    }

    return { region, userPoolId };
}
