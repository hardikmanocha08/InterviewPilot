import OpenAI from 'openai';

const nimApiKey = process.env.NVIDIA_NIM_API_KEY ?? process.env.NVIDIA_API_KEY;
if (!nimApiKey) {
  throw new Error('NVIDIA_NIM_API_KEY (or NVIDIA_API_KEY) environment variable is required');
}

const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const nimModel = process.env.NVIDIA_NIM_MODEL ?? 'meta/llama-3.1-70b-instruct';
const nimSttModel = process.env.NVIDIA_NIM_STT_MODEL ?? 'openai/whisper-large-v3';
const nimSttLanguage = process.env.NVIDIA_NIM_STT_LANGUAGE;

const openai = new OpenAI({
  apiKey: nimApiKey,
  baseURL: nimBaseUrl,
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
    console.error('AI question generation error:', error);
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
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: nimSttModel,
      ...(nimSttLanguage ? { language: nimSttLanguage } : {}),
    });

    const text = typeof transcription?.text === 'string' ? transcription.text.trim() : '';
    if (!text) {
      throw new Error('Empty transcription received');
    }

    return text;
  } catch (error) {
    console.error('Audio transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
};
