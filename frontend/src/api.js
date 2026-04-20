import axios from "axios";

const TOKEN_KEY = "medcompare_token";
const AUTH_FREE_ENDPOINTS = [
	"/auth/login/",
	"/auth/signup/",
	"/auth/forgot-username/",
	"/auth/forgot-password/",
];

const normalizeToken = (token) => {
	if (!token || typeof token !== "string") {
		return "";
	}
	return token.replace(/^"|"$/g, "").trim();
};

const isAuthFreeEndpoint = (url = "") => AUTH_FREE_ENDPOINTS.some((endpoint) => String(url).includes(endpoint));

export const getAuthToken = () => normalizeToken(localStorage.getItem(TOKEN_KEY));

export const setAuthToken = (token) => {
	const normalized = normalizeToken(token);
	if (!normalized) {
		localStorage.removeItem(TOKEN_KEY);
		return;
	}
	localStorage.setItem(TOKEN_KEY, normalized);
};

export const clearAuthToken = () => {
	localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({
	baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
});

api.interceptors.request.use((config) => {
	const token = getAuthToken();
	if (token && !isAuthFreeEndpoint(config.url)) {
		config.headers.Authorization = `Token ${token}`;
	} else if (config.headers?.Authorization) {
		delete config.headers.Authorization;
	}
	return config;
});

api.interceptors.response.use(
	(response) => response,
	(error) => {
		const status = error?.response?.status;
		const detail = String(error?.response?.data?.detail || "").toLowerCase();
		if (status === 401 && detail.includes("invalid token")) {
			clearAuthToken();
		}
		return Promise.reject(error);
	}
);
