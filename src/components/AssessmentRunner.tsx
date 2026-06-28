import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssignmentCache, APTopic, APQuestion } from '../types/assessPro';
import {
  getAssessmentTopics, getTopicQuestions,
  startSubmission, saveAnswers, completeSubmission,
} from '../services/assessProApiClient';
import {
  ArrowLeft, ChevronRight, ChevronLeft, CheckCircle,
  Loader2, AlertCircle, Send,
} from 'lucide-react';

interface AssessmentRunnerProps {
  assignment: AssignmentCache;
  onComplete: (submissionId: string) => void;
  onClose: () => void;
}

type Phase =
  | 'loading_topics'
  | 'starting'
  | 'loading_questions'
  | 'answering'
  | 'completing'
  | 'error';

interface AnswerEntry {
  question_id: string;
  answer_id?: string;
  text_answer?: string;
}

const AssessmentRunner: React.FC<AssessmentRunnerProps> = ({ assignment, onComplete, onClose }) => {
  const [phase, setPhase] = useState<Phase>('loading_topics');
  const [error, setError] = useState('');

  const [topics, setTopics] = useState<APTopic[]>([]);
  const [topicIdx, setTopicIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  // Cache: topicId → questions[]
  const questionsCache = useRef<Record<string, APQuestion[]>>({});
  const [currentQuestions, setCurrentQuestions] = useState<APQuestion[]>([]);

  const submissionId = useRef<string>('');

  // question_id → answer_id or text
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const answersBuffer = useRef<AnswerEntry[]>([]);

  // ── Flush buffer to AssessPro ──────────────────────────────────────────────
  const flushBuffer = useCallback(async () => {
    if (!submissionId.current || answersBuffer.current.length === 0) return;
    try {
      await saveAnswers(submissionId.current, [...answersBuffer.current]);
      // Don't clear — AssessPro upserts, so duplicates are safe
    } catch {
      // non-fatal: answers will be re-sent on next flush
    }
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(flushBuffer, 30_000);
    return () => clearInterval(timer);
  }, [flushBuffer]);

  // ── Phase: load topics ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const t = await getAssessmentTopics(assignment.assesspro_assess_id);
        if (!t.length) throw new Error('No topics found for this assessment');
        setTopics(t);
        setPhase('starting');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load topics');
        setPhase('error');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase: start submission ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'starting') return;
    (async () => {
      try {
        const sub = await startSubmission(assignment.assesspro_assign_id);
        submissionId.current = sub.id;
        setPhase('loading_questions');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start assessment');
        setPhase('error');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Phase: load questions for current topic ────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading_questions') return;
    const topic = topics[topicIdx];
    if (!topic) return;

    if (questionsCache.current[topic.id]) {
      setCurrentQuestions(questionsCache.current[topic.id]);
      setQuestionIdx(0);
      setPhase('answering');
      return;
    }

    (async () => {
      try {
        const qs = await getTopicQuestions(topic.id);
        questionsCache.current[topic.id] = qs;
        setCurrentQuestions(qs);
        setQuestionIdx(0);
        setPhase('answering');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load questions');
        setPhase('error');
      }
    })();
  }, [phase, topicIdx, topics]);

  // ── Phase: complete ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'completing') return;
    (async () => {
      try {
        await flushBuffer();
        await completeSubmission(submissionId.current);
        onComplete(submissionId.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to complete assessment');
        setPhase('error');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Answer selection ───────────────────────────────────────────────────────
  const handleAnswer = (questionId: string, answerId: string) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: answerId }));
    answersBuffer.current = answersBuffer.current
      .filter(a => a.question_id !== questionId)
      .concat({ question_id: questionId, answer_id: answerId });
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: text }));
    answersBuffer.current = answersBuffer.current
      .filter(a => a.question_id !== questionId)
      .concat({ question_id: questionId, text_answer: text });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = async () => {
    if (phase !== 'answering') return;
    const isLastQuestion = questionIdx >= currentQuestions.length - 1;
    const isLastTopic = topicIdx >= topics.length - 1;

    if (!isLastQuestion) {
      setQuestionIdx(q => q + 1);
      return;
    }
    if (!isLastTopic) {
      await flushBuffer();
      setTopicIdx(t => t + 1);
      setPhase('loading_questions');
      return;
    }
    // Last question of last topic — complete
    setPhase('completing');
  };

  const goPrev = async () => {
    if (phase !== 'answering') return;
    if (questionIdx > 0) {
      setQuestionIdx(q => q - 1);
      return;
    }
    if (topicIdx > 0) {
      await flushBuffer();
      const prevIdx = topicIdx - 1;
      const prevTopic = topics[prevIdx];
      const cachedQs = questionsCache.current[prevTopic.id];
      setTopicIdx(prevIdx);
      if (cachedQs) {
        setCurrentQuestions(cachedQs);
        setQuestionIdx(cachedQs.length - 1);
        setPhase('answering');
      } else {
        setPhase('loading_questions');
      }
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isLastQuestion = phase === 'answering' && questionIdx >= currentQuestions.length - 1;
  const isLastTopic    = topicIdx >= topics.length - 1;
  const currentQ       = currentQuestions[questionIdx] ?? null;
  const selectedAnswer = currentQ ? localAnswers[currentQ.id] : undefined;

  // How many questions in a topic have a local answer
  const topicAnsweredCount = (topic: APTopic) => {
    const qs = questionsCache.current[topic.id] ?? [];
    return qs.filter(q => localAnswers[q.id]).length;
  };

  // ── Render: loading / starting ─────────────────────────────────────────────
  if (phase === 'loading_topics' || phase === 'starting') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {phase === 'loading_topics' ? 'Loading assessment…' : 'Starting assessment…'}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'loading_questions') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading topic {topicIdx + 1} of {topics.length}…</p>
        </div>
      </div>
    );
  }

  if (phase === 'completing') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Submitting assessment…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => { setError(''); setPhase('loading_topics'); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button onClick={onClose} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: answering ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center space-x-3 shadow-sm flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm truncate">{assignment.assessment_title}</h2>
          <p className="text-xs text-gray-500">
            Topic {topicIdx + 1} of {topics.length}
          </p>
        </div>
        {/* Overall progress pill */}
        <div className="flex-shrink-0 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {Object.keys(localAnswers).length} answered
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Topic sidebar */}
        <div className="hidden md:flex w-56 flex-shrink-0 border-r border-gray-200 flex-col bg-gray-50 overflow-y-auto">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Topics</div>
          <nav className="flex-1">
            {topics.map((topic, idx) => {
              const answered = topicAnsweredCount(topic);
              const total = questionsCache.current[topic.id]?.length ?? topic.question_count;
              const isCurrent = idx === topicIdx;
              const isDone = answered === total && total > 0;
              return (
                <button
                  key={topic.id}
                  onClick={async () => {
                    if (isCurrent || phase !== 'answering') return;
                    await flushBuffer();
                    setTopicIdx(idx);
                    setPhase('loading_questions');
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 text-left transition-colors text-sm ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex-1 truncate">{idx + 1}. {topic.title}</span>
                  {isDone ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : answered > 0 ? (
                    <span className="text-xs text-gray-400 flex-shrink-0">{answered}/{total}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {currentQ ? (
            <div className="flex-1 px-6 py-6 max-w-2xl mx-auto w-full">
              {/* Topic name (mobile) */}
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 md:hidden">
                {topics[topicIdx]?.title}
              </p>
              {/* Question counter */}
              <p className="text-sm text-gray-500 mb-4">
                Question {questionIdx + 1} of {currentQuestions.length}
              </p>

              {/* Question text */}
              <h3 className="text-lg font-semibold text-gray-900 leading-snug mb-6">
                {currentQ.question}
              </h3>

              {/* Answer options */}
              {currentQ.type === 'free_text' ? (
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={5}
                  placeholder="Type your answer here…"
                  value={localAnswers[currentQ.id] ?? ''}
                  onChange={e => handleTextAnswer(currentQ.id, e.target.value)}
                />
              ) : (
                <div className="space-y-3">
                  {currentQ.answers.map(answer => {
                    const isSelected = selectedAnswer === answer.id;
                    return (
                      <button
                        key={answer.id}
                        onClick={() => handleAnswer(currentQ.id, answer.id)}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm text-gray-800">{answer.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No questions in this topic
            </div>
          )}

          {/* Navigation footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button
              onClick={goPrev}
              disabled={topicIdx === 0 && questionIdx === 0}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {isLastQuestion && isLastTopic ? (
              <button
                onClick={goNext}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Complete Assessment</span>
              </button>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <span>{isLastQuestion ? 'Next Topic' : 'Next'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentRunner;
