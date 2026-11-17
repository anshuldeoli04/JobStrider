import { create } from 'zustand';
import { api } from '../api/client';

const gradeOrder = { A: 5, B: 4, C: 3, D: 2, F: 1 };

const parseError = (error, fallback) =>
  error?.response?.data?.error || error?.message || fallback;

function createLogBatcher(flushCallback, intervalMs = 150) {
  let buffer = [];
  let timer = null;

  const flush = () => {
    if (buffer.length > 0) {
      const items = [...buffer];
      buffer = [];
      flushCallback(items);
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const push = (line) => {
    buffer.push(line);
    if (!timer) {
      timer = setTimeout(flush, intervalMs);
    }
  };

  return { push, flush };
}

let activeScanEventSource = null;

export const useAppStore = create((set, get) => ({
  hydrated: false,
  currentView: 'home', // 'home' | 'discover' | 'check' | 'applications' | 'resumes' | 'settings'
  backgroundTask: null,
  session: null,
  applications: [],
  scanResults: [],
  config: null,
  setupStatus: null,
  usage: null,
  activity: [],
  notifications: [],
  activeScan: { status: 'idle', phase: 'idle', logs: [], message: '' },
  activeEvaluation: { status: 'idle', result: null, logs: [] },
  activeResume: { status: 'idle', result: null, logs: [] },
  tailoringId: null,
  isByokModalOpen: false,
  isResumeModalOpen: false,
  selectedJob: null,
  previewResume: null, // { title, htmlUrl, pdfUrl }

  setCurrentView: (view) => set({ currentView: view }),
  openByokModal: () => set({ isByokModalOpen: true }),
  closeByokModal: () => set({ isByokModalOpen: false }),
  openResumeModal: () => set({ isResumeModalOpen: true }),
  closeResumeModal: () => set({ isResumeModalOpen: false }),
  openJobDetail: (job) => set({ selectedJob: job }),
  closeJobDetail: () => set({ selectedJob: null }),
  openResumePreview: (preview) => set({ previewResume: preview }),
  closeResumePreview: () => set({ previewResume: null }),

  bootstrap: async () => {
    try {
      let token = localStorage.getItem('job_ops_token');
      if (!token) {
        try {
          const localAuth = await api.loginLocal();
          token = localAuth.token;
        } catch {
          token = 'jobstrider-local-operator-token';
          localStorage.setItem('job_ops_token', token);
        }
      }
      const [sessionRes, applications, scanResults, config, activity] = await api.bootstrap();
      const [setupStatus, usage] = await Promise.all([
        api.getSetupStatus().catch(() => null),
        api.getUsage().catch(() => null)
      ]);
      set({
        session: sessionRes?.user || { id: 1, name: 'Job Seeker', email: 'local@jobstrider.app' },
        applications: applications || [],
        scanResults: scanResults || [],
        config: config || null,
        setupStatus,
        usage,
        activity: activity || [],
        hydrated: true
      });
    } catch (error) {
      set({
        session: { id: 1, name: 'Job Seeker', email: 'local@jobstrider.app' },
        hydrated: true
      });
      get().pushToast({
        type: 'error',
        title: 'Connection notice',
        message: parseError(error, 'Could not connect to the local backend server.')
      });
    }
  },

  pushToast: (toast) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: crypto.randomUUID(), duration: 4200, ...toast }
      ]
    })),

  dismissToast: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((toast) => toast.id !== id)
    })),

  startTask: (label) => set({ backgroundTask: { label, startedAt: Date.now() } }),
  endTask: () => set({ backgroundTask: null }),

  updateStatus: async (id, status) => {
    const previous = get().applications;
    const nextApps = previous.map((item) => (item.id === id ? { ...item, status } : item));
    const currentSelected = get().selectedJob;
    set({
      applications: nextApps,
      selectedJob: currentSelected?.id === id ? { ...currentSelected, status } : currentSelected
    });

    try {
      const updated = await api.updateApplicationStatus(id, { status });
      set((state) => ({
        applications: state.applications.map((item) => (item.id === id ? { ...item, ...updated } : item))
      }));
      get().pushToast({
        type: 'success',
        title: 'Status updated',
        message: `Moved to "${status}".`
      });
    } catch (error) {
      set({ applications: previous, selectedJob: currentSelected });
      get().pushToast({
        type: 'error',
        title: 'Could not update status',
        message: parseError(error, 'Update failed; previous status restored.')
      });
    }
  },

  bulkUpdateStatus: async (ids, status) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const previous = get().applications;
    set({
      applications: previous.map((item) => (ids.includes(item.id) ? { ...item, status } : item))
    });
    try {
      const data = await api.updateApplicationsBulk({ ids, status });
      set({ applications: data.applications || previous });
      get().pushToast({
        type: 'success',
        title: 'Applications updated',
        message: `${ids.length} job(s) marked as "${status}".`
      });
    } catch (error) {
      set({ applications: previous });
      get().pushToast({
        type: 'error',
        title: 'Bulk update failed',
        message: parseError(error, 'Could not update selected jobs.')
      });
    }
  },

  deleteApplication: async (id) => {
    const previous = get().applications;
    set((state) => ({
      applications: previous.filter((item) => item.id !== id),
      selectedJob: state.selectedJob?.id === id ? null : state.selectedJob
    }));
    try {
      const data = await api.deleteApplication(id);
      set({ applications: data.applications || [] });
      get().pushToast({ type: 'info', title: 'Job removed', message: 'Removed from your tracker.' });
    } catch (error) {
      set({ applications: previous });
      get().pushToast({ type: 'error', title: 'Delete failed', message: parseError(error, 'Could not remove item.') });
    }
  },

  saveConfig: async (payload) => {
    get().startTask('Saving preferences...');
    try {
      const data = await api.saveConfig(payload);
      const [setupStatus, usage] = await Promise.all([
        api.getSetupStatus().catch(() => get().setupStatus),
        api.getUsage().catch(() => get().usage)
      ]);
      set({ config: data.config || get().config, setupStatus, usage });
      get().pushToast({
        type: 'success',
        title: 'Saved',
        message: 'Your preferences and profile are updated.'
      });
      return data;
    } finally {
      get().endTask();
    }
  },

  testApiKey: async (payload) => {
    get().startTask('Testing AI key...');
    try {
      return await api.testApiKey(payload);
    } finally {
      get().endTask();
    }
  },

  updateApiKey: async (payload) => {
    get().startTask('Connecting AI key...');
    try {
      const data = await api.updateApiKey(payload);
      const [setupStatus, usage] = await Promise.all([
        api.getSetupStatus().catch(() => get().setupStatus),
        api.getUsage().catch(() => get().usage)
      ]);
      set({ config: data.config || get().config, setupStatus, usage });
      get().pushToast({
        type: 'success',
        title: 'Google AI connected',
        message: 'Your free Gemini key is active and ready.'
      });
      return data;
    } finally {
      get().endTask();
    }
  },

  uploadCvPdf: async (file) => {
    get().startTask('Reading your PDF resume...');
    try {
      const data = await api.uploadCvPdf(file);
      const setupStatus = await api.getSetupStatus().catch(() => get().setupStatus);
      set((state) => ({
        config: data.config || { ...state.config, cv_content: data.cv_content, has_cv: true },
        setupStatus
      }));
      get().pushToast({
        type: 'success',
        title: 'Resume uploaded',
        message: 'Extracted text from your PDF resume cleanly.'
      });
      return data;
    } finally {
      get().endTask();
    }
  },

  runScan: async (payload) => {
    if (activeScanEventSource) {
      activeScanEventSource.close();
      activeScanEventSource = null;
    }

    get().startTask(payload?.mode === 'autoflow' ? 'Finding and scoring jobs...' : 'Searching job boards...');
    const streamUrl = await api.getStreamUrl('/scan/stream');
    const logBatcher = createLogBatcher((newLines) => {
      set((state) => ({
        activeScan: {
          ...state.activeScan,
          logs: [...state.activeScan.logs, ...newLines]
        }
      }));
    });

    set({
      activeScan: {
        status: 'running',
        phase: 'scanning',
        logs: ['Connecting to job boards...'],
        message: ''
      }
    });

    try {
      const es = new EventSource(streamUrl);
      activeScanEventSource = es;

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'phase' && msg.phase) {
            set((state) => ({
              activeScan: { ...state.activeScan, phase: msg.phase }
            }));
          }
          if (msg.type === 'log' && msg.message) {
            logBatcher.push(msg.message);
          }
          if (msg.type === 'complete') {
            logBatcher.flush();
            const isOk = msg.status === 'success';
            set((state) => ({
              scanResults: msg.scanResults || state.scanResults,
              applications: msg.applications || state.applications,
              activity: msg.activity || state.activity,
              activeScan: {
                ...state.activeScan,
                status: isOk ? 'success' : 'error',
                phase: isOk ? 'done' : 'error',
                message: msg.message || ''
              }
            }));
            get().endTask();
            get().pushToast({
              type: isOk ? 'success' : 'warning',
              title: isOk ? 'Job search finished' : 'Search completed with notes',
              message: msg.message || 'Check your discovered jobs list.'
            });
            es.close();
            if (activeScanEventSource === es) activeScanEventSource = null;
          }
        } catch {}
      };

      es.onerror = () => {
        logBatcher.flush();
        get().endTask();
        es.close();
        if (activeScanEventSource === es) activeScanEventSource = null;
      };

      await api.runScan(payload);
    } catch (error) {
      logBatcher.flush();
      activeScanEventSource?.close();
      activeScanEventSource = null;
      get().endTask();
      const errMsg = parseError(error, 'Could not start the job search.');
      set({
        activeScan: { status: 'error', phase: 'error', logs: [errMsg], message: errMsg }
      });
      get().pushToast({ type: 'error', title: 'Could not start search', message: errMsg });
    }
  },

  stopScan: async () => {
    try {
      await api.stopScan();
    } finally {
      activeScanEventSource?.close();
      activeScanEventSource = null;
      get().endTask();
      set((state) => ({
        activeScan: { ...state.activeScan, status: 'idle', phase: 'cancelled' }
      }));
      get().pushToast({ type: 'info', title: 'Search stopped', message: 'Job search was cancelled.' });
    }
  },

  runEvaluate: async (payload) => {
    const isBatch = payload?.mode === 'scanned';
    get().startTask(isBatch ? 'Scoring discovered jobs with AI...' : 'Checking your fit for this job...');
    const streamUrl = await api.getStreamUrl('/evaluate/stream');
    let eventSource = null;
    const logBatcher = createLogBatcher((newLines) => {
      set((state) => ({
        activeEvaluation: {
          ...state.activeEvaluation,
          logs: [...state.activeEvaluation.logs, ...newLines]
        }
      }));
    });

    set({
      activeEvaluation: {
        status: 'running',
        result: null,
        logs: [isBatch ? 'Scoring top discovered openings...' : 'Reading job description and comparing with your resume...']
      }
    });

    try {
      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'log' && msg.message) {
            logBatcher.push(msg.message);
          }
          if (msg.type === 'complete' && msg.result) {
            logBatcher.flush();
            set((state) => ({
              activeEvaluation: {
                ...state.activeEvaluation,
                status: 'success',
                result: msg.result
              }
            }));
          }
        } catch {}
      };

      const data = await api.runEvaluate(payload);
      logBatcher.flush();
      const usage = await api.getUsage().catch(() => get().usage);

      if (isBatch) {
        set((state) => ({
          activeEvaluation: {
            status: 'success',
            result: null,
            logs: [...state.activeEvaluation.logs, data.message || 'Finished scoring discovered jobs.']
          },
          applications: data.applications || state.applications,
          scanResults: data.scanResults || state.scanResults,
          activity: data.activity || state.activity,
          usage
        }));
        get().pushToast({
          type: 'success',
          title: 'Scoring complete',
          message: data.message || 'Strong matches have been added to My Applications.'
        });
      } else {
        set((state) => ({
          activeEvaluation: {
            status: 'success',
            result: data.result,
            logs: [...state.activeEvaluation.logs, 'Fit analysis ready!']
          },
          scanResults: data.scanResults || state.scanResults,
          applications: data.applications
            ? data.applications
            : data.result
              ? [data.result, ...state.applications.filter((item) => item.id !== data.result.id)].sort(
                  (a, b) => (gradeOrder[b.grade] || 0) - (gradeOrder[a.grade] || 0)
                )
              : state.applications,
          activity: data.activity || state.activity,
          usage
        }));
        get().pushToast({
          type: 'success',
          title: 'Fit report ready',
          message: `${data.result?.company || 'Job'} scored ${Number(data.result?.score || 0).toFixed(1)}/10 (Grade ${data.result?.grade || '?'}).`
        });
      }
      return data;
    } catch (error) {
      logBatcher.flush();
      const errMsg = parseError(error, 'Could not evaluate this job.');
      set((state) => ({
        activeEvaluation: {
          status: 'error',
          result: null,
          logs: [...state.activeEvaluation.logs, errMsg]
        }
      }));
      get().pushToast({ type: 'error', title: 'Check failed', message: errMsg });
      throw error;
    } finally {
      logBatcher.flush();
      eventSource?.close();
      get().endTask();
    }
  },

  runResume: async (payload) => {
    const targetId = payload?.applicationId || payload?.jobId || null;
    set({ tailoringId: targetId || 'custom' });
    get().startTask('Creating your tailored resume...');
    const streamUrl = await api.getStreamUrl('/resume/stream');
    let eventSource = null;
    const logBatcher = createLogBatcher((newLines) => {
      set((state) => ({
        activeResume: {
          ...state.activeResume,
          logs: [...state.activeResume.logs, ...newLines]
        }
      }));
    });

    set({
      activeResume: {
        status: 'running',
        result: null,
        logs: ['Highlighting your strongest matching skills for this job...']
      }
    });

    try {
      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'log' && msg.message) {
            logBatcher.push(msg.message);
          }
        } catch {}
      };

      const data = await api.runResume(payload);
      logBatcher.flush();
      const usage = await api.getUsage().catch(() => get().usage);
      const nextApps = data.applications || (await api.getApplications());
      const currentSelected = get().selectedJob;
      const updatedSelected = currentSelected
        ? nextApps.find((a) => a.id === currentSelected.id) || currentSelected
        : null;
      const currentEvalResult = get().activeEvaluation.result;
      const updatedEvalResult = currentEvalResult
        ? nextApps.find((a) => a.id === currentEvalResult.id) || currentEvalResult
        : null;

      set((state) => ({
        activeResume: { status: 'success', result: data, logs: data.logs || state.activeResume.logs },
        applications: nextApps,
        selectedJob: updatedSelected,
        activeEvaluation: { ...state.activeEvaluation, result: updatedEvalResult },
        usage
      }));
      get().pushToast({
        type: 'success',
        title: 'Tailored resume ready',
        message: data.message || 'Your customized resume is ready to preview and download.'
      });
      return data;
    } catch (error) {
      logBatcher.flush();
      const errMsg = parseError(error, 'Could not build tailored resume.');
      set((state) => ({
        activeResume: {
          status: 'error',
          result: null,
          logs: [...state.activeResume.logs, errMsg]
        }
      }));
      get().pushToast({ type: 'error', title: 'Resume failed', message: errMsg });
      throw error;
    } finally {
      logBatcher.flush();
      eventSource?.close();
      set({ tailoringId: null });
      get().endTask();
    }
  },

  resetWorkspace: async (options = {}) => {
    get().startTask('Clearing workspace...');
    try {
      const data = await api.resetWorkspace(options);
      const setupStatus = await api.getSetupStatus().catch(() => null);
      set({
        applications: data.applications || [],
        scanResults: data.scanResults || [],
        activity: data.activity || [],
        config: data.config || get().config,
        setupStatus,
        selectedJob: null,
        activeEvaluation: { status: 'idle', result: null, logs: [] },
        activeResume: { status: 'idle', result: null, logs: [] },
        activeScan: { status: 'idle', phase: 'idle', logs: [], message: '' }
      });
      get().pushToast({
        type: 'success',
        title: 'Workspace cleared',
        message: 'Started fresh with zero saved jobs.'
      });
      return data;
    } finally {
      get().endTask();
    }
  }
}));
