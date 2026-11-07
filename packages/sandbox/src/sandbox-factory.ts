import { SandboxProvider } from "./provider.js";
import { E2BSandboxProvider } from "./e2b-sandbox.js";
import { DockerSandboxProvider } from "./docker-sandbox.js";
import { FirecrackerSandboxProvider } from "./firecracker-sandbox.js";

export function createSandboxProvider(): SandboxProvider {
  const providerType = process.env.SANDBOX_PROVIDER || "e2b";

  switch (providerType.toLowerCase()) {
    case "docker":
      return new DockerSandboxProvider();
    case "firecracker":
      return new FirecrackerSandboxProvider();
    case "e2b":
    default:
      return new E2BSandboxProvider();
  }
}
