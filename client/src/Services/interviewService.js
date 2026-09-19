import API_BASE from '../config/api.js';
import axios from "axios";

const API = axios.create({
  baseURL: `${API_BASE}/interview`,
  withCredentials: true,
});

// NOTE: On 401 → try /auth/refresh → retry once → if still 401 → redirect to home
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        return API(originalRequest);
      } catch (_) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const startInterview = async (data) => {
  try {
    const response = await API.post('/start', data);
    return response.data;
  } catch (error) {
    console.error('Start interview failed:', error);
    throw error;
  }
};

export const getInterviewSession = async (sessionId) => {
  try {
    const response = await API.get(`/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Get interview session failed:', error);
    throw error;
  }
};

export const submitAnswer = async (sessionId, data) => {
  try {
    const response = await API.post(`/${sessionId}/answer`, data);
    return response.data;
  } catch (error) {
    console.error('Submit answer failed:', error);
    throw error;
  }
};

export const completeInterview = async (sessionId) => {
  try {
    const response = await API.post(`/${sessionId}/complete`);
    return response.data;
  } catch (error) {
    console.error('Complete interview failed:', error);
    throw error;
  }
};

export const retryQuestion = async (sessionId, questionId) => {
  try {
    const response = await API.post(`/${sessionId}/retry/${questionId}`);
    return response.data;
  } catch (error) {
    console.error('Retry question failed:', error);
    throw error;
  }
};

export const getInterviewHistory = async () => {
  try {
    const response = await API.get('/history');
    return response.data;
  } catch (error) {
    console.error('Get interview history failed:', error);
    throw error;
  }
};

export const getInterviewResult = async (sessionId) => {
  try {
    const response = await API.get(`/${sessionId}/result`);
    return response.data;
  } catch (error) {
    console.error('Get interview result failed:', error);
    throw error;
  }
};

export const abandonInterview = async (sessionId) => {
  try {
    const response = await API.post(`/${sessionId}/abandon`);
    return response.data;
  } catch (error) {
    console.error('Abandon interview failed:', error);
    throw error;
  }
};

export const getBadges = async () => {
  try {
    const response = await API.get('/badges');
    return response.data;
  } catch (error) {
    console.error('Get badges failed:', error);
    throw error;
  }
};

export const getAnalytics = async () => {
  try {
    const response = await API.get('/performance');
    return response.data;
  } catch (error) {
    console.error('Get performance analytics failed:', error);
    throw error;
  }
};

export const getDashboardAnalytics = async () => {
  try {
    const response = await API.get('/analytics');
    return response.data;
  } catch (error) {
    console.error('Get analytics failed:', error);
    throw error;
  }
};

export const getAICoach = async () => {
  try {
    const response = await API.post('/ai-coach');
    return response.data;
  } catch (error) {
    console.error('Get AI coach failed:', error);
    throw error;
  }
};

export const getLastSessionBreakdown = async () => {
  try {
    const response = await API.get('/session/last/breakdown');
    return response.data;
  } catch (error) {
    console.error('Get last session breakdown failed:', error);
    throw error;
  }
};

export const getBlindSpots = async () => {
  try {
    const response = await API.get('/blind-spots');
    return response.data;
  } catch (error) {
    console.error('Get blind spots failed:', error);
    throw error;
  }
};

export const getSessionWarmup = async () => {
  try {
    const response = await API.get('/session-warmup');
    return response.data;
  } catch (error) {
    console.error('Get session warmup failed:', error);
    throw error;
  }
};

export const getAIFreeform = async (prompt, maxTokens = 400) => {
  try {
    const response = await API.post('/ai-freeform', { prompt, maxTokens });
    return response.data?.text || '';
  } catch (error) {
    console.error('Get AI freeform failed:', error);
    throw error;
  }
};

// NOTE: Uses direct axios (not API instance) — this route lives on /auth, not /interview
export const fixBadges = async () => {
  try {
    const response = await axios.post(
      `${API_BASE}/auth/fix-badges`,
      {},
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    console.error('Fix badges failed:', error);
    throw error;
  }
};