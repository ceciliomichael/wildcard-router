import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TerminalSpawnTarget {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

type TerminalTargetMode = "auto" | "docker" | "host";

const DEFAULT_DOCKER_SERVICE = "backend";
const DEFAULT_DOCKER_SHELL = "/bin/sh";

function parseTargetMode(value: string | undefined): TerminalTargetMode {
  const normalizedValue = value?.trim().toLowerCase();
  if (normalizedValue === "docker") {
    return "docker";
  }
  if (normalizedValue === "host") {
    return "host";
  }
  return "auto";
}

function splitShellArgs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getHostWorkingDirectory(): string {
  if (process.platform === "win32") {
    return process.cwd();
  }

  return process.env.HOME?.trim() || os.homedir() || process.cwd();
}

function resolveHostSpawnTarget(): TerminalSpawnTarget {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: [],
      cwd: process.cwd(),
      env: {
        ...process.env,
        COLORTERM: "truecolor",
        TERM: "xterm-256color",
      },
    };
  }

  const shell = process.env.SHELL?.trim();
  const command = shell && shell.length > 0 ? shell : "/bin/bash";
  const args = command.includes("bash") ? ["-l"] : [];

  return {
    command,
    args,
    cwd: getHostWorkingDirectory(),
    env: {
      ...process.env,
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    },
  };
}

function resolveComposeDirectory(): string | null {
  const configuredDirectory = process.env.TERMINAL_DOCKER_COMPOSE_DIR?.trim();
  if (configuredDirectory) {
    const resolvedPath = path.resolve(configuredDirectory);
    return existsSync(resolvedPath) ? resolvedPath : null;
  }

  let currentPath = process.cwd();
  while (true) {
    if (
      existsSync(path.join(currentPath, "docker-compose.yml")) ||
      existsSync(path.join(currentPath, "compose.yml"))
    ) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

function runDockerCommand(args: string[], cwd?: string): string {
  return execFileSync("docker", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function resolveDockerContainerIdStrict(): string {
  const explicitContainer = process.env.TERMINAL_DOCKER_CONTAINER?.trim();
  if (explicitContainer) {
    return explicitContainer;
  }

  const composeDirectory = resolveComposeDirectory();
  if (!composeDirectory) {
    throw new Error(
      "Cannot resolve docker compose directory. Set TERMINAL_DOCKER_COMPOSE_DIR or TERMINAL_DOCKER_CONTAINER.",
    );
  }

  const serviceName =
    process.env.TERMINAL_DOCKER_SERVICE?.trim() || DEFAULT_DOCKER_SERVICE;
  const containerId = runDockerCommand(
    ["compose", "ps", "-q", serviceName],
    composeDirectory,
  );

  if (!containerId) {
    throw new Error(
      `No running container found for docker service "${serviceName}".`,
    );
  }

  return containerId;
}

function tryResolveDockerContainerId(): string | null {
  try {
    return resolveDockerContainerIdStrict();
  } catch {
    return null;
  }
}

function resolveDockerSpawnTarget(): TerminalSpawnTarget {
  const containerId = resolveDockerContainerIdStrict();
  const dockerShell =
    process.env.TERMINAL_DOCKER_SHELL?.trim() || DEFAULT_DOCKER_SHELL;
  const dockerShellArgs = splitShellArgs(process.env.TERMINAL_DOCKER_SHELL_ARGS);

  return {
    command: "docker",
    args: ["exec", "-it", containerId, dockerShell, ...dockerShellArgs],
    cwd: process.cwd(),
    env: {
      ...process.env,
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    },
  };
}

function tryResolveDockerSpawnTarget(): TerminalSpawnTarget | null {
  const containerId = tryResolveDockerContainerId();
  if (!containerId) {
    return null;
  }

  const dockerShell =
    process.env.TERMINAL_DOCKER_SHELL?.trim() || DEFAULT_DOCKER_SHELL;
  const dockerShellArgs = splitShellArgs(process.env.TERMINAL_DOCKER_SHELL_ARGS);

  return {
    command: "docker",
    args: ["exec", "-it", containerId, dockerShell, ...dockerShellArgs],
    cwd: process.cwd(),
    env: {
      ...process.env,
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    },
  };
}

export function resolveTerminalSpawnTarget(): TerminalSpawnTarget {
  const targetMode = parseTargetMode(process.env.TERMINAL_TARGET);
  if (targetMode === "host") {
    return resolveHostSpawnTarget();
  }

  if (targetMode === "docker") {
    return resolveDockerSpawnTarget();
  }

  const autoDockerTarget = tryResolveDockerSpawnTarget();
  return autoDockerTarget ?? resolveHostSpawnTarget();
}
