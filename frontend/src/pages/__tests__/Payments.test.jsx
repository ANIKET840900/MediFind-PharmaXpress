import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Payments from "../Payments";
import { api, getAuthToken } from "../../api";

jest.mock("../../api", () => ({
  api: {
    get: jest.fn(),
  },
  getAuthToken: jest.fn(),
}));

describe("Payments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows payment rows with status labels", async () => {
    getAuthToken.mockReturnValue("token-abc");
    api.get
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 11,
              status: "authorized",
              payment_method: "upi",
              amount: 120.5,
              currency: "INR",
              gateway_order_id: "mock_ord_111",
              gateway_payment_id: "",
              provider: "mock_gateway",
              updated_at: "2026-01-01T00:00:00Z",
            },
            {
              id: 12,
              status: "captured",
              payment_method: "card",
              amount: 180,
              currency: "INR",
              gateway_order_id: "mock_ord_112",
              gateway_payment_id: "pay_112",
              provider: "mock_gateway",
              updated_at: "2026-01-01T00:05:00Z",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          payment: {
            id: 11,
            status: "captured",
            payment_method: "upi",
            gateway_order_id: "mock_ord_111",
            gateway_payment_id: "pay_999",
          },
          events: [
            {
              id: 201,
              event_name: "payment.captured",
              status: "captured",
              idempotency_key: "mock:key:201",
              processed: true,
              replay_count: 0,
              raw_payload: '{"event":"payment.captured"}',
            },
          ],
        },
      });

    render(<Payments />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/payments/"));
    expect(await screen.findByText(/transaction #11/i)).toBeInTheDocument();
    expect(screen.getAllByText(/authorized/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/captured/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /view details/i })[0]);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/payments/11/history/"));
    expect(await screen.findByText(/payment #11 details/i)).toBeInTheDocument();
    expect(screen.getByText(/webhook payload history/i)).toBeInTheDocument();
    expect(screen.getByText(/mock:key:201/i)).toBeInTheDocument();
  });
});
