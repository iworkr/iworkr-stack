import { Page, Response } from "@playwright/test";

export async function hardenDeterminism(page: Page) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

export async function waitForApiResponse(
  page: Page,
  urlIncludes: string | RegExp,
  options?: {
    timeoutMs?: number;
    status?: number | ((status: number) => boolean);
    method?: string;
  },
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const method = options?.method?.toUpperCase();
  const statusMatcher = options?.status;

  return page.waitForResponse((res) => {
    const url = res.url();
    const methodOk = method ? res.request().method().toUpperCase() === method : true;
    const urlOk =
      typeof urlIncludes === "string"
        ? url.includes(urlIncludes)
        : urlIncludes.test(url);
    const status = res.status();
    const statusOk =
      typeof statusMatcher === "number"
        ? status === statusMatcher
        : typeof statusMatcher === "function"
          ? statusMatcher(status)
          : status >= 200 && status < 500;
    return methodOk && urlOk && statusOk;
  }, { timeout: timeoutMs });
}

