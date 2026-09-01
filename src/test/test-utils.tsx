import { render as rtlRender, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/lib/i18n/provider";
import { Contact } from "@breeztech/breez-sdk-spark/web";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialContacts?: Contact[];
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    initialContacts,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (initialContacts) {
    queryClient.setQueryData(["breez", "contactList"], {
    pages: [[...initialContacts]],
    pageParams: [undefined],
  });
  }

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...rtlRender(ui, { wrapper: AllTheProviders, ...renderOptions }),
  };
}

export * from "@testing-library/react";