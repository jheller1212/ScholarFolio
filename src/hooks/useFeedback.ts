import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SESSION_KEY_VIEWS = 'sf_profile_views';
const SESSION_KEY_DISMISSED = 'sf_feedback_dismissed';

export function useFeedback(userId: string | null) {
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState<boolean | null>(null);
  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'prompt' | 'button'>('button');

  // On mount: check if this user has already submitted feedback
  useEffect(() => {
    if (!userId) {
      setHasSubmittedBefore(null);
      return;
    }

    supabase
      .from('feedback')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data }) => {
        setHasSubmittedBefore(data !== null && data.length > 0);
      });
  }, [userId]);

  // Track a profile view by scholar ID, show banner after 2+ unique views
  const trackProfileView = useCallback((scholarId: string) => {
    if (!userId || !scholarId) return;
    if (hasSubmittedBefore) return;
    if (sessionStorage.getItem(SESSION_KEY_DISMISSED)) return;

    const raw = sessionStorage.getItem(SESSION_KEY_VIEWS);
    const viewed: string[] = raw ? JSON.parse(raw) : [];

    if (!viewed.includes(scholarId)) {
      const updated = [...viewed, scholarId];
      sessionStorage.setItem(SESSION_KEY_VIEWS, JSON.stringify(updated));

      if (updated.length >= 2) {
        setShowPromptBanner(true);
      }
    }
  }, [userId, hasSubmittedBefore]);

  const dismissBanner = useCallback(() => {
    setShowPromptBanner(false);
    sessionStorage.setItem(SESSION_KEY_DISMISSED, '1');
  }, []);

  const openModal = useCallback((mode: 'prompt' | 'button') => {
    setModalMode(mode);
    setShowModal(true);
    setShowPromptBanner(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const onSubmitSuccess = useCallback((_credits: number) => {
    setHasSubmittedBefore(true);
    setShowPromptBanner(false);
    setShowModal(false);
  }, []);

  return {
    hasSubmittedBefore,
    showPromptBanner,
    showModal,
    modalMode,
    trackProfileView,
    dismissBanner,
    openModal,
    closeModal,
    onSubmitSuccess,
  };
}
