import React from 'react';
import UpdateAvailableModal from './UpdateAvailableModal';
import { useAppUpdate } from '../hooks/useAppUpdate';

/**
 * Mounted once at the root. Decides with useAppUpdate, presents with
 * UpdateAvailableModal.
 *
 * `canPromptOptional` lets an app hold back an OPTIONAL update while something
 * more important is on screen (the Consumer app's legal consent, say). A
 * mandatory update is never held back.
 */
export default function AppUpdateGate({ canPromptOptional = true }: { canPromptOptional?: boolean }) {
  const { decision, later, updateNow } = useAppUpdate();
  if (decision.kind === 'none') return null;
  const mandatory = decision.kind === 'mandatory';
  if (!mandatory && !canPromptOptional) return null;

  const r = decision.release;
  return (
    <UpdateAvailableModal
      visible
      mandatory={mandatory}
      version={r.latest_version}
      title={r.title}
      notes={r.notes}
      mandatoryMessage={r.mandatory_message}
      onUpdate={updateNow}
      onLater={mandatory ? undefined : later}
    />
  );
}
