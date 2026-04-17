"use client";

import type { ManagedUser, UpdateUserPayload } from "./types";
import { UserUpsertDialog } from "./UserUpsertDialog";

interface EditUserDialogProps {
  user: ManagedUser;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: UpdateUserPayload) => Promise<void>;
}

export function EditUserDialog({
  user,
  isLoading,
  onClose,
  onSubmit,
}: EditUserDialogProps) {
  return (
    <UserUpsertDialog
      title={`Edit ${user.name}`}
      description="Update profile details, username, email, or role."
      submitLabel="Save changes"
      busyLabel="Saving..."
      initialValues={{
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      }}
      showEmail={true}
      isLoading={isLoading}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
