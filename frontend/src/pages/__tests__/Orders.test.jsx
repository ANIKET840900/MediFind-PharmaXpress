import { render, screen } from "@testing-library/react";
import Orders from "../Orders";
import { api, getAuthToken } from "../../api";

jest.mock("../../api", () => ({
  api: {
    get: jest.fn(),
  },
  getAuthToken: jest.fn(),
}));

describe("Orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows login message when no token exists", async () => {
    getAuthToken.mockReturnValue(null);

    render(<Orders />);

    expect(await screen.findByText(/please login to view orders\./i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("renders orders and line items", async () => {
    getAuthToken.mockReturnValue("token-123");
    api.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 99,
            created_at: "2026-04-13T10:00:00Z",
            items_detail: [
              {
                id: 1,
                quantity: 2,
                medicine_detail: {
                  name: "Paracetamol",
                  price: 15,
                },
              },
            ],
          },
        ],
      },
    });

    render(<Orders />);

    expect(await screen.findByText(/order #99/i)).toBeInTheDocument();
    expect(screen.getByText(/paracetamol/i)).toBeInTheDocument();
    expect(screen.getByText(/× 2/i)).toBeInTheDocument();
    expect(screen.getByText(/₹ 30.00/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^placed$/i).length).toBeGreaterThan(0);
  });
});
