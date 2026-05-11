"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import {
  fetchSshTerminalTarget,
  type SshTerminalTarget,
  saveSshTerminalTarget,
} from "./sshTargetApi";
import { TerminalPane } from "./TerminalPane";
import { TerminalSshGate } from "./TerminalSshGate";
import { disposeTerminalRuntime } from "./terminal-runtime";

interface TerminalTab {
  id: string;
  label: string;
}

interface TerminalState {
  activeTabId: string | null;
  tabs: TerminalTab[];
  nextTabNumber: number;
}

interface TerminalWorkspaceProps {
  persistenceKey: string;
  showSshGate?: boolean;
}

interface PersistedTerminalTab {
  id: string;
  label: string;
}

interface PersistedTerminalState {
  activeTabId: string | null;
  tabs: PersistedTerminalTab[];
  nextTabNumber?: number;
}

const TERMINAL_LABEL_PREFIX = "Terminal ";

function createTabLabel(tabNumber: number): string {
  return `${TERMINAL_LABEL_PREFIX}${tabNumber}`;
}

function createTab(id: string, tabNumber: number): TerminalTab {
  return {
    id,
    label: createTabLabel(tabNumber),
  };
}

function createTerminalTabId(): string {
  return crypto.randomUUID();
}

function createDefaultState(): TerminalState {
  const id = createTerminalTabId();
  return {
    activeTabId: id,
    tabs: [createTab(id, 1)],
    nextTabNumber: 2,
  };
}

function getTerminalNumberFromLabel(label: string): number | null {
  if (!label.startsWith(TERMINAL_LABEL_PREFIX)) {
    return null;
  }

  const suffix = Number(label.slice(TERMINAL_LABEL_PREFIX.length));
  if (!Number.isInteger(suffix) || suffix < 1) {
    return null;
  }

  return suffix;
}

function isValidPersistedTab(tab: unknown): tab is PersistedTerminalTab {
  if (!tab || typeof tab !== "object") {
    return false;
  }

  const candidate = tab as Partial<PersistedTerminalTab>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.label === "string" &&
    candidate.label.trim().length > 0
  );
}

function normalizeTerminalState(state: PersistedTerminalState): TerminalState {
  const tabs = state.tabs
    .filter((tab) => isValidPersistedTab(tab))
    .map((tab) => ({
      id: tab.id.trim(),
      label: tab.label.trim(),
    }));

  if (tabs.length === 0) {
    return {
      activeTabId: null,
      tabs: [],
      nextTabNumber: 1,
    };
  }

  const activeTabExists = tabs.some((tab) => tab.id === state.activeTabId);
  const highestTerminalNumber = tabs.reduce((highest, tab) => {
    const parsedNumber = getTerminalNumberFromLabel(tab.label);
    return parsedNumber && parsedNumber > highest ? parsedNumber : highest;
  }, 0);
  const nextTabNumber =
    typeof state.nextTabNumber === "number" &&
    Number.isInteger(state.nextTabNumber) &&
    state.nextTabNumber > highestTerminalNumber
      ? state.nextTabNumber
      : highestTerminalNumber + 1;

  return {
    activeTabId: activeTabExists ? state.activeTabId : (tabs[0]?.id ?? null),
    tabs,
    nextTabNumber,
  };
}

function readPersistedState(key: string): TerminalState | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTerminalState>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tabs)) {
      return null;
    }

    if (parsed.activeTabId !== null && typeof parsed.activeTabId !== "string") {
      return null;
    }

    return normalizeTerminalState({
      activeTabId: parsed.activeTabId ?? null,
      tabs: parsed.tabs,
      nextTabNumber:
        typeof parsed.nextTabNumber === "number"
          ? parsed.nextTabNumber
          : undefined,
    });
  } catch {
    return null;
  }
}

export function TerminalWorkspace({
  persistenceKey,
  showSshGate = true,
}: TerminalWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<TerminalState>(createDefaultState);
  const [isStateReady, setIsStateReady] = useState(false);
  const [sshTarget, setSshTarget] = useState<SshTerminalTarget | null>(null);
  const [isSshReady, setIsSshReady] = useState(false);
  const [sshError, setSshError] = useState<string | null>(null);

  useEffect(() => {
    const restoredState = readPersistedState(persistenceKey);
    setState(restoredState ?? createDefaultState());
    setIsStateReady(true);
  }, [persistenceKey]);

  useEffect(() => {
    let isMounted = true;

    const loadSshTarget = async (): Promise<void> => {
      try {
        const target = await fetchSshTerminalTarget();
        if (!isMounted) {
          return;
        }
        setSshTarget(target);
        setSshError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSshError(
          error instanceof Error
            ? error.message
            : "Failed to load SSH terminal target.",
        );
        setSshTarget(null);
      } finally {
        if (isMounted) {
          setIsSshReady(true);
        }
      }
    };

    void loadSshTarget();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStateReady) {
      return;
    }

    window.localStorage.setItem(persistenceKey, JSON.stringify(state));
  }, [isStateReady, persistenceKey, state]);

  const { activeTabId, tabs } = state;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  if (!isStateReady || !isSshReady) {
    return null;
  }

  const handleAddTab = (): void => {
    setState((currentState) => {
      const newTab = createTab(
        createTerminalTabId(),
        currentState.nextTabNumber,
      );
      return {
        activeTabId: newTab.id,
        tabs: [...currentState.tabs, newTab],
        nextTabNumber: currentState.nextTabNumber + 1,
      };
    });
  };

  const handleCloseTab = (tabId: string): void => {
    disposeTerminalRuntime(tabId);

    setState((currentState) => {
      if (currentState.tabs.length === 0) {
        return currentState;
      }

      const tabIndex = currentState.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex < 0) {
        return currentState;
      }

      const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);
      if (nextTabs.length === 0) {
        return {
          activeTabId: null,
          tabs: [],
          nextTabNumber: currentState.nextTabNumber,
        };
      }

      if (currentState.activeTabId !== tabId) {
        return {
          activeTabId: currentState.activeTabId,
          tabs: nextTabs,
          nextTabNumber: currentState.nextTabNumber,
        };
      }

      const nextActiveTab =
        nextTabs[Math.min(tabIndex, nextTabs.length - 1)] ?? nextTabs[0];

      return {
        activeTabId: nextActiveTab.id,
        tabs: nextTabs,
        nextTabNumber: currentState.nextTabNumber,
      };
    });
  };

  const handleTabMouseDown = (event: MouseEvent<HTMLButtonElement>): void => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const handleTabAuxClick = (
    tabId: string,
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    handleCloseTab(tabId);
  };

  const handleConnectSsh = async (input: {
    username: string;
    host: string;
    port: number | null;
    password: string | null;
  }): Promise<void> => {
    try {
      const nextTarget = await saveSshTerminalTarget(input);
      setSshTarget(nextTarget);
      setSshError(null);

      setState((currentState) => {
        if (currentState.tabs.length > 0) {
          return currentState;
        }
        return createDefaultState();
      });
    } catch (error) {
      setSshError(
        error instanceof Error
          ? error.message
          : "Failed to configure SSH terminal target.",
      );
    }
  };

  const renderTerminalEmptyState = (input: {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  }) => (
    <div className="terminal-workspace-empty-state">
      <div className="terminal-workspace-empty-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Terminal</title>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 10L10 12L7 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12.5 14H17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="terminal-workspace-empty-title">{input.title}</p>
      <p className="terminal-workspace-empty-description">
        {input.description}
      </p>
      <button
        type="button"
        className="terminal-workspace-empty-action"
        onClick={input.onAction}
      >
        {input.actionLabel}
      </button>
    </div>
  );

  if (!sshTarget) {
    if (!showSshGate) {
      return (
        <section className="terminal-workspace-shell is-empty">
          <div className="terminal-workspace-body">
            {renderTerminalEmptyState({
              title: "Terminal target not configured",
              description:
                "Set your SSH target in Settings before opening terminal sessions.",
              actionLabel: "Open Terminal Settings",
              onAction: () => {
                router.push("/settings?section=terminal");
              },
            })}
          </div>
        </section>
      );
    }

    return (
      <section className="terminal-workspace-shell is-empty">
        <div className="terminal-workspace-body">
          <TerminalSshGate
            isLoading={false}
            error={sshError}
            onConnect={handleConnectSsh}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={`terminal-workspace-shell${tabs.length === 0 ? " is-empty" : ""}`}
    >
      {tabs.length > 0 ? (
        <header className="terminal-workspace-header">
          <div className="terminal-workspace-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;

              return (
                <div
                  key={tab.id}
                  className={`terminal-workspace-tab${isActive ? " is-active" : ""}`}
                >
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className="terminal-workspace-tab-button"
                    onAuxClick={(event) => {
                      handleTabAuxClick(tab.id, event);
                    }}
                    onMouseDown={handleTabMouseDown}
                    onClick={() => {
                      setState((currentState) => ({
                        ...currentState,
                        activeTabId: tab.id,
                      }));
                    }}
                  >
                    <span>{tab.label}</span>
                  </button>
                  <button
                    type="button"
                    className="terminal-workspace-tab-close"
                    aria-label={`Close ${tab.label}`}
                    onClick={() => {
                      handleCloseTab(tab.id);
                    }}
                  >
                    <span className="terminal-workspace-tab-close-icon">×</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="terminal-workspace-tab terminal-workspace-tab-add terminal-workspace-tab-add-right">
            <button
              type="button"
              onClick={handleAddTab}
              className="terminal-workspace-tab-add-action"
              aria-label="Add terminal tab"
            >
              <span className="terminal-workspace-tab-add-symbol">+</span>
            </button>
          </div>
        </header>
      ) : null}

      <div className="terminal-workspace-body">
        {tabs.length === 0
          ? renderTerminalEmptyState({
              title: "No terminal open",
              description:
                "Start a new session to run commands through your SSH target.",
              actionLabel: "+ New Terminal",
              onAction: handleAddTab,
            })
          : tabs.map((tab) => (
              <TerminalPane
                key={tab.id}
                onExit={handleCloseTab}
                sessionId={tab.id}
                isActive={tab.id === activeTab?.id}
              />
            ))}
      </div>
    </section>
  );
}
