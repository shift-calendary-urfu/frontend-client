import { configure } from "@testing-library/react";

// Allow chained React/API updates on slower developer machines and CI workers.
configure({ asyncUtilTimeout: 3000 });

// jsdom does not implement the native dialog methods.
HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
  this.querySelector("button")?.focus();
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};
