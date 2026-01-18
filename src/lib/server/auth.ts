import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
const secret = new TextEncoder().encode(JWT_SECRET);

export async function signJWT(payload: { userId: number; email: string }): Promise<string> {
    return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(secret);
}

export async function verifyJWT(token: string): Promise<{ userId: number; email: string } | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload as { userId: number; email: string };
    } catch {
        return null;
    }
}
