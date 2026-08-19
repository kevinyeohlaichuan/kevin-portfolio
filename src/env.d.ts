interface Window {
  turnstile?: {
    render(
      container: HTMLElement,
      options: {
        action: string;
        sitekey: string;
        size: "compact" | "flexible";
        theme: "dark";
      },
    ): string;
    remove(widgetId: string): void;
    reset(widgetId?: string): void;
  };
}
