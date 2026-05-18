import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Cart from "../Cart";
import { api, getAuthToken } from "../../api";

jest.mock("../../api", () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
  getAuthToken: jest.fn(),
}));

describe("Cart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows login message when no token exists", async () => {
    getAuthToken.mockReturnValue(null);

    render(<Cart />);

    expect(await screen.findByText(/please login to view cart\./i)).toBeInTheDocument();
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("renders cart items and summary when data exists", async () => {
    getAuthToken.mockReturnValue("token-123");
    api.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 1,
            quantity: 2,
            medicine_detail: {
              name: "Paracetamol",
              shop_name: "Health Mart",
              price: 15,
            },
          },
        ],
      },
    });

    render(<Cart />);

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByText(/shop: health mart/i)).toBeInTheDocument();
    expect(screen.getAllByText(/₹ 30.00/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /place order/i })).toBeInTheDocument();
  });

  test("places order and clears cart", async () => {
    getAuthToken.mockReturnValue("token-123");
    api.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 1,
            quantity: 1,
            medicine_detail: {
              name: "Paracetamol",
              shop_name: "Health Mart",
              price: 15,
            },
          },
        ],
      },
    });
    api.get.mockResolvedValue({ data: { results: [] } });
    api.post
      .mockResolvedValueOnce({
        data: {
          payment: {
            id: 77,
            payment_method: "upi",
            gateway_order_id: "mock_ord_abc123",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          payment: {
            id: 77,
            payment_method: "upi",
            gateway_order_id: "mock_ord_abc123",
          },
        },
      })
      .mockResolvedValueOnce({});
    render(<Cart />);

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText(/house \/ flat no\./i), { target: { value: "A-12" } });
    fireEvent.change(screen.getByPlaceholderText(/street \/ area/i), { target: { value: "Main Street" } });
    fireEvent.change(screen.getByPlaceholderText(/^city$/i), { target: { value: "Mumbai" } });
    fireEvent.change(screen.getByPlaceholderText(/^state$/i), { target: { value: "Maharashtra" } });
    fireEvent.change(screen.getByPlaceholderText(/pincode/i), { target: { value: "400001" } });
    fireEvent.change(screen.getByPlaceholderText(/coupon code/i), { target: { value: "first50" } });
    fireEvent.change(screen.getByDisplayValue(/cash on delivery/i), { target: { value: "upi" } });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/payments/initialize/", {
        items: [1],
        payment_method: "upi",
        coupon_code: "FIRST50",
      });
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/payments/77/confirm/", { action: "capture" });
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/orders/", {
        items: [1],
        payment_method: "upi",
        payment_reference: "mock_ord_abc123",
        coupon_code: "FIRST50",
        delivery_address: "A-12, Main Street, Mumbai, Maharashtra - 400001",
        mobile_number: "9876543210",
        house_number: "A-12",
        street: "Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      });
    });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
    expect(api.delete).not.toHaveBeenCalled();
    expect(await screen.findByText(/order placed successfully/i)).toBeInTheDocument();
  });
});
