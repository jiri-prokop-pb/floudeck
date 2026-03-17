import type { BlockRecord } from "../../types.ts";
import { createBlockApi } from "../lib/api.ts";
import { BlockForm } from "./BlockForm.tsx";

type CreateBlockFormProps = {
  onCreate: (block: BlockRecord) => void;
  onClose?: () => void;
};

export function CreateBlockForm({ onCreate, onClose }: CreateBlockFormProps) {
  return (
    <BlockForm
      submitLabel="Add block"
      onCancel={onClose}
      onSubmit={async (data) => {
        const res = await createBlockApi(data);
        if (res.ok) {
          onCreate(res.block);
          onClose?.();
          return {};
        }
        return { error: res.error };
      }}
    />
  );
}
