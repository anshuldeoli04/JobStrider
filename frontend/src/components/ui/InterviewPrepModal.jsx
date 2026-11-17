import { useState, useEffect } from 'react';
import { Sparkles, Brain, CheckCircle2, Copy, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import ModalDialog from './ModalDialog.jsx';
import { api } from '../../api/client.js';

export default function InterviewPrepModal({ open, onClose, application }) {
  const [activeTab, setActiveTab] = useState('star');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prepData, setPrepData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !application) {
      setPrepData(null);
      setError(null);
      return;
    }

    // Check if application already has structured dossier prep data (not just initial question strings)
    const hasDossier =
      application.interview_prep &&
      typeof application.interview_prep === 'object' &&
      !Array.isArray(application.interview_prep) &&
      (Boolean(application.interview_prep.behavioral_questions) || Boolean(application.interview_prep.technical_questions));

    if (hasDossier) {
      setPrepData(application.interview_prep);
    } else {
      // Try to fetch existing dossier from API
      api.getInterviewPrep(application.id)
        .then((res) => {
          if (res?.prepData && typeof res.prepData === 'object' && !Array.isArray(res.prepData)) {
            setPrepData(res.prepData);
          }
        })
        .catch(() => {});
    }
  }, [open, application]);

  const handleGenerate = async () => {
    if (!application?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateInterviewPrep(application.id);
      if (res?.prepData) {
        setPrepData(res.prepData);
      } else {
        setError('Failed to generate interview prep. Please check your Gemini API key.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!prepData) return;
    const text = JSON.stringify(prepData, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!application) return null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      wide
      icon={<Brain className="w-5 h-5 text-indigo-500" />}
      title={`Interview Prep: ${application.company} — ${application.role}`}
      subtitle={`Stage-specific dossier with grounded STAR stories, technical deep-dives, and honest gap bridges.`}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!prepData && !loading && (
          <div className="text-center py-10 space-y-4 bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-slate-100">Ready to Ace Your Interview?</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Generate personalized STAR interview answers from your real CV projects, technical deep-dives on the job requirements, and honest bridge answers.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-lg shadow-indigo-600/25 transition-all inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Interview Prep Pack
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-slate-300 font-medium">Analyzing job requirements & structuring STAR stories...</p>
            <p className="text-xs text-slate-500">Takes about 10-15 seconds via Google Gemini</p>
          </div>
        )}

        {prepData && (
          <div className="space-y-4">
            {/* Context Box */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-xs space-y-1">
              <div><span className="font-semibold text-slate-300">Company Context:</span> <span className="text-slate-400">{prepData.company_overview}</span></div>
              <div><span className="font-semibold text-slate-300">Role Mission:</span> <span className="text-slate-400">{prepData.role_mission}</span></div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-700/80 gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab('star')}
                className={`pb-2 border-b-2 transition-all ${activeTab === 'star' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                🌟 STAR Stories ({prepData.behavioral_questions?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('tech')}
                className={`pb-2 border-b-2 transition-all ${activeTab === 'tech' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                💻 Technical Q&A ({prepData.technical_questions?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('gaps')}
                className={`pb-2 border-b-2 transition-all ${activeTab === 'gaps' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                🌉 Gap Bridges ({prepData.gap_bridges?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('interviewer')}
                className={`pb-2 border-b-2 transition-all ${activeTab === 'interviewer' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                ❓ Questions to Ask ({prepData.questions_for_interviewer?.length || 0})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3">
              {activeTab === 'star' && (
                <div className="space-y-3">
                  {(prepData.behavioral_questions || []).map((bq, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 text-sm">"{bq.question}"</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-medium">
                          {bq.target_competency || 'Behavioral'}
                        </span>
                      </div>
                      {bq.star_story && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-700/40 text-slate-300">
                          <div><span className="font-semibold text-slate-400">Situation:</span> {bq.star_story.situation}</div>
                          <div><span className="font-semibold text-slate-400">Task:</span> {bq.star_story.task}</div>
                          <div><span className="font-semibold text-slate-400">Action:</span> {bq.star_story.action}</div>
                          <div><span className="font-semibold text-emerald-400">Result:</span> {bq.star_story.result}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tech' && (
                <div className="space-y-3">
                  {(prepData.technical_questions || []).map((tq, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="font-semibold text-slate-200 text-sm">{tq.question}</div>
                      <div className="text-[11px] text-indigo-400 font-mono">Topic: {tq.topic}</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1 pt-1">
                        {(tq.key_talking_points || []).map((pt, pIdx) => (
                          <li key={pIdx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'gaps' && (
                <div className="space-y-3">
                  {(prepData.gap_bridges || []).map((gb, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-amber-500/20 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="font-semibold text-amber-300">Skill Gap: {gb.missing_skill}</div>
                      <div className="text-slate-300 italic bg-slate-900/40 p-2 rounded border border-slate-800">
                        "{gb.suggested_bridge}"
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'interviewer' && (
                <div className="space-y-2">
                  {(prepData.questions_for_interviewer || []).map((q, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-2.5 text-xs text-slate-200 flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">{idx + 1}.</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Re-generate
              </button>
              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
