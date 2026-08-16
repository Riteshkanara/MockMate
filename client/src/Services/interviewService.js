import API_BASE from '../config/api.js';
import axios from "axios";

const API = axios.create({
  baseURL: `${API_BASE}/interview`,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);


// --------------------------------------------------
// START INTERVIEW
// --------------------------------------------------

export const startInterview = async (data) => {
  try {
    const response = await API.post("/start", data);
    return response.data;
  } catch (error) {
    console.error("Start interview failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// GET ACTIVE INTERVIEW SESSION
// --------------------------------------------------

export const getInterviewSession = async (sessionId) => {
  try {
    const response = await API.get(`/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error("Get interview session failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// SUBMIT ANSWER
// --------------------------------------------------

export const submitAnswer = async (sessionId, data) => {
  try {
    const response = await API.post(
      `/${sessionId}/answer`,
      data
    );

    return response.data;
  } catch (error) {
    console.error("Submit answer failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// COMPLETE INTERVIEW
// --------------------------------------------------

export const completeInterview = async (sessionId) => {
  try {
    const response = await API.post(
      `/${sessionId}/complete`
    );

    return response.data;
  } catch (error) {
    console.error("Complete interview failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// GET INTERVIEW HISTORY
// --------------------------------------------------

export const getInterviewHistory = async () => {
  try {
    const response = await API.get("/history");
    return response.data;
  } catch (error) {
    console.error("Get interview history failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// GET INTERVIEW RESULT
// --------------------------------------------------

export const getInterviewResult = async (sessionId) => {
  try {
    const response = await API.get(
      `/${sessionId}/result`
    );

    return response.data;
  } catch (error) {
    console.error("Get interview result failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// ABANDON INTERVIEW
// --------------------------------------------------

export const abandonInterview = async (sessionId) => {
  try {
    const response = await API.post(
      `/${sessionId}/abandon`
    );

    return response.data;
  } catch (error) {
    console.error("Abandon interview failed:", error);
    throw error;
  }
};


// --------------------------------------------------
// GET BADGES
// --------------------------------------------------

export const getBadges = async () => {
  try {
    const response = await API.get("/badges");
    return response.data;
  } catch (error) {
    console.error("Get badges failed:", error);
    throw error;
  }
};

export const getPerformanceAnalytics = async () => {
    try {
      const response =
        await API.get('/performance');

      return response.data;
    } catch (error) {
      console.error(
        'Get performance analytics failed:',
        error
      );

      throw error;
    }
  };

export const getAnalytics = async () => {
    try {
      const response =
        await API.get('/analytics');

      return response.data;
    } catch (error) {
      console.error(
        'Get analytics failed:',
        error
      );

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