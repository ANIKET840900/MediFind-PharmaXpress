import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Login from "../Login";
import { api, setAuthToken } from "../../api";

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

describe("Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submits username and password then navigates to home", async () => {
    api.post.mockResolvedValue({ data: { token: "abc123" } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "user1" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/login/", {
        username: "user1",
        password: "Password123!",
      });
    });
    expect(setAuthToken).toHaveBeenCalledWith("abc123");
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
  });

  test("shows backend error when login fails", async () => {
    api.post.mockRejectedValue({ response: { data: { detail: "Invalid password." } } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "user1" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "bad" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid password\./i)).toBeInTheDocument();
  });
});
