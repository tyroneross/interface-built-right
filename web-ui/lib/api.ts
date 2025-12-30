import type {
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  BatchCheckRequest,
  BatchCheckResponse,
  FeedbackRequest,
  FeedbackResponse,
  GetFeedbackResponse,
  ComparisonReport,
  ApiError,
} from './types';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error || 'An error occurred');
    }
    return response.json();
  }

  async getSessions(): Promise<Session[]> {
    const response = await fetch(`${this.baseUrl}/sessions`);
    const data = await this.handleResponse<{ sessions: Session[] }>(response);
    return data.sessions;
  }

  async getSession(id: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`);
    const data = await this.handleResponse<{ session: Session }>(response);
    return data.session;
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    const data = await this.handleResponse<CreateSessionResponse>(response);
    return data.session;
  }

  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'DELETE',
    });
    await this.handleResponse<{ success: boolean }>(response);
  }

  async checkSession(id: string): Promise<ComparisonReport> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}/check`, {
      method: 'POST',
    });
    return this.handleResponse<ComparisonReport>(response);
  }

  async acceptSession(id: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}/accept`, {
      method: 'POST',
    });
    const data = await this.handleResponse<{ session: Session }>(response);
    return data.session;
  }

  async batchCheck(sessionIds: string[]): Promise<BatchCheckResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/batch-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionIds } satisfies BatchCheckRequest),
    });
    return this.handleResponse<BatchCheckResponse>(response);
  }

  async submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    const response = await fetch(`${this.baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return this.handleResponse<FeedbackResponse>(response);
  }

  async getFeedback(): Promise<GetFeedbackResponse['feedback']> {
    const response = await fetch(`${this.baseUrl}/feedback`);
    const data = await this.handleResponse<GetFeedbackResponse>(response);
    return data.feedback;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience
export const getSessions = () => apiClient.getSessions();
export const getSession = (id: string) => apiClient.getSession(id);
export const createSession = (request: CreateSessionRequest) =>
  apiClient.createSession(request);
export const deleteSession = (id: string) => apiClient.deleteSession(id);
export const checkSession = (id: string) => apiClient.checkSession(id);
export const acceptSession = (id: string) => apiClient.acceptSession(id);
export const batchCheck = (sessionIds: string[]) =>
  apiClient.batchCheck(sessionIds);
export const submitFeedback = (request: FeedbackRequest) =>
  apiClient.submitFeedback(request);
export const getFeedback = () => apiClient.getFeedback();
