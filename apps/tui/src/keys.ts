/**
 * Key decoding for the native TUI.
 *
 * Node's `readline.emitKeypressEvents` normalizes escape sequences into a key
 * object on Windows Terminal and Linux alike; we never parse raw sequences.
 */
export type KeyAction =
  | { type: "char"; text: string }
  | { type: "enter" }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "left" }
  | { type: "right" }
  | { type: "home" }
  | { type: "end" }
  | { type: "up" }
  | { type: "down" }
  | { type: "ctrl-c" }
  | { type: "ctrl-d" }
  | { type: "ctrl-l" }
  | { type: "ctrl-o" }
  | { type: "ctrl-e" }
  | { type: "escape" }
  | { type: "tab" }
  | { type: "ignore" };

export interface KeyInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

export function classifyKey(str: string | undefined, key: KeyInfo | undefined): KeyAction {
  const name = key?.name;
  if (key?.ctrl === true && name !== undefined) {
    switch (name.toLowerCase()) {
      case "c":
        return { type: "ctrl-c" };
      case "d":
        return { type: "ctrl-d" };
      case "l":
        return { type: "ctrl-l" };
      case "o":
        return { type: "ctrl-o" };
      case "e":
        return { type: "ctrl-e" };
      default:
        return { type: "ignore" };
    }
  }
  if (key?.meta === true) return { type: "ignore" };
  switch (name) {
    case "return":
    case "enter":
      return { type: "enter" };
    case "backspace":
      return { type: "backspace" };
    case "delete":
      return { type: "delete" };
    case "left":
      return { type: "left" };
    case "right":
      return { type: "right" };
    case "home":
      return { type: "home" };
    case "end":
      return { type: "end" };
    case "up":
      return { type: "up" };
    case "down":
      return { type: "down" };
    case "escape":
    case "esc":
      return { type: "escape" };
    case "tab":
      return { type: "tab" };
    default:
      break;
  }
  if (str !== undefined && str.length > 0) {
    const text = str.replace(/[\u0000-\u001f\u007f]/g, "");
    if (text.length > 0) return { type: "char", text };
  }
  return { type: "ignore" };
}
