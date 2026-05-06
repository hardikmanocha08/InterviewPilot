'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { FiUsers, FiPlus, FiArrowRight, FiLoader, FiAlertCircle, FiCopy, FiRefreshCw } from 'react-icons/fi';

interface PeerSession {
  _id: string;
  candidateId?: {
    name: string;
    email: string;
  };
  status?: 'waiting' | 'active' | 'completed';
  role: string;
  experienceLevel: string;
  createdAt: string;
  visibility?: 'public' | 'private';
}


interface PeerLobbyProps {
  onJoinSession: (sessionId: string) => void;
  interviewId: string;
  role: string;
  experienceLevel: string;
  peerRole: 'interviewer' | 'interviewee';
  visibility?: 'public' | 'private';
}


export default function PeerLobby({ onJoinSession, interviewId, role, experienceLevel, peerRole, visibility }: PeerLobbyProps) {
  const [sessions, setSessions] = useState<PeerSession[]>([]);
  const [ownSession, setOwnSession] = useState<PeerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const isPrivate = visibility === 'private';

  const fetchPeerSessions = async () => {
    try {
      const res = await api.get('/peer-sessions?includeMine=true');
      const data = res.data || {};
      const availableSessions = Array.isArray(data) ? data : data.availableSessions || [];
      const currentOwnSession = Array.isArray(data) ? null : data.ownSession || null;

      // Filter available sessions by visibility
      const filtered = availableSessions.filter((s: PeerSession) =>
        isPrivate ? s.visibility === 'private' : s.visibility !== 'private'
      );

      setSessions(filtered);

      // Set own session if it matches our current mode
      if (currentOwnSession) {
        const matches = isPrivate
          ? currentOwnSession.visibility === 'private'
          : currentOwnSession.visibility !== 'private';
        if (matches) {
          setOwnSession(currentOwnSession);
          // Restore generated code if it's a private interviewer session
          if (isPrivate && peerRole === 'interviewer' && currentOwnSession.status === 'waiting') {
            // Code will be shown if we have it, or will show "Generating..."
          }
        } else {
          setOwnSession(null);
        }
      } else {
        setOwnSession(null);
      }

      setError(null);

      // Auto-join when session becomes active
      if (currentOwnSession?.status === 'active') {
        const matches = isPrivate
          ? currentOwnSession.visibility === 'private'
          : currentOwnSession.visibility !== 'private';
        if (matches) {
          onJoinSession(currentOwnSession._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch peer sessions:', err);
      setError('Failed to load available peers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPeerSessions();
    const interval = setInterval(fetchPeerSessions, 10000);
    return () => clearInterval(interval);
  }, [onJoinSession, peerRole, isPrivate]);

  const handleCreateSession = async () => {
    try {
      setRefreshing(true);
      setError(null);

      console.log('[PeerLobby] Creating session with:', { interviewId, role, experienceLevel, visibility, peerRole });

      const res = await api.post('/peer-sessions', {
        interviewId,
        role,
        experienceLevel,
        visibility,
        peerRole,
      });

      console.log('[PeerLobby] Full response:', JSON.stringify(res.data, null, 2));

      const session = res.data.session || res.data;
      setOwnSession(session);

      if (isPrivate && peerRole === 'interviewer') {
        const code = res.data.joinCode;
        console.log('[PeerLobby] joinCode from response:', code);
        if (code) {
          setGeneratedCode(code);
        }
      }

      setError(null);
    } catch (err: any) {
      console.error('[PeerLobby] Create session error:', err);
      console.error('[PeerLobby] Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to create a peer session');
    } finally {
      setRefreshing(false);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    try {
      setRefreshing(true);
      await api.post(`/peer-sessions/${sessionId}/join`, { interviewId });
      onJoinSession(sessionId);
    } catch (err) {
      console.error('Failed to join session:', err);
      setError('Failed to join session. It may have been taken.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchPeerSessions();
    } finally {
      setRefreshing(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCodeInput.trim();
    if (!code) {
      setError('Enter a join code');
      return;
    }

    try {
      setRefreshing(true);
      setError(null);

      const res = await api.post('/peer-sessions/join-by-code', {
        interviewId,
        joinCode: code,
      });

      const sessionId = res.data?.session?._id;
      if (!sessionId) {
        throw new Error('Missing session id from server');
      }

      onJoinSession(sessionId);
    } catch (err: any) {
      console.error('Failed to join by code:', err);
      setError(err?.response?.data?.message || 'Invalid or expired join code');
    } finally {
      setRefreshing(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Determine who can create a room in this mode
  const canCreate = (isPrivate && peerRole === 'interviewer') || (!isPrivate && peerRole === 'interviewee');

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <FiUsers className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-white">
            {isPrivate ? 'Private Mock Interview' : 'Find a Peer'}
          </h2>
        </div>
        <p className="text-text-muted">
          {isPrivate
            ? (peerRole === 'interviewer' ? 'Create a private room and share the code with the interviewee.' : 'Enter the code shared by your interviewer to join.')
            : (peerRole === 'interviewee' ? 'Create a public room and wait for an interviewer.' : 'Find a candidate to interview.')}
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2 text-red-200"
        >
          <FiAlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* ===== PRIVATE MODE: Interviewer created room - show code ===== */}
      {isPrivate && peerRole === 'interviewer' && ownSession?.status === 'waiting' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg"
        >
          <div className="text-primary text-sm font-medium mb-3">Your private room is ready. Share this code:</div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-xl sm:text-2xl text-white bg-background border border-primary/30 rounded-lg px-4 py-2 tracking-widest flex-1 text-center">
              {generatedCode || 'Generating...'}
            </div>
            {generatedCode && (
              <button
                onClick={copyCode}
                className="p-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? <FiRefreshCw className="w-4 h-4 text-primary" /> : <FiCopy className="w-4 h-4 text-primary" />}
              </button>
            )}
          </div>
          <div className="text-xs text-text-muted mt-2">Waiting for the interviewee to join...</div>
        </motion.div>
      )}

      {/* ===== PRIVATE MODE: Interviewee - show code input ===== */}
      {isPrivate && peerRole === 'interviewee' && !ownSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-surface border border-border rounded-lg"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-white font-semibold text-sm">Join Private Room</h3>
              <p className="text-text-muted text-xs mt-1">Enter the code shared by your interviewer.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Enter join code"
              maxLength={8}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white font-mono text-lg tracking-widest uppercase placeholder:text-text-muted placeholder:text-sm placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-primary"
              spellCheck={false}
            />
            <button
              onClick={handleJoinByCode}
              disabled={refreshing || !joinCodeInput.trim()}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {refreshing ? 'Joining...' : 'Join'}
            </button>
          </div>
        </motion.div>
      )}

      {/* ===== PUBLIC MODE: Interviewee created room - waiting ===== */}
      {!isPrivate && peerRole === 'interviewee' && ownSession?.status === 'waiting' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm"
        >
          Your room is live. Waiting for an interviewer to join...
        </motion.div>
      )}

      {/* ===== Create room button ===== */}
      {canCreate && !ownSession && !loading && (
        <button
          onClick={handleCreateSession}
          disabled={refreshing}
          className="w-full mb-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <FiPlus className="w-4 h-4" />
          <span>{refreshing ? 'Creating room...' : `Create ${isPrivate ? 'private' : 'public'} room`}</span>
        </button>
      )}

      {/* ===== Session list / waiting states ===== */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FiLoader className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-text-muted">Loading available peers...</p>
        </div>
      ) : !isPrivate && peerRole === 'interviewer' ? (
        sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center border border-dashed border-border rounded-lg"
          >
            <FiUsers className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
            <p className="text-text-muted mb-4">No peers currently waiting for interviews</p>
            <p className="text-sm text-text-muted">Refresh to check for new candidates.</p>
          </motion.div>
        ) : (
          <motion.div className="space-y-3">
            <AnimatePresence>
              {sessions.map(session => (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{session.role}</h3>
                      <div className="flex items-center space-x-3 text-sm text-text-muted">
                        <span>Experience: {session.experienceLevel}</span>
                        <span>•</span>
                        <span>Waiting {Math.max(0, Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 60000))}m</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinSession(session._id)}
                      disabled={refreshing}
                      className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
                    >
                      <span>Join</span>
                      <FiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )
      ) : isPrivate && peerRole === 'interviewee' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center border border-dashed border-border rounded-lg"
        >
          <FiUsers className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-muted mb-2">Enter the code shared by your interviewer</p>
          <p className="text-sm text-text-muted">Use the join code input above to connect.</p>
        </motion.div>
      ) : !isPrivate && peerRole === 'interviewee' && !ownSession ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center border border-dashed border-border rounded-lg"
        >
          <FiUsers className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-muted mb-2">Create a public room to get started</p>
          <p className="text-sm text-text-muted">Click the "Create public room" button above, then wait for an interviewer.</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center border border-dashed border-border rounded-lg"
        >
          <FiUsers className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-muted mb-4">No available peers</p>
        </motion.div>
      )}

      {/* Refresh button */}
      <button
        onClick={() => {
          setRefreshing(true);
          fetchPeerSessions();
        }}
        disabled={refreshing}
        className="mt-6 w-full py-2 border border-border rounded-lg text-text-muted hover:text-white hover:border-primary transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
      >
        <FiLoader className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
      </button>
    </div>
  );
}
