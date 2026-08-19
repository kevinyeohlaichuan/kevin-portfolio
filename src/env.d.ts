interface Window {
  turnstile?: {
    render(
      container: HTMLElement,
      options: {
        action: string;
        sitekey: string;
        size: "compact" | "flexible";
        theme: "dark";
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
      },
    ): string;
    remove(widgetId: string): void;
    reset(widgetId?: string): void;
  };
}
