import Docker from "dockerode";
import { SandboxExecutionOptions, ToolExecutionResult } from "@hermes/shared";
import { SandboxInstance, SandboxProvider, StreamCallback } from "./provider.js";
import { PassThrough } from "stream";

export class DockerSandboxInstance implements SandboxInstance {
  private docker: Docker;
  private container: Docker.Container;
  public readonly id: string;
  private _isAlive = true;

  constructor(docker: Docker, container: Docker.Container, id: string) {
    this.docker = docker;
    this.container = container;
    this.id = id;
  }

  get isAlive(): boolean {
    return this._isAlive;
  }

  async executeCommand(
    command: string,
    options?: SandboxExecutionOptions,
    onOutput?: StreamCallback
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let stdoutBuffer = "";
    let stderrBuffer = "";

    try {
      const exec = await this.container.exec({
        Cmd: ["bash", "-c", command],
        WorkingDir: options?.cwd || "/workspace",
        Env: options?.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      const passStdout = new PassThrough();
      const passStderr = new PassThrough();

      passStdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdoutBuffer += text;
        if (onOutput) onOutput(text, "stdout");
      });

      passStderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderrBuffer += text;
        if (onOutput) onOutput(text, "stderr");
      });

      this.docker.modem.demuxStream(stream, passStdout, passStderr);

      await new Promise<void>((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      const inspectResult = await exec.inspect();
      const durationMs = Date.now() - startTime;
      const originalLines = (stdoutBuffer + stderrBuffer).split("\n").length;

      return {
        toolCallId: `call_${Date.now()}`,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        exitCode: inspectResult.ExitCode ?? 0,
        durationMs,
        truncated: false,
        originalLinesCount: originalLines,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = (err as Error).message;
      return {
        toolCallId: `call_err_${Date.now()}`,
        stdout: stdoutBuffer,
        stderr: stderrBuffer ? `${stderrBuffer}\n${errorMsg}` : errorMsg,
        exitCode: 1,
        durationMs,
        truncated: false,
        originalLinesCount: (stdoutBuffer + errorMsg).split("\n").length,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const res = await this.executeCommand(`cat ${filePath}`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to read file ${filePath}: ${res.stderr}`);
    }
    return res.stdout;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const b64 = Buffer.from(content).toString("base64");
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dir) {
      await this.executeCommand(`mkdir -p ${dir}`);
    }
    const res = await this.executeCommand(`echo "${b64}" | base64 -d > ${filePath}`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to write file ${filePath}: ${res.stderr}`);
    }
  }

  async mountRepository(repoUrl: string, branch = "main"): Promise<void> {
    await this.executeCommand("mkdir -p /workspace");
    await this.executeCommand(`git clone --depth 1 -b ${branch} ${repoUrl} /workspace || git clone ${repoUrl} /workspace`);
  }

  async getGitDiff(): Promise<string> {
    const res = await this.executeCommand("git diff HEAD", { cwd: "/workspace" });
    return res.stdout;
  }

  async snapshotState(label: string): Promise<string> {
    const imageName = `hermes_snapshot_${this.id}_${label}:${Date.now()}`;
    await this.container.commit({ repo: imageName });
    return imageName;
  }

  async destroy(): Promise<void> {
    if (!this._isAlive) return;
    try {
      await this.container.stop({ t: 2 }).catch(() => {});
      await this.container.remove({ force: true }).catch(() => {});
    } finally {
      this._isAlive = false;
    }
  }
}

export class DockerSandboxProvider implements SandboxProvider {
  private docker: Docker;
  private baseImage: string;

  constructor(baseImage = "node:20-bookworm-slim") {
    this.docker = new Docker();
    this.baseImage = baseImage;
  }

  async createSandbox(taskId: string): Promise<SandboxInstance> {
    const container = await this.docker.createContainer({
      Image: this.baseImage,
      Cmd: ["tail", "-f", "/dev/null"],
      Tty: false,
      Labels: {
        "hermes.task_id": taskId,
        "hermes.created_at": new Date().toISOString(),
      },
      HostConfig: {
        Memory: 2 * 1024 * 1024 * 1024, // 2GB limit
        NanoCpus: 2 * 1e9, // 2 CPUs
      },
    });

    await container.start();
    return new DockerSandboxInstance(this.docker, container, container.id);
  }

  async reconnectSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    try {
      const container = this.docker.getContainer(sandboxId);
      const data = await container.inspect();
      if (data.State.Running) {
        return new DockerSandboxInstance(this.docker, container, sandboxId);
      }
      return null;
    } catch {
      return null;
    }
  }
}
