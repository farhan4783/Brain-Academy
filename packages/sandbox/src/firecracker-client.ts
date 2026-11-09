import * as http from "http";
import * as net from "net";

export interface FirecrackerBootSource {
  kernel_image_path: string;
  boot_args: string;
  initrd_path?: string;
}

export interface FirecrackerDrive {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  is_read_only: boolean;
}

export interface FirecrackerMachineConfig {
  vcpu_count: number;
  mem_size_mib: number;
  smt?: boolean;
  track_dirty_pages?: boolean;
}

export interface FirecrackerNetworkInterface {
  iface_id: string;
  guest_mac: string;
  host_dev_name: string;
}

export interface FirecrackerVsock {
  vsock_id: string;
  guest_cid: number;
  uds_path: string;
}

/**
 * Enterprise client for Firecracker's Unix Domain Socket REST API.
 * Communicates directly with the firecracker hypervisor process.
 */
export class FirecrackerApiClient {
  private socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  private async request<T = unknown>(
    method: "GET" | "PUT" | "PATCH",
    path: string,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(data ? JSON.parse(data) : ({} as T));
              } catch {
                resolve({} as T);
              }
            } else {
              reject(
                new Error(
                  `Firecracker API error [${method} ${path}] -> HTTP ${res.statusCode}: ${data}`
                )
              );
            }
          });
        }
      );

      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  public async setMachineConfig(config: FirecrackerMachineConfig): Promise<void> {
    await this.request("PUT", "/machine-config", config);
  }

  public async setBootSource(bootSource: FirecrackerBootSource): Promise<void> {
    await this.request("PUT", "/boot-source", bootSource);
  }

  public async attachDrive(drive: FirecrackerDrive): Promise<void> {
    await this.request("PUT", `/drives/${drive.drive_id}`, drive);
  }

  public async attachNetworkInterface(iface: FirecrackerNetworkInterface): Promise<void> {
    await this.request("PUT", `/network-interfaces/${iface.iface_id}`, iface);
  }

  public async setVsock(vsock: FirecrackerVsock): Promise<void> {
    await this.request("PUT", "/vsock", vsock);
  }

  public async startInstance(): Promise<void> {
    await this.request("PUT", "/actions", { action_type: "InstanceStart" });
  }

  public async sendCtrlAltDel(): Promise<void> {
    await this.request("PUT", "/actions", { action_type: "SendCtrlAltDel" });
  }

  public async createSnapshot(memFilePath: string, snapshotPath: string): Promise<void> {
    await this.request("PUT", "/snapshot/create", {
      snapshot_type: "Diff",
      mem_file_path: memFilePath,
      snapshot_path: snapshotPath,
    });
  }
}

/**
 * High-performance vsock streaming agent protocol:
 * Multiplexes stdin, stdout, stderr, and exit codes between host and guest microVM.
 */
export class FirecrackerVsockAgentClient {
  private udsPath: string;
  private port: number;

  constructor(udsPath: string, port = 52) {
    this.udsPath = udsPath;
    this.port = port;
  }

  public async executeCommand(
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
    onOutput?: (chunk: string, stream: "stdout" | "stderr") => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ path: this.udsPath }, () => {
        // Handshake: connect to port
        client.write(`CONNECT ${this.port}\n`);

        // Send execution request frame
        const requestPayload = JSON.stringify({
          cmd: command,
          cwd: options?.cwd || "/root/workspace",
          env: options?.env || {},
          timeoutMs: options?.timeoutMs || 120000,
        });

        client.write(`EXEC ${requestPayload}\n`);
      });

      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let buffer = "";

      client.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("OUT ")) {
            const text = Buffer.from(line.slice(4), "base64").toString("utf-8");
            stdout += text;
            if (onOutput) onOutput(text, "stdout");
          } else if (line.startsWith("ERR ")) {
            const text = Buffer.from(line.slice(4), "base64").toString("utf-8");
            stderr += text;
            if (onOutput) onOutput(text, "stderr");
          } else if (line.startsWith("EXIT ")) {
            exitCode = parseInt(line.slice(5), 10) || 0;
            client.end();
            resolve({ stdout, stderr, exitCode });
          }
        }
      });

      client.on("error", (err) => {
        reject(new Error(`Vsock agent communication failed: ${err.message}`));
      });

      if (options?.timeoutMs) {
        setTimeout(() => {
          client.destroy();
          resolve({
            stdout,
            stderr: stderr + "\n[Hermes MicroVM Watchdog: Command timed out]",
            exitCode: 124,
          });
        }, options.timeoutMs);
      }
    });
  }
}

