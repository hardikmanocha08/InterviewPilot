import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const nimApiKey = process.env.NVIDIA_NIM_API_KEY ?? process.env.NVIDIA_API_KEY;
if (!nimApiKey) {
  throw new Error('NVIDIA_NIM_API_KEY (or NVIDIA_API_KEY) environment variable is required');
}

const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const nimModel = process.env.NVIDIA_NIM_MODEL ?? 'meta/llama3-8b-instruct';
const sttApiKey = process.env.NVIDIA_NIM_STT_API_KEY ?? nimApiKey;
const sttBaseUrl = process.env.NVIDIA_NIM_STT_BASE_URL ?? nimBaseUrl;
const nimSttModel = process.env.NVIDIA_NIM_STT_MODEL ?? 'whisper-large-v3';
const nimSttLanguage = process.env.NVIDIA_NIM_STT_LANGUAGE;

const openai = new OpenAI({
  apiKey: nimApiKey,
  baseURL: nimBaseUrl,
});

const sttClient = new OpenAI({
  apiKey: sttApiKey,
  baseURL: sttBaseUrl,
});

export const generateInterviewQuestions = async (
  role: string,
  experienceLevel: string,
  count = 5
) => {
  const prompt = `Generate ${count} backend/frontend/fullstack interview questions for a ${role} role with ${experienceLevel} of experience. 
  Include a mix of technical, scenario-based, and behavioral questions. 
  Return ONLY a valid JSON array of objects. Each object should have 'questionText' (string) and 'difficulty' (string: Easy, Medium, Hard). Do not wrap in markdown or anything else.`;

  try {
    const completion = await openai.chat.completions.create({
      model: nimModel,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are an expert technical interviewer.' },
        { role: 'user', content: prompt },
      ],
    });

    let completionText = completion.choices[0].message?.content ?? '';
    completionText = completionText.replace(/```json/g, '').replace(/```/g, '').trim();

    let questions;
    try {
      const parsed = JSON.parse(completionText);
      questions = Array.isArray(parsed) ? parsed : parsed.questions ?? [];
    } catch (error) {
      console.error('Failed to parse AI question output:', completionText);
      throw new Error('Failed to parse questions from AI');
    }

    return questions.map((q: { questionText: string }) => ({
      questionText: q.questionText,
    }));
  } catch (error) {
    console.error('AI question generation error:', {
      status: error && typeof error === 'object' && 'status' in error ? (error as any).status : 'unknown',
      baseURL: nimBaseUrl,
      model: nimModel,
      originalError: error,
    });
    throw new Error('Failed to generate interview questions');
  }
};

export const evaluateAnswer = async (questionText: string, userAnswer: string) => {
  const prompt = `You are an expert technical interviewer. Evaluate the candidate's answer to the following question.
  Question: "${questionText}"
  Answer: "${userAnswer}"
  
  Provide a detailed evaluation in the following strict JSON format without any markdown wrapper:
  {
    "score": <number from 0 to 10>,
    "feedback": "<general feedback string>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "improvement": "<specific action to improve>"
  }`;

  const fallbackEvaluation = {
    score: 5,
    feedback:
      'Your answer was recorded, but AI evaluation is temporarily unavailable. Retry in a moment for detailed feedback.',
    strengths: ['Response submitted'],
    weaknesses: ['Could not run automated analysis'],
    improvement: 'Review your answer structure and retry for AI-generated feedback.',
  };

  try {
    const completion = await openai.chat.completions.create({
      model: nimModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are an expert technical interviewer providing feedback.' },
        { role: 'user', content: prompt },
      ],
    });

    let completionText = completion.choices[0].message?.content ?? '';
    completionText = completionText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(completionText);
      return {
        score: typeof parsed?.score === 'number' ? Math.max(0, Math.min(10, parsed.score)) : fallbackEvaluation.score,
        feedback:
          typeof parsed?.feedback === 'string' && parsed.feedback.trim()
            ? parsed.feedback
            : fallbackEvaluation.feedback,
        strengths: Array.isArray(parsed?.strengths) ? parsed.strengths : fallbackEvaluation.strengths,
        weaknesses: Array.isArray(parsed?.weaknesses) ? parsed.weaknesses : fallbackEvaluation.weaknesses,
        improvement:
          typeof parsed?.improvement === 'string' && parsed.improvement.trim()
            ? parsed.improvement
            : fallbackEvaluation.improvement,
      };
    } catch (parseError) {
      console.error('Failed to parse AI evaluation output:', completionText, parseError);
      return fallbackEvaluation;
    }
  } catch (error) {
    console.error('AI answer evaluation error:', error);
    return fallbackEvaluation;
  }
};

export const transcribeAudio = async (audioFile: File) => {
  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const upload = await toFile(
      Buffer.from(arrayBuffer),
      audioFile.name || 'recording.webm',
      { type: audioFile.type || 'audio/webm' }
    );

    const candidateModels = Array.from(
      new Set([nimSttModel, 'whisper-large-v3', 'openai/whisper-large-v3'].filter(Boolean))
    );
    let transcription: Awaited<ReturnType<typeof sttClient.audio.transcriptions.create>> | null = null;
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        transcription = await sttClient.audio.transcriptions.create({
          file: upload,
          model,
          ...(nimSttLanguage ? { language: nimSttLanguage } : {}),
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!transcription) {
      throw lastError ?? new Error('Transcription provider failed for all configured STT models.');
    }

    const text = typeof transcription?.text === 'string' ? transcription.text.trim() : '';
    if (!text) {
      throw new Error('Empty transcription received');
    }

    return text;
  } catch (error) {
    console.error('Audio transcription error:', error);
    if (error && typeof error === 'object' && 'status' in error) {
      const status = String((error as { status?: number }).status ?? 'unknown');
      throw new Error(
        `Failed to transcribe audio (status ${status}). Check NVIDIA_NIM_STT_BASE_URL and NVIDIA_NIM_STT_MODEL.`
      );
    }

    throw new Error('Failed to transcribe audio. Check STT provider configuration.');
  }
};

export const analyzeBehavioralMetrics = async (
  metrics: Array<{
    timestamp: Date;
    eyeContact: number;
    confidence: number;
    speakingPace: 'slow' | 'normal' | 'fast';
    emotionState: 'neutral' | 'positive' | 'nervous' | 'stressed';
  }>
) => {
  if (!metrics || metrics.length === 0) {
    return {
      averageEyeContact: 0,
      averageConfidence: 0,
      overallEmotionTrend: 'neutral',
      communicationFeedback: 'No behavioral data available',
    };
  }

  const avgEyeContact = Math.round(metrics.reduce((sum, m) => sum + m.eyeContact, 0) / metrics.length);
  const avgConfidence = Math.round(metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length);
  
  const emotionCounts = {
    neutral: 0,
    positive: 0,
    nervous: 0,
    stressed: 0,
  };
  metrics.forEach(m => {
    emotionCounts[m.emotionState as keyof typeof emotionCounts]++;
  });
  const dominantEmotion = Object.entries(emotionCounts).sort(([,a], [,b]) => b - a)[0][0];

  const prompt = `Analyze these behavioral metrics from a mock interview and provide constructive feedback:
  - Average Eye Contact: ${avgEyeContact}% (100% is perfect)
  - Average Confidence: ${avgConfidence}% (100% is high)
  - Dominant Emotion: ${dominantEmotion}
  - Speaking Pace Distribution: ${metrics.filter(m => m.speakingPace === 'slow').length} slow, ${metrics.filter(m => m.speakingPace === 'normal').length} normal, ${metrics.filter(m => m.speakingPace === 'fast').length} fast
  
  Provide concise, actionable feedback (2-3 sentences) on communication and non-verbal cues for an interview setting.`;

  try {
    const completion = await openai.chat.completions.create({
      model: nimModel,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are an expert communication coach providing feedback on interview communication skills.' },
        { role: 'user', content: prompt },
      ],
    });

    const feedback = completion.choices[0].message?.content ?? 'Please maintain steady eye contact and speak at a measured pace.';

    return {
      averageEyeContact: avgEyeContact,
      averageConfidence: avgConfidence,
      overallEmotionTrend: dominantEmotion,
      communicationFeedback: feedback,
    };
  } catch (error) {
    console.error('Behavioral analysis error:', error);
    return {
      averageEyeContact: avgEyeContact,
      averageConfidence: avgConfidence,
      overallEmotionTrend: dominantEmotion,
      communicationFeedback: 'Behavioral analysis temporary unavailable. Review your eye contact and speaking pace.',
    };
  }
};

export const generatePeerInterviewerPrompt = async (role: string, experienceLevel: string) => {
  const prompt = `You are an experienced technical interviewer conducting a mock interview for a ${role} position with a ${experienceLevel} candidate. Your role is to:
1. Ask relevant technical and behavioral questions
2. Ask follow-up questions based on answers
3. Evaluate responses and provide professional feedback
4. Create a realistic interview experience

Start by introducing yourself briefly and asking an opening question. Be conversational and encouraging.`;

  return prompt;
};
