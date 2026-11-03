/**
 * Interactive approval queue.
 *
 * The runtime calls ask() when policy verdict is "ask". Requests are serialized
 * so a tool never hangs behind an unseen prompt; the app resolves the current
 * one from y/n/Esc. Reads never reach this queue.
 */
import type { ApprovalRequest, ApprovalService } from "../../../packages/core/src/runtime.ts";

interface Waiter {
  request: ApprovalRequest;
  resolve: (decision: "allow" | "deny") => void;
}

export class InteractiveApprovalService implements ApprovalService {
  private readonly queue: Waiter[] = [];
  private active: Waiter | null = null;
  /** Called whenever the queued/active request changes; the app redraws. */
  onChange: (() => void) | null = null;

  ask(request: ApprovalRequest): Promise<"allow" | "deny"> {
    return new Promise((resolve) => {
      this.queue.push({ request, resolve });
      this.pump();
    });
  }

  current(): ApprovalRequest | null {
    return this.active?.request ?? null;
  }

  pendingCount(): number {
    return this.queue.length + (this.active === null ? 0 : 1);
  }

  respond(decision: "allow" | "deny"): boolean {
    const waiter = this.active;
    if (waiter === null) return false;
    this.active = null;
    waiter.resolve(decision);
    this.pump();
    return true;
  }

  /** Resolve everything as deny; used when the TUI exits. */
  denyAll(): void {
    for (const waiter of [...this.queue]) waiter.resolve("deny");
    this.queue.length = 0;
    this.active?.resolve("deny");
    this.active = null;
  }

  private pump(): void {
    if (this.active === null && this.queue.length > 0) {
      this.active = this.queue.shift() ?? null;
      this.onChange?.();
    }
  }
}
