'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { FiUsers, FiPlus, FiArrowRight, FiLoader, FiAlertCircle } from 'react-icons/fi';

interface PeerSession {
  _id: string;
  candidateId: {
    name: string;
    email: string;
  };
  role: string;
  experienceLevel: string;
  createdAt: string;
}

interface PeerLobbyProps {
  onJoinSession: (sessionId: string) => void;
  interviewId: string;
}

export default function PeerLobby({ onJoinSession, interviewId }: PeerLobbyProps) {
  const [sessions, setSessions] = useState<PeerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPeerSessions = async () => {
    try {
      const res = await api.get('/peer-sessions');
      setSessions(res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch peer sessions:', err);
      setError('Failed to load available peers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeerSessions();
    const interval = setInterval(fetchPeerSessions, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <FiUsers className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-white">Find a Peer Interviewer</h2>
        </div>
        <p className="text-text-muted">Practice interviewing with other candidates in real-time</p>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FiLoader className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-text-muted">Loading available peers...</p>
        </div>
      ) : sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center border border-dashed border-border rounded-lg"
        >
          <FiUsers className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-muted mb-4">No peers currently waiting for interviews</p>
          <p className="text-sm text-text-muted">Try again in a moment or create a session to wait for others</p>
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
                      <span>Waiting {Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 60000)}m</span>
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
