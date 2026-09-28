
import ENDPOINTS, { API_URL } from '@/config/apiConfig';
import { postData } from '@/lib/api/crud';

// Auth services
const feedbackService = {
  // Register a new provider
  create: async (feedback: {
    subject: string;
    content: string;
    rating: number | null;
    feedback_type: string;
  }) => {
    try {
      const data = JSON.stringify({
        subject: feedback.subject,
        content: feedback.content,
        rating: feedback.rating,
        feedback_type: feedback.feedback_type
      });
      const response = await postData(`${ENDPOINTS.FEEDBACK}/`, feedback, 'application/json');
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
};

export default feedbackService;