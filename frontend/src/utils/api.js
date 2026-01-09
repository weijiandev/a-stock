import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 20000
});

export const fetchStockData = async (symbol, startDate, endDate) => {
  const response = await apiClient.get(`/api/stocks/${symbol}`, {
    params: { start_date: startDate, end_date: endDate }
  });
  return response.data;
};

export const fetchSignals = async (symbol, startDate, endDate) => {
  const response = await apiClient.get(`/api/signals/${symbol}`, {
    params: { start_date: startDate, end_date: endDate }
  });
  return response.data;
};

export const fetchSummary = async (symbol, startDate, endDate) => {
  const response = await apiClient.get(`/api/summary/${symbol}`, {
    params: { start_date: startDate, end_date: endDate }
  });
  return response.data;
};
