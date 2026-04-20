import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Signup from "../Signup";
import { api } from "../../api";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../api", () => ({
  api: { post: jest.fn() },
  setAuthToken: jest.fn(),
  getAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
}));

describe("Signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows error when password is too short", async () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/password must be at least 6 characters\./i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("submits signup data then navigates to login", async () => {
    api.post.mockResolvedValue({ data: { detail: "Signup successful. Please sign in." } });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/signup/", {
        username: "newuser",
        email: "newuser@example.com",
        password: "Password123!",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
