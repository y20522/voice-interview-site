import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { supabase } from './supabase';

// ============================================
// 工具函数
// ============================================

/** 生成唯一 ID */
const uid = () => Math.random().toString(36).slice(2, 10);

/** 默认访谈配置 */
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

/** localStorage 读取 */
function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** 自定义 Hook：state ↔ localStorage 同步 */
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => getStored(key, initialValue));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

/** 秒数格式化 M:SS */
function formatSeconds(value) {
  const safe = Math.max(0, Number(value || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Blob 转 Base64 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 触发 JSON 下载 */
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// 通用 UI 组件
// ============================================

/**
 * Card - 统一卡片容器
 * 入场动画：淡入 + 上浮
 */
export function Card({ title, subtitle, children, compact = false, className = '' }) {
  return (
    <motion.section 
      className={`card ${compact ? 'card-compact' : ''} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {(title || subtitle) && (
        <motion.div 
          className="card-header"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {title && <h2 className="card-title">{title}</h2>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </motion.div>
      )}
      <div className="card-content">
        {children}
      </div>
    </motion.section>
  );
}

/**
 * Field - 表单字段包装
 */
export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
    </div>
  );
}

/**
 * ListItem - 列表项组件
 * 入场动画：交错淡入
 */
export function ListItem({ 
  children, 
  isActive = false, 
  onClick,
  actions = [],
  title,
  description,
  className = ''
}) {
  return (
    <motion.button
      className={`list-item ${isActive ? 'list-item-active' : ''} ${className}`}
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.1 }}
    >
      <div className="list-item-content">
        {title && <div className="list-item-title">{title}</div>}
        {description && <div className="list-item-desc">{description}</div>}
        {children}
      </div>
      {actions.length > 0 && (
        <div className="list-item-actions">
          {actions.map((action, i) => (
            <span key={i} onClick={(e) => { e.stopPropagation(); action.onClick?.(); }}>
              {action.label}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
}

/**
 * Toggle - 开关组件
 * 带平滑过渡动画
 */
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <div className="toggle-switch">
        <input 
          type="checkbox" 
          className="toggle-input" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        <motion.div 
          className="toggle-switch"
          animate={{ background: checked ? 'var(--success)' : 'var(--border)' }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            animate={{ x: checked ? 20 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 2,
              left: 2,
              width: 27,
              height: 27,
              background: 'white',
              borderRadius: '50%',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
          />
        </motion.div>
      </div>
    </label>
  );
}

/**
 * VoiceRecorder - 核心录音组件
 * 录音状态指示 + 预览播放
 */
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
      let preferredType = '';

      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        preferredType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        preferredType = 'audio/webm';
      }
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/mp4' });
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
    <motion.div 
      className="recorder"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 录音控制区 */}
      <div className="recorder-controls">
        <motion.button
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          onClick={isRecording ? stopRecording : startRecording}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1 }}
        >
          {isRecording ? '停止录音' : '开始录音'}
        </motion.button>
        
        {/* 计时器 */}
        <motion.span 
          className="recorder-timer"
          key={elapsed}
          animate={{ opacity: isRecording ? [1, 0.7, 1] : 1 }}
          transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
        >
          {formatSeconds(elapsed)}
        </motion.span>
        
        {/* 录音状态 */}
        <AnimatePresence>
          {isRecording && (
            <motion.div 
              className="recorder-status"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <span className="recorder-dot" />
              正在录音
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 时长提示 */}
      <div className="recorder-hint">
        时长限制：{formatSeconds(minSeconds)} - {formatSeconds(maxSeconds)}
      </div>

      {/* 错误提示 */}
      <AnimatePresence>
        {permissionError && (
          <motion.div 
            className="recorder-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {permissionError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 录音预览 */}
      <AnimatePresence>
        {audioUrl && (
          <motion.div 
            className="recorder-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <audio controls src={audioUrl} className="audio-player" />
            <motion.button
              className="btn btn-secondary btn-full"
              onClick={saveRecording}
              whileTap={{ scale: 0.98 }}
              style={{ marginTop: 12 }}
            >
              使用这段录音
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// Builder 组件 - 问卷编辑模式
// ============================================

function Builder({ survey, setSurvey, submissions, setMode }) {
  const [selectedPageId, setSelectedPageId] = useState(survey.pages[0]?.id || '');

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

  const selectedPage = survey.pages.find((p) => p.id === selectedPageId) || survey.pages[0];

  return (
    <motion.div 
      className="stack"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 基础设置卡片 */}
      <Card title="基础设置" subtitle="设置访谈标题、欢迎页和结束页。">
        <div className="form-grid">
          <Field label="访谈标题">
            <input className="field-input" value={survey.title} onChange={(e) => updateSurvey({ title: e.target.value })} />
          </Field>
          <Field label="访谈描述">
            <textarea className="field-input field-textarea" value={survey.description} onChange={(e) => updateSurvey({ description: e.target.value })} />
          </Field>
          <Field label="欢迎标题">
            <input className="field-input" value={survey.welcomeTitle} onChange={(e) => updateSurvey({ welcomeTitle: e.target.value })} />
          </Field>
          <Field label="欢迎文字">
            <textarea className="field-input field-textarea" value={survey.welcomeText} onChange={(e) => updateSurvey({ welcomeText: e.target.value })} />
          </Field>
          <Field label="结束标题">
            <input className="field-input" value={survey.outroTitle} onChange={(e) => updateSurvey({ outroTitle: e.target.value })} />
          </Field>
          <Field label="结束文字">
            <textarea className="field-input field-textarea" value={survey.outroText} onChange={(e) => updateSurvey({ outroText: e.target.value })} />
          </Field>
        </div>
        <Toggle 
          label="要求填写姓名" 
          checked={survey.requireName} 
          onChange={(checked) => updateSurvey({ requireName: checked })} 
        />
      </Card>

      {/* 页面管理卡片 */}
      <Card title="页面管理" subtitle="管理访谈的各个页面和题目。">
        <motion.div 
          className="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {survey.pages.map((page, index) => (
            <ListItem
              key={page.id}
              isActive={selectedPage?.id === page.id}
              onClick={() => setSelectedPageId(page.id)}
              title={page.title || '未命名页面'}
              description={`${page.questions.length} 个问题`}
              actions={[
                { label: '复制', onClick: () => duplicatePage(page.id) },
                { label: '删除', onClick: () => deletePage(page.id) }
              ]}
            />
          ))}
        </motion.div>
        
        <div className="btn-group">
          <motion.button 
            className="btn btn-secondary" 
            onClick={addPage}
            whileTap={{ scale: 0.98 }}
          >
            新增页面
          </motion.button>
          <motion.button 
            className="btn btn-ghost" 
            onClick={() => setMode('participant')}
            whileTap={{ scale: 0.98 }}
          >
            预览答题
          </motion.button>
          <motion.button 
            className="btn btn-ghost" 
            onClick={() => setMode('results')}
            whileTap={{ scale: 0.98 }}
          >
            查看结果
          </motion.button>
        </div>
      </Card>

      {/* 当前页面编辑 */}
      <AnimatePresence mode="wait">
        {selectedPage && (
          <motion.div
            key={selectedPage.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card title={selectedPage.title} subtitle={selectedPage.description}>
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <Field label="页面标题">
                  <input className="field-input" value={selectedPage.title} onChange={(e) => updatePage(selectedPage.id, { title: e.target.value })} />
                </Field>
                <Field label="页面说明">
                  <textarea className="field-input field-textarea" value={selectedPage.description} onChange={(e) => updatePage(selectedPage.id, { description: e.target.value })} />
                </Field>
              </div>

              <div className="stack-sm">
                {selectedPage.questions.map((q, idx) => (
                  <motion.div 
                    key={q.id}
                    className="card card-compact"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="list-item-content" style={{ marginBottom: 12 }}>
                      <span className="card-meta">问题 {idx + 1}</span>
                      <div className="list-item-actions" style={{ marginTop: 8 }}>
                        <span onClick={() => duplicateQuestion(selectedPage.id, q.id)}>复制</span>
                        <span onClick={() => deleteQuestion(selectedPage.id, q.id)}>删除</span>
                      </div>
                    </div>
                    <div className="form-grid">
                      <Field label="问题内容">
                        <textarea className="field-input field-textarea" value={q.title} onChange={(e) => updateQuestion(selectedPage.id, q.id, { title: e.target.value })} />
                      </Field>
                      <Field label="辅助说明">
                        <textarea className="field-input field-textarea" value={q.helper} onChange={(e) => updateQuestion(selectedPage.id, q.id, { helper: e.target.value })} />
                      </Field>
                      <Field label="最短秒数">
                        <input type="number" className="field-input" min="0" value={q.minSeconds} onChange={(e) => updateQuestion(selectedPage.id, q.id, { minSeconds: Number(e.target.value || 0) })} />
                      </Field>
                      <Field label="最长秒数">
                        <input type="number" className="field-input" min="1" value={q.maxSeconds} onChange={(e) => updateQuestion(selectedPage.id, q.id, { maxSeconds: Number(e.target.value || 1) })} />
                      </Field>
                    </div>
                    <Toggle 
                      label="允许跳过" 
                      checked={q.optional} 
                      onChange={(checked) => updateQuestion(selectedPage.id, q.id, { optional: checked })} 
                    />
                  </motion.div>
                ))}
              </div>

              <motion.button 
                className="btn btn-primary btn-full" 
                onClick={() => addQuestion(selectedPage.id)}
                whileTap={{ scale: 0.98 }}
                style={{ marginTop: 16 }}
              >
                新增语音问题
              </motion.button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 数据统计 */}
      <Card compact>
        <div className="stats">
          <span className="stats-label">已保存结果</span>
          <span className="stats-value">{submissions.length}</span>
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================
// Participant 组件 - 答题模式
// ============================================

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
    } catch (err) {
      console.error(err);
      alert('发生错误');
      return;
    }
  
    setSubmissions((prev) => [submission, ...prev]);
    setSubmittedId(submission.id);
    setStep(totalSteps);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // 欢迎页
  if (step === -1) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="welcome"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card title={survey.welcomeTitle || survey.title} subtitle={survey.welcomeText || survey.description}>
            {survey.requireName && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Field label="你的姓名">
                  <input 
                    className="field-input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="请输入姓名" 
                  />
                </Field>
              </motion.div>
            )}
            
            <motion.div 
              className="btn-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                className="btn btn-primary"
                disabled={survey.requireName && !name.trim()}
                onClick={() => setStep(0)}
                whileTap={{ scale: 0.98 }}
              >
                开始访谈
              </motion.button>
              <motion.button
                className="btn btn-ghost"
                onClick={() => setMode('builder')}
                whileTap={{ scale: 0.98 }}
              >
                返回编辑器
              </motion.button>
            </motion.div>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 完成页
  if (step >= totalSteps) {
    const latest = submissions.find((s) => s.id === submittedId);
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="complete"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
        >
          <Card title={survey.outroTitle} subtitle={survey.outroText}>
            <motion.div 
              className="info-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="info-label">参与者</div>
              <div className="info-value">{latest?.participantName || '匿名用户'}</div>
            </motion.div>
            
            <motion.div 
              className="btn-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                className="btn btn-primary"
                onClick={() => setMode('results')}
                whileTap={{ scale: 0.98 }}
              >
                查看结果
              </motion.button>
              <motion.button
                className="btn btn-secondary"
                onClick={() => { setAnswers({}); setStep(-1); setSubmittedId(null); setName(''); }}
                whileTap={{ scale: 0.98 }}
              >
                重新开始
              </motion.button>
            </motion.div>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 答题页
  const currentAnswer = answers[current.question.id];
  const canProceed = current.question.optional || !!currentAnswer;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`question-${step}`}
        className="stack"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* 进度指示 */}
        <Card compact>
          <div className="progress">
            <span>{step + 1} / {totalSteps}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
            </div>
          </div>
        </Card>

        {/* 问题卡片 */}
        <Card 
          title={current.question.title}
          subtitle={current.question.helper || current.page.description}
        >
          {/* 录音组件 */}
          <VoiceRecorder
            minSeconds={current.question.minSeconds}
            maxSeconds={current.question.maxSeconds}
            onSaved={(recording) => setAnswer(current.question.id, recording)}
          />

          {/* 已录音预览 */}
          <AnimatePresence>
            {currentAnswer && (
              <motion.div
                className="recorder-preview"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <audio controls src={currentAnswer.dataUrl} className="audio-player" />
                <div className="recorder-hint">录音已保存 · 时长：{formatSeconds(currentAnswer.durationSeconds)}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 导航按钮 */}
          <div className="btn-group" style={{ justifyContent: 'space-between', marginTop: 20 }}>
            <motion.button
              className="btn btn-secondary"
              disabled={step === 0}
              onClick={goBack}
              whileTap={{ scale: 0.98 }}
            >
              上一题
            </motion.button>
            
            <div style={{ display: 'flex', gap: 8 }}>
              {current.question.optional && !currentAnswer && (
                <motion.button
                  className="btn btn-ghost"
                  onClick={goNext}
                  whileTap={{ scale: 0.98 }}
                >
                  跳过
                </motion.button>
              )}
              <motion.button
                className="btn btn-primary"
                disabled={!canProceed}
                onClick={goNext}
                whileTap={{ scale: 0.98 }}
              >
                {step === totalSteps - 1 ? '完成提交' : '下一题'}
              </motion.button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// Results 组件 - 结果查看模式
// ============================================

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

  const selected = remoteSubmissions.find((item) => item.id === selectedId) || remoteSubmissions[0];

  return (
    <motion.div 
      className="stack"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 操作栏 */}
      <Card compact>
        <div className="btn-group" style={{ marginTop: 0 }}>
          <motion.button 
            className="btn btn-ghost" 
            onClick={() => setMode('builder')}
            whileTap={{ scale: 0.98 }}
          >
            返回编辑器
          </motion.button>
          <motion.button 
            className="btn btn-secondary" 
            onClick={loadSubmissions}
            whileTap={{ scale: 0.98 }}
          >
            刷新结果
          </motion.button>
          <motion.button 
            className="btn btn-secondary" 
            onClick={() => downloadJson(`${survey.id}-submissions.json`, remoteSubmissions)}
            disabled={!remoteSubmissions.length}
            whileTap={{ scale: 0.98 }}
          >
            导出 JSON
          </motion.button>
        </div>
      </Card>

      {/* 提交列表 */}
      <Card title="提交列表" subtitle={loading ? '正在加载...' : `共 ${remoteSubmissions.length} 条`}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              className="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="loading-spinner" />
              正在从 Supabase 读取数据...
            </motion.div>
          ) : remoteSubmissions.length === 0 ? (
            <motion.div 
              key="empty"
              className="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="empty-icon">📭</div>
              <div className="empty-text">还没有提交结果</div>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              className="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {remoteSubmissions.map((item, index) => (
                <ListItem
                  key={item.id}
                  isActive={selected?.id === item.id}
                  onClick={() => setSelectedId(item.id)}
                  title={item.participantName || '匿名用户'}
                  description={new Date(item.submittedAt).toLocaleString('zh-CN')}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* 结果详情 */}
      <Card title="结果详情" subtitle="每个问题会和录音一起展示。">
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div 
              key="no-select"
              className="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="empty-text">请选择一条结果查看</div>
            </motion.div>
          ) : (
            <motion.div
              key={selected.id}
              className="stack-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* 基本信息 */}
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">参与者</div>
                  <div className="info-value">{selected.participantName || '匿名用户'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">访谈</div>
                  <div className="info-value">{selected.surveyTitle}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">提交时间</div>
                  <div className="info-value" style={{ fontSize: 13 }}>
                    {new Date(selected.submittedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              {/* 问题列表 */}
              {(selected.answers || []).map((item, idx) => (
                <motion.div
                  key={item.questionId || idx}
                  className="card card-compact"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <span className="card-meta">
                    问题 {idx + 1} · {item.pageTitle}
                  </span>
                  <div className="card-title" style={{ fontSize: 18, marginTop: 8 }}>
                    {item.questionTitle}
                  </div>
                  {item.helper && (
                    <div className="card-subtitle" style={{ fontSize: 13, marginTop: 4 }}>
                      {item.helper}
                    </div>
                  )}
                  
                  <div style={{ marginTop: 12 }}>
                    {item.response?.dataUrl ? (
                      <>
                        <audio controls src={item.response.dataUrl} className="audio-player" />
                        <div className="recorder-hint">
                          时长：{formatSeconds(item.response.durationSeconds)}
                        </div>
                      </>
                    ) : (
                      <div className="recorder-hint">没有提交录音</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ============================================
// App 根组件
// ============================================

export default function App() {
  const [survey, setSurvey] = usePersistentState('voice-mobile-survey', defaultSurvey);
  const [submissions, setSubmissions] = usePersistentState('voice-mobile-submissions', []);
  
  const [mode, setMode] = useState(
    window.location.search.includes('admin') ? 'builder' : 'participant'
  );

  const isAdmin = window.location.search.includes('admin');

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-top">
            <motion.h1 
              className="header-title"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {survey.title}
            </motion.h1>
            <motion.span 
              className="header-badge"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              语音访谈
            </motion.span>
          </div>

          {/* 管理员 Tab 切换 */}
          <AnimatePresence>
            {isAdmin && (
              <motion.div 
                className="tabs"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <motion.button
                  className={`tab ${mode === 'builder' ? 'tab-active' : ''}`}
                  onClick={() => setMode('builder')}
                  whileTap={{ scale: 0.98 }}
                >
                  编辑器
                </motion.button>
                <motion.button
                  className={`tab ${mode === 'results' ? 'tab-active' : ''}`}
                  onClick={() => setMode('results')}
                  whileTap={{ scale: 0.98 }}
                >
                  结果页
                </motion.button>
                <motion.button
                  className={`tab ${mode === 'participant' ? 'tab-active' : ''}`}
                  onClick={() => setMode('participant')}
                  whileTap={{ scale: 0.98 }}
                >
                  答题预览
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {isAdmin ? (
            mode === 'builder' ? (
              <motion.div
                key="builder"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Builder survey={survey} setSurvey={setSurvey} submissions={submissions} setMode={setMode} />
              </motion.div>
            ) : mode === 'results' ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Results survey={survey} setMode={setMode} />
              </motion.div>
            ) : (
              <motion.div
                key="participant-preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Participant survey={survey} submissions={submissions} setSubmissions={setSubmissions} setMode={setMode} />
              </motion.div>
            )
          ) : (
            <motion.div
              key="participant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Participant survey={survey} submissions={submissions} setSubmissions={setSubmissions} setMode={setMode} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
