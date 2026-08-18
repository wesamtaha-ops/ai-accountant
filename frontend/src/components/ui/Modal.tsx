import type { ReactNode } from "react";
import { ar } from "../../locales/ar";

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <div className="modal-head">
          <h3 className="card-title">{title}</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            {ar.common.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
