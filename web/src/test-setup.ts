import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom には dialog の開閉が無いので、ブラウザと同じく open 属性と close イベントだけ再現する
const dialogProto = HTMLDialogElement.prototype;
if (typeof dialogProto.showModal !== "function") {
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialogProto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
