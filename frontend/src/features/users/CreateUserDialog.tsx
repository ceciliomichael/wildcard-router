"use client";

import type { CreateUserPayload } from "./types";
import { type UserFormValues, UserUpsertDialog } from "./UserUpsertDialog";

interface CreateUserDialogProps {
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
}

const emptyUserValues: UserFormValues = {
  name: "",
  username: "",
  email: "",
  role: "user",
};

export function CreateUserDialog({
  isLoading,
  onClose,
  onSubmit,
}: CreateUserDialogProps) {
  return (
    <UserUpsertDialog
      title="Add user"
      description="A password will be generated automatically."
      submitLabel="Create user"
      busyLabel="Creating..."
      initialValues={emptyUserValues}
      showEmail={false}
      isLoading={isLoading}
      onClose={onClose}
      onSubmit={async (values) => {
        await onSubmit({
          name: values.name,
          username: values.username,
          role: values.role,
          email: values.email.trim() ? values.email.trim() : undefined,
        });
      }}
    />
  );
}
