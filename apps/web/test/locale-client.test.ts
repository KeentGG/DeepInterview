import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitLocaleChange,
  LOCALE_CHANGE_EVENT,
  readLocaleCookie,
} from "../lib/i18n/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("locale cookie helpers", () => {
  it("reads only the tracked locale cookie", () => {
    vi.stubGlobal("document", { cookie: "theme=dark; locale=vi" });
    expect(readLocaleCookie()).toBe("vi");

    vi.stubGlobal("document", { cookie: "locale=en" });
    expect(readLocaleCookie()).toBe("en");

    vi.stubGlobal("document", { cookie: "theme=dark" });
    expect(readLocaleCookie()).toBe("en");
  });

  it("emits the shared locale-change event with the new locale", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    emitLocaleChange("vi");

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe(LOCALE_CHANGE_EVENT);
    expect(event.detail).toEqual({ locale: "vi" });
  });
});
