import React, { useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from './supabase'

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultSurvey = {
  id: 'survey-mobile-demo',
  title: '语音访谈原型',
  description: '逐题收集语音回答，支持手机浏览器使用。',
  requireName: true,
  welcomeTitle: '欢迎参与访谈',
  welcomeText: '请先填写你的姓名，然后开始回答问题。',
  outroTitle: '提交完成',
  outroText: '你的录音和回答已经保存在当前浏览器中。',
  pages: [
    {
      id: uid(),
      title: '热身问题',
      description: '先做一个简单自我介绍。',
      questions: [
        {
          id: uid(),
          type: 'voice',
          title: '请简单介绍一下你自己。',
          helper: '建议 10 到 60 秒。',
          minSeconds: 0,
          maxSeconds: 60,
          optional: false,
        },
      ],
    },
    {
      id: uid(),
      title: '正式问题',
      description: '请更详细地描述你的体验。',
      questions: [
        {
          id: uid(),
          type: 'voice',
          title: '这次体验中最让你印象深刻的是什么？',
          helper: '请自然回答，不用着急。',
          minSeconds: 0,
          maxSeconds: 120,
          optional: false,
        },
      ],
    },
  ],
};

function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => getStored(key, initialValue));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function formatSeconds(value) {
  const safe = Math.max(0, Number(value || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionCard({ title, subtitle, children, compact = false }) {
  return (
    <section className={`card ${compact ? 'card-compact' : ''}`}>
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function VoiceRecorder({ onSaved, minSeconds = 0, maxSeconds = 90 }) {
  const [permissionError, setPermissionError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopRecording = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    try {
      setPermissionError('');
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setPermissionError('当前浏览器不支持网页录音。请使用较新的 Safari、Chrome 或 Edge，并通过 https 打开页面。');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setElapsed(0);
      setIsRecording(true);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      setPermissionError('麦克风权限被拒绝，请在浏览器中允许麦克风访问后重试。');
    }
  };

  const saveRecording = async () => {
    if (!audioBlob) return;
    const base64 = await blobToBase64(audioBlob);
    onSaved({
      dataUrl: base64,
      durationSeconds: elapsed,
      mimeType: audioBlob.type || 'audio/webm',
      savedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="recorder">
      <div className="recorder-top">
        {!isRecording ? (
          <button className="btn btn-primary" onClick={startRecording}>开始录音</button>
        ) : (
          <button className="btn btn-danger" onClick={stopRecording}>停止录音</button>
        )}
        <div className="pill">{formatSeconds(elapsed)}</div>
      </div>
      <div className="helper-text">时长限制：{formatSeconds(minSeconds)} - {formatSeconds(maxSeconds)}</div>
      {isRecording ? <div className="recording-dot">● 正在录音</div> : null}
      {permissionError ? <div className="error-text">{permissionError}</div> : null}
      {audioUrl ? (
        <div className="audio-preview">
          <audio controls src={audioUrl} className="audio-element" />
          <button className="btn btn-secondary" onClick={saveRecording}>使用这段录音</button>
        </div>
      ) : null}
    </div>
  );
}

function Builder({ survey, setSurvey, submissions, setMode }) {
  const [selectedPageId, setSelectedPageId] = useState(survey.pages[0]?.id || '');
  const selectedPage = survey.pages.find((p) => p.id === selectedPageId) || survey.pages[0];

  useEffect(() => {
    if (!selectedPageId && survey.pages[0]) setSelectedPageId(survey.pages[0].id);
  }, [selectedPageId, survey.pages]);

  const updateSurvey = (patch) => setSurvey((prev) => ({ ...prev, ...patch }));

  const addPage = () => {
    const page = {
      id: uid(),
      title: `页面 ${survey.pages.length + 1}`,
      description: '',
      questions: [
        {
          id: uid(),
          type: 'voice',
          title: '新的语音问题',
          helper: '',
          minSeconds: 0,
          maxSeconds: 90,
          optional: false,
        },
      ],
    };
    setSurvey((prev) => ({ ...prev, pages: [...prev.pages, page] }));
    setSelectedPageId(page.id);
  };

  const updatePage = (pageId, patch) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    }));
  };

  const deletePage = (pageId) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.filter((p) => p.id !== pageId),
    }));
  };

  const duplicatePage = (pageId) => {
    const target = survey.pages.find((p) => p.id === pageId);
    if (!target) return;
    const copy = {
      ...target,
      id: uid(),
      title: `${target.title} - 复制`,
      questions: target.questions.map((q) => ({ ...q, id: uid() })),
    };
    setSurvey((prev) => ({ ...prev, pages: [...prev.pages, copy] }));
    setSelectedPageId(copy.id);
  };

  const addQuestion = (pageId) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              questions: [
                ...p.questions,
                {
                  id: uid(),
                  type: 'voice',
                  title: '新的语音问题',
                  helper: '',
                  minSeconds: 0,
                  maxSeconds: 90,
                  optional: false,
                },
              ],
            }
          : p
      ),
    }));
  };

  const updateQuestion = (pageId, qId, patch) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              questions: p.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
            }
          : p
      ),
    }));
  };

  const deleteQuestion = (pageId, qId) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? { ...p, questions: p.questions.filter((q) => q.id !== qId) }
          : p
      ),
    }));
  };

  const duplicateQuestion = (pageId, qId) => {
    setSurvey((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const index = p.questions.findIndex((q) => q.id === qId);
        if (index < 0) return p;
        const target = p.questions[index];
        const copy = { ...target, id: uid(), title: `${target.title} - 复制` };
        const next = [...p.questions];
        next.splice(index + 1, 0, copy);
        return { ...p, questions: next };
      }),
    }));
  };

  return (
    <div className="stack">
      <SectionCard title="基础设置" subtitle="设置访谈标题、欢迎页和结束页。">
        <div className="form-grid">
          <Field label="访谈标题"><input value={survey.title} onChange={(e) => updateSurvey({ title: e.target.value })} /></Field>
          <Field label="访谈描述"><textarea value={survey.description} onChange={(e) => updateSurvey({ description: e.target.value })} rows={3} /></Field>
          <Field label="欢迎标题"><input value={survey.welcomeTitle} onChange={(e) => updateSurvey({ welcomeTitle: e.target.value })} /></Field>
          <Field label="欢迎文字"><textarea value={survey.welcomeText} onChange={(e) => updateSurvey({ welcomeText: e.target.value })} rows={3} /></Field>
          <Field label="结束标题"><input value={survey.outroTitle} onChange={(e) => updateSurvey({ outroTitle: e.target.value })} /></Field>
          <Field label="结束文字"><textarea value={survey.outroText} onChange={(e) => updateSurvey({ outroText: e.target.value })} rows={3} /></Field>
        </div>
        <label className="switch-row">
          <span>要求填写姓名</span>
          <input type="checkbox" checked={survey.requireName} onChange={(e) => updateSurvey({ requireName: e.target.checked })} />
        </label>
      </SectionCard>

      <SectionCard title="页面管理" subtitle="适配手机后，页面会纵向堆叠，单手也比较容易操作。">
        <div className="page-list">
          {survey.pages.map((page, index) => (
            <button
              key={page.id}
              className={`page-item ${selectedPage?.id === page.id ? 'page-item-active' : ''}`}
              onClick={() => setSelectedPageId(page.id)}
            >
              <div className="page-item-top">
                <div>
                  <div className="small-muted">第 {index + 1} 页</div>
                  <strong>{page.title || '未命名页面'}</strong>
                </div>
                <div className="page-actions">
                  <span onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }}>复制</span>
                  <span onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}>删除</span>
                </div>
              </div>
              <div className="small-muted">{page.questions.length} 个问题</div>
            </button>
          ))}
        </div>
        <div className="row-buttons">
          <button className="btn btn-secondary" onClick={addPage}>新增页面</button>
          <button className="btn btn-secondary" onClick={() => setMode('participant')}>预览答题</button>
          <button className="btn btn-secondary" onClick={() => setMode('results')}>查看结果</button>
        </div>
      </SectionCard>

      {selectedPage ? (
        <SectionCard title="当前页面编辑" subtitle="所有问题都默认是语音题。">
          <div className="form-grid">
            <Field label="页面标题"><input value={selectedPage.title} onChange={(e) => updatePage(selectedPage.id, { title: e.target.value })} /></Field>
            <Field label="页面说明"><textarea rows={2} value={selectedPage.description} onChange={(e) => updatePage(selectedPage.id, { description: e.target.value })} /></Field>
          </div>

          <div className="question-list">
            {selectedPage.questions.map((q, idx) => (
              <div className="question-card" key={q.id}>
                <div className="question-head">
                  <div>
                    <div className="small-muted">问题 {idx + 1}</div>
                    <strong>语音回答</strong>
                  </div>
                  <div className="page-actions">
                    <span onClick={() => duplicateQuestion(selectedPage.id, q.id)}>复制</span>
                    <span onClick={() => deleteQuestion(selectedPage.id, q.id)}>删除</span>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="问题内容"><textarea rows={3} value={q.title} onChange={(e) => updateQuestion(selectedPage.id, q.id, { title: e.target.value })} /></Field>
                  <Field label="辅助说明"><textarea rows={2} value={q.helper} onChange={(e) => updateQuestion(selectedPage.id, q.id, { helper: e.target.value })} /></Field>
                  <Field label="最短秒数"><input type="number" min="0" value={q.minSeconds} onChange={(e) => updateQuestion(selectedPage.id, q.id, { minSeconds: Number(e.target.value || 0) })} /></Field>
                  <Field label="最长秒数"><input type="number" min="1" value={q.maxSeconds} onChange={(e) => updateQuestion(selectedPage.id, q.id, { maxSeconds: Number(e.target.value || 1) })} /></Field>
                </div>
                <label className="switch-row">
                  <span>允许跳过</span>
                  <input type="checkbox" checked={q.optional} onChange={(e) => updateQuestion(selectedPage.id, q.id, { optional: e.target.checked })} />
                </label>
              </div>
            ))}
          </div>
          <button className="btn btn-primary full-width" onClick={() => addQuestion(selectedPage.id)}>新增语音问题</button>
        </SectionCard>
      ) : null}

      <SectionCard title="当前浏览器中的数据" subtitle="目前仍然是本地存储，适合原型测试。" compact>
        <div className="stats-row">
          <div>已保存结果</div>
          <strong>{submissions.length}</strong>
        </div>
      </SectionCard>
    </div>
  );
}

function Participant({ survey, submissions, setSubmissions, setMode }) {
  const flatQuestions = useMemo(() => {
    const items = [];
    survey.pages.forEach((page, pageIndex) => {
      page.questions.forEach((question, questionIndex) => {
        items.push({ page, question, pageIndex, questionIndex });
      });
    });
    return items;
  }, [survey]);

  const [step, setStep] = useState(-1);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState({});
  const [submittedId, setSubmittedId] = useState(null);

  const totalSteps = flatQuestions.length;
  const current = flatQuestions[step];

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goNext = async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      return;
    }
  
    const submission = {
      id: uid(),
      participantName: name.trim(),
      surveyId: survey.id,
      surveyTitle: survey.title,
      submittedAt: new Date().toISOString(),
      answers: flatQuestions.map((item) => ({
        pageId: item.page.id,
        pageTitle: item.page.title,
        questionId: item.question.id,
        questionTitle: item.question.title,
        helper: item.question.helper,
        response: answers[item.question.id] || null,
      })),
    };
  
    try {
      // 👉 写入 Supabase
      const { error } = await supabase.from('submissions').insert([
        {
          participant_name: submission.participantName,
          survey_title: submission.surveyTitle,
          answers: submission.answers,
          audio_files: submission.answers.map(a => a.response)
        }
      ]);
  
      if (error) {
        console.error('上传失败:', error);
        alert('提交失败，请检查网络或配置');
        return;
      }
  
      console.log('提交成功');
  
    } catch (err) {
      console.error(err);
      alert('发生错误');
      return;
    }
  
    // 👉 保留本地（方便调试）
    setSubmissions((prev) => [submission, ...prev]);
  
    setSubmittedId(submission.id);
    setStep(totalSteps);
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  if (step === -1) {
    return (
      <SectionCard title={survey.welcomeTitle || survey.title} subtitle={survey.welcomeText || survey.description}>
        {survey.requireName ? (
          <Field label="你的姓名">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" />
          </Field>
        ) : null}
        <div className="row-buttons">
          <button className="btn btn-primary" disabled={survey.requireName && !name.trim()} onClick={() => setStep(0)}>开始访谈</button>
          <button className="btn btn-secondary" onClick={() => setMode('builder')}>返回编辑器</button>
        </div>
      </SectionCard>
    );
  }

  if (step >= totalSteps) {
    const latest = submissions.find((s) => s.id === submittedId);
    return (
      <SectionCard title={survey.outroTitle} subtitle={survey.outroText}>
        <div className="result-box">
          <div className="small-muted">参与者</div>
          <strong>{latest?.participantName || '匿名用户'}</strong>
        </div>
        <div className="row-buttons">
          <button className="btn btn-primary" onClick={() => setMode('results')}>查看结果</button>
          <button className="btn btn-secondary" onClick={() => { setAnswers({}); setStep(-1); setSubmittedId(null); setName(''); }}>重新开始</button>
        </div>
      </SectionCard>
    );
  }

  const currentAnswer = answers[current.question.id];
  const canProceed = current.question.optional || !!currentAnswer;

  return (
    <div className="stack">
      <SectionCard title={current.page.title} subtitle={`${step + 1} / ${totalSteps}`} compact>
        <div className="small-muted">{survey.title}</div>
      </SectionCard>
      <SectionCard title={current.question.title} subtitle={current.question.helper || current.page.description}>
        <VoiceRecorder
          minSeconds={current.question.minSeconds}
          maxSeconds={current.question.maxSeconds}
          onSaved={(recording) => setAnswer(current.question.id, recording)}
        />

        {currentAnswer ? (
          <div className="result-box">
            <div className="small-muted">录音已保存</div>
            <audio controls src={currentAnswer.dataUrl} className="audio-element" />
            <div className="small-muted">时长：{formatSeconds(currentAnswer.durationSeconds)}</div>
          </div>
        ) : null}

        <div className="row-buttons between">
          <button className="btn btn-secondary" disabled={step === 0} onClick={goBack}>上一题</button>
          <div className="row-buttons compact-right">
            {current.question.optional && !currentAnswer ? <button className="btn btn-secondary" onClick={goNext}>跳过</button> : null}
            <button className="btn btn-primary" disabled={!canProceed} onClick={goNext}>{step === totalSteps - 1 ? '完成提交' : '下一题'}</button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Results({ survey, setMode }) {
  const [remoteSubmissions, setRemoteSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSubmissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('读取 submissions 失败:', error);
      alert('读取结果失败，请检查 Supabase 配置');
      setLoading(false);
      return;
    }

    const formatted = (data || []).map((item) => ({
      id: item.id,
      participantName: item.participant_name,
      surveyTitle: item.survey_title,
      submittedAt: item.submitted_at,
      answers: item.answers || [],
      audioFiles: item.audio_files || [],
    }));

    setRemoteSubmissions(formatted);
    if (formatted.length > 0) {
      setSelectedId(formatted[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const selected =
    remoteSubmissions.find((item) => item.id === selectedId) ||
    remoteSubmissions[0] ||
    null;

  return (
    <div className="stack">
      <SectionCard title="提交结果" subtitle="这里展示的是 Supabase 里的真实数据。">
        <div className="row-buttons">
          <button className="btn btn-secondary" onClick={() => setMode('builder')}>
            返回编辑器
          </button>
          <button className="btn btn-secondary" onClick={loadSubmissions}>
            刷新结果
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => downloadJson(`${survey.id}-submissions.json`, remoteSubmissions)}
            disabled={!remoteSubmissions.length}
          >
            导出 JSON
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="提交列表"
        subtitle={loading ? '正在加载...' : `共 ${remoteSubmissions.length} 条`}
      >
        <div className="page-list">
          {loading ? (
            <div className="empty-box">正在从 Supabase 读取数据...</div>
          ) : remoteSubmissions.length === 0 ? (
            <div className="empty-box">还没有提交结果。</div>
          ) : (
            remoteSubmissions.map((item, index) => (
              <button
                key={item.id}
                className={`page-item ${selected?.id === item.id ? 'page-item-active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="page-item-top">
                  <strong>第 {remoteSubmissions.length - index} 份</strong>
                </div>
                <div>{item.participantName || '匿名用户'}</div>
                <div className="small-muted">
                  {new Date(item.submittedAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="结果详情" subtitle="每个问题会和录音一起展示。">
        {!selected ? (
          <div className="empty-box">请选择一条结果查看。</div>
        ) : (
          <div className="stack small-gap">
            <div className="info-grid">
              <div className="result-box">
                <div className="small-muted">参与者</div>
                <strong>{selected.participantName || '匿名用户'}</strong>
              </div>
              <div className="result-box">
                <div className="small-muted">访谈</div>
                <strong>{selected.surveyTitle}</strong>
              </div>
              <div className="result-box">
                <div className="small-muted">提交时间</div>
                <strong>{new Date(selected.submittedAt).toLocaleString()}</strong>
              </div>
            </div>

            {(selected.answers || []).map((item, idx) => (
              <div className="question-card" key={item.questionId || idx}>
                <div className="small-muted">
                  问题 {idx + 1} · {item.pageTitle}
                </div>
                <strong>{item.questionTitle}</strong>
                {item.helper ? <div className="small-muted top-gap">{item.helper}</div> : null}
                <div className="top-gap">
                  {item.response?.dataUrl ? (
                    <>
                      <audio controls src={item.response.dataUrl} className="audio-element" />
                      <div className="small-muted">
                        时长：{formatSeconds(item.response.durationSeconds)}
                      </div>
                    </>
                  ) : (
                    <div className="small-muted">没有提交录音。</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function App() {
  const [survey, setSurvey] = usePersistentState('voice-mobile-survey', defaultSurvey);
  const [submissions, setSubmissions] = usePersistentState('voice-mobile-submissions', []);
  const getInitialMode = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
  
    if (mode === 'admin') return 'builder';
    if (mode === 'results') return 'results';
  
    return 'participant'; // 默认用户端
  };
  
  const [mode, setMode] = useState(
    window.location.search.includes('admin') ? 'builder' : 'participant'
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-badge">手机浏览器版</div>
        <h1>语音访谈编辑器</h1>
        <p>
          这是基于你原始 React 版本改出来的手机网页版本，保留了编辑问卷、录音答题、查看结果三块核心能力，原始文件本身也确实包含这三种模式。 
        </p>
        {window.location.search.includes('admin') && (
    <div className="mode-tabs">
          <button className={`tab ${mode === 'builder' ? 'tab-active' : ''}`} onClick={() => setMode('builder')}>编辑器</button>
          <button className={`tab ${mode === 'results' ? 'tab-active' : ''}`} onClick={() => setMode('results')}>结果页</button>
        </div>
        )}
      </header>

      <main className="main-wrap">
      {window.location.search.includes('admin') ? (
  mode === 'builder' ? (
    <Builder survey={survey} setSurvey={setSurvey} submissions={submissions} setMode={setMode} />
  ) : mode === 'results' ? (
    <Results survey={survey} setMode={setMode} />
  ) : (
    <Builder survey={survey} setSurvey={setSurvey} submissions={submissions} setMode={setMode} />
  )
) : (
  <Participant survey={survey} submissions={submissions} setSubmissions={setSubmissions} setMode={setMode} />
)}
      </main>
    </div>
  );
}
