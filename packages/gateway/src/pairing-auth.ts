import * as crypto from "crypto";

export interface PairingSession {
  code: string;
  expiresAt: number;
  authenticated: boolean;
  clientId?: string;
}

export class GatewayPairingAuth {
  private activePairings = new Map<string, PairingSession>();
  private masterSecret: string;

  constructor(secret = process.env.GATEWAY_AUTH_TOKEN || "hermes-default-secret-key") {
    this.masterSecret = secret;
  }

  /**
   * Generates a 6-digit pairing code for new devices/nodes (valid for 5 minutes).
   */
  public generatePairingCode(clientId: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.activePairings.set(code, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      authenticated: false,
      clientId,
    });
    return code;
  }

  /**
   * Verifies pairing code and returns a signed bearer token.
   */
  public verifyPairingCode(code: string): { success: boolean; token?: string; error?: string } {
    const session = this.activePairings.get(code);
    if (!session) {
      return { success: false, error: "Invalid pairing code." };
    }

    if (Date.now() > session.expiresAt) {
      this.activePairings.delete(code);
      return { success: false, error: "Pairing code expired." };
    }

    session.authenticated = true;
    this.activePairings.delete(code);

    const token = this.generateToken(session.clientId || "node");
    return { success: true, token };
  }

  public generateToken(clientId: string): string {
    const payload = `${clientId}:${Date.now()}`;
    const hmac = crypto.createHmac("sha256", this.masterSecret).update(payload).digest("hex");
    return Buffer.from(`${payload}:${hmac}`).toString("base64");
  }

  public validateToken(token: string): boolean {
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const parts = decoded.split(":");
      if (parts.length !== 3) return false;

      const [clientId, timestamp, signature] = parts;
      const expected = crypto
        .createHmac("sha256", this.masterSecret)
        .update(`${clientId}:${timestamp}`)
        .digest("hex");

      return signature === expected;
    } catch {
      return false;
    }
  }
}

