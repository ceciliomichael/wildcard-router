"use client";

import { type FormEvent, useState } from "react";

interface TerminalSshGateProps {
  isLoading: boolean;
  error: string | null;
  onConnect: (input: {
    username: string;
    host: string;
    port: number | null;
    password: string | null;
  }) => Promise<void>;
}

export function TerminalSshGate({
  isLoading,
  error,
  onConnect,
}: TerminalSshGateProps) {
  const [username, setUsername] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled = isSubmitting || isLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedPort = port.trim().length === 0 ? null : Number(port.trim());
    if (normalizedPort !== null && !Number.isInteger(normalizedPort)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConnect({
        username,
        host,
        port: normalizedPort,
        password: password.trim().length > 0 ? password : null,
      });
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="terminal-ssh-gate">
      <div className="terminal-ssh-gate__panel">
        <header className="terminal-ssh-gate__header">
          <p className="terminal-ssh-gate__eyebrow">Secure Terminal Access</p>
          <h2 className="terminal-ssh-gate__title">Connect To SSH Target</h2>
          <p className="terminal-ssh-gate__description">
            This workspace opens terminal tabs only after your SSH details are configured.
          </p>
          <p className="terminal-ssh-gate__note">
            Password stays in server memory for this runtime and is never written to browser storage.
          </p>
        </header>

        <form className="terminal-ssh-gate__form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="terminal-ssh-gate__field">
            <span className="field-label">SSH Username</span>
            <input
              className="field-input"
              name="username"
              value={username}
              autoComplete="off"
              disabled={isDisabled}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              placeholder="root"
              required
            />
          </label>

          <label className="terminal-ssh-gate__field">
            <span className="field-label">IP / Host / URL</span>
            <input
              className="field-input"
              name="host"
              value={host}
              autoComplete="off"
              disabled={isDisabled}
              onChange={(event) => {
                setHost(event.target.value);
              }}
              placeholder="192.168.1.10 or ssh://server.example.com:2222"
              required
            />
          </label>

          <label className="terminal-ssh-gate__field terminal-ssh-gate__field--port">
            <span className="field-label">Port (Optional)</span>
            <input
              className="field-input"
              name="port"
              value={port}
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isDisabled}
              onChange={(event) => {
                setPort(event.target.value);
              }}
              placeholder="22"
            />
          </label>

          <label className="terminal-ssh-gate__field">
            <span className="field-label">Password (Optional)</span>
            <input
              className="field-input"
              type="password"
              name="password"
              value={password}
              autoComplete="new-password"
              disabled={isDisabled}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Leave empty to use SSH keys or type in shell"
            />
          </label>

          <div className="terminal-ssh-gate__actions">
            <button
              type="submit"
              className="btn terminal-ssh-gate__submit"
              disabled={isDisabled}
            >
              {isSubmitting ? "Connecting..." : "Connect SSH"}
            </button>
          </div>
        </form>

        {error ? <p className="terminal-ssh-gate__error">{error}</p> : null}
      </div>
    </section>
  );
}
