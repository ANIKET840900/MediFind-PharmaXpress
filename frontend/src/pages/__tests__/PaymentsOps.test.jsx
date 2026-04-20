import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PaymentsOps from "../PaymentsOps";
import { api } from "../../api";

jest.mock("../../api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe("PaymentsOps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads admin summary and triggers reconciliation", async () => {
    api.get
      .mockResolvedValueOnce({ data: { role: "admin" } })
      .mockResolvedValueOnce({
        data: {
          last_run: null,
          recent_runs: [],
        },
      })
      .mockResolvedValueOnce({ data: { role: "admin" } })
      .mockResolvedValueOnce({
        data: {
          last_run: {
            id: 10,
            triggered_by_username: "admin",
            timeout_minutes: 30,
            limit: 200,
            status_filter: "",
            provider_filter: "",
            payment_method_filter: "",
            summary_json: '{"reconciled_count":1,"failed_payments":1,"failed_orders":1}',
            created_at: "2026-01-01T00:00:00Z",
          },
          recent_runs: [],
        },
      });

    api.post.mockResolvedValueOnce({
      data: {
        detail: "Reconciliation completed.",
      },
    });

    render(<PaymentsOps />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/auth/me/"));
    expect(await screen.findByRole("button", { name: /run reconciliation/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run reconciliation/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/payments/reconcile/", expect.any(Object)));
    expect(await screen.findByText(/reconciliation completed/i)).toBeInTheDocument();
  });
});
