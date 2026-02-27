'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

type QuestionAnalysis = {
  _id?: string;
  questionText: string;
  userAnswer: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
};

type InterviewDetail = {
  _id: string;
  role: string;
  experienceLevel: string;
  industryMode: string;
  interviewMode: 'timed' | 'untimed';
  status: 'in-progress' | 'completed';
  endedReason?: 'manual' | 'timeout' | 'abandoned';
  score: number;
  completedAt?: string;
  updatedAt: string;
  questions: QuestionAnalysis[];
};

export default function InterviewAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const response = await api.get(`/interviews/${id}`);
        setInterview(response.data);
      } catch (error) {
        console.error('Failed to load interview analysis:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadInterview();
    }
  }, [id]);

  const answeredCount = useMemo(
    () => (interview?.questions || []).filter((q) => q.userAnswer?.trim()).length,
    [interview]
  );

  if (loading) {
    return <div className="text-text-muted">Loading interview analysis...</div>;
  }

  if (!interview) {
    return <div className="text-red-400">Unable to load interview analysis.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Interview Analysis</h1>
          <p className="text-text-muted">
            {interview.role} | {interview.experienceLevel} | {interview.industryMode}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/history')}
          className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/5 transition-colors"
        >
          Back to History
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <span className="text-text-muted text-sm">Mode: <span className="text-white capitalize">{interview.interviewMode}</span></span>
        <span className="text-text-muted">|</span>
        <span className="text-text-muted text-sm">Answered: <span className="text-white">{answeredCount}/{interview.questions.length}</span></span>
        <span className="text-text-muted">|</span>
        <span className="text-text-muted text-sm">Score: <span className="text-accent font-semibold">{Number(interview.score || 0).toFixed(1)}/10</span></span>
      </div>

      <div className="space-y-4">
        {interview.questions.map((q, index) => (
          <div key={q._id || index} className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Question {index + 1}</h2>
              <span className="text-accent font-semibold">{Number(q.score || 0).toFixed(1)}/10</span>
            </div>
            <p className="text-white mb-4">{q.questionText}</p>

            <div className="mb-4">
              <p className="text-sm text-text-muted mb-1">Your Answer</p>
              <p className="text-white/90 bg-background border border-border rounded-xl p-3">
                {q.userAnswer?.trim() ? q.userAnswer : 'No answer submitted.'}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-text-muted mb-1">AI Feedback</p>
              <p className="text-white/90">{q.feedback || 'No feedback available.'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-green-400 font-medium mb-2">Strengths</p>
                <ul className="list-disc list-inside text-green-100 space-y-1">
                  {(q.strengths || []).length > 0 ? q.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>Not available</li>}
                </ul>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 font-medium mb-2">Weaknesses</p>
                <ul className="list-disc list-inside text-red-100 space-y-1">
                  {(q.weaknesses || []).length > 0 ? q.weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>Not available</li>}
                </ul>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-text-muted mb-1">Improvement Tip</p>
              <p className="text-white/90">{q.improvement || 'No improvement tip available.'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
